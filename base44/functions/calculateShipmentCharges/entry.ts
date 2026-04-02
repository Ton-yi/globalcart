/**
 * calculateShipmentCharges
 *
 * Calculates per-user shipping charges for a ShipmentRequest and
 * writes/updates ShippingUserCharge records for each user.
 *
 * Called by admin when finalising a ShippingQuote before sending
 * payment requests to users.
 *
 * Payload:
 *   { shipment_request_id: string }
 *
 * Rules:
 *  - Single shipment: one user pays everything directly
 *  - Pooled shipment: personal fees per-user, shared fees split by weight ratio
 *  - Pooled to other_address: creator does NOT pay transit_shipping_fee
 *  - packing_fee can be negative
 *  - All amounts in JPY, rounded to 2 decimal places
 *  - Snapshots on ShippingRequestItem lock in size/addon/tail_balance values
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { shipment_request_id } = await req.json();
  if (!shipment_request_id) {
    return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
  }

  // ── 1. Load ShipmentRequest ──────────────────────────────────────────────
  const shipmentRequests = await base44.asServiceRole.entities.ShipmentRequest.filter(
    { id: shipment_request_id }
  );
  const shipmentRequest = shipmentRequests[0];
  if (!shipmentRequest) {
    return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });
  }

  // Tenant isolation: ensure admin belongs to this tenant
  if (shipmentRequest.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const {
    request_type,
    destination_type,
    creator_user_id,
    selected_transit_shipping_method,
  } = shipmentRequest;

  const isPooled = request_type === 'pooled_shipment';
  const isOtherAddress = destination_type === 'other_address';

  // ── 2. Load ShippingQuote ────────────────────────────────────────────────
  const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
    { shipping_request_id: shipment_request_id }
  );
  const quote = quotes[0];
  if (!quote) {
    return Response.json({ error: 'ShippingQuote not found for this ShipmentRequest' }, { status: 404 });
  }

  const internationalShippingFeeJpy = quote.shipping_fee_jpy || 0;
  const boxFeeJpy = quote.box_fee_jpy || 0;
  // packing_fee_default_jpy from quote is the default shared packing fee pool.
  // For pooled: split by weight. For single: goes entirely to the one user.
  const packingFeePoolJpy = quote.packing_fee_default_jpy || 0;

  // ── 3. Load ShippingRequestItems ─────────────────────────────────────────
  const items = await base44.asServiceRole.entities.ShippingRequestItem.filter(
    { shipping_request_id: shipment_request_id }
  );
  if (!items || items.length === 0) {
    return Response.json({ error: 'No ShippingRequestItems found' }, { status: 400 });
  }

  // ── 4. Load TransitShippingMethod fee if applicable ──────────────────────
  let transitMethodFeeJpy = 0;
  let transitMethodRecord = null;
  if (selected_transit_shipping_method) {
    const transitMethods = await base44.asServiceRole.entities.TransitShippingMethod.filter(
      { id: selected_transit_shipping_method }
    );
    transitMethodRecord = transitMethods[0] || null;
    if (transitMethodRecord) {
      // fee stored on the method; snapshot at calc time
      transitMethodFeeJpy = transitMethodRecord.fee || 0;
    }
  }

  // ── 5. Group items by user ───────────────────────────────────────────────
  const userItems = {}; // user_id -> { items[], weight_g }
  let totalWeightG = 0;

  for (const item of items) {
    const uid = item.user_id;
    if (!userItems[uid]) userItems[uid] = { items: [], weight_g: 0 };
    userItems[uid].items.push(item);
    userItems[uid].weight_g += item.item_weight_g || 0;
    totalWeightG += item.item_weight_g || 0;
  }

  // ── 6. Calculate per-user charges ────────────────────────────────────────
  const results = [];

  for (const [userId, userData] of Object.entries(userItems)) {
    const userWeightG = userData.weight_g;
    const weightRatio = totalWeightG > 0 ? userWeightG / totalWeightG : 0;

    // Aggregate snapshots from this user's items
    let tailBalanceJpy = 0;
    let sizeSurchargeJpy = 0;
    let addonFeeJpy = 0;

    for (const item of userData.items) {
      tailBalanceJpy    += item.tail_balance_snapshot || 0;
      sizeSurchargeJpy  += item.size_surcharge_snapshot || 0;
      addonFeeJpy       += item.addon_fee_snapshot || 0;
    }

    // Packing fee: for pooled, split by weight ratio; for single, full amount
    const packingFeeJpy = isPooled
      ? round2(weightRatio * packingFeePoolJpy)
      : packingFeePoolJpy;

    // Transit shipping method fee:
    // - Pooled + transit_location: all users pay
    // - Pooled + other_address: everyone pays EXCEPT the creator
    // - Single shipment: creator pays full transit fee
    let transitShippingFeeJpy = 0;
    if (selected_transit_shipping_method && transitMethodFeeJpy > 0) {
      const isCreator = userId === creator_user_id;
      const exempted = isPooled && isOtherAddress && isCreator;
      if (!exempted) {
        transitShippingFeeJpy = isPooled
          ? round2(weightRatio * transitMethodFeeJpy)
          : transitMethodFeeJpy;
      }
    }

    // Shared fees (only for pooled; for single, user pays 100%)
    const sharedInternationalShippingFeeJpy = isPooled
      ? round2(weightRatio * internationalShippingFeeJpy)
      : internationalShippingFeeJpy;

    const sharedBoxFeeJpy = isPooled
      ? round2(weightRatio * boxFeeJpy)
      : boxFeeJpy;

    // Personal fee total (excludes shared intl. shipping + shared box)
    const personalFeeTotal = round2(
      sizeSurchargeJpy
      + packingFeeJpy        // can be negative
      + addonFeeJpy
      + transitShippingFeeJpy
    );

    // Shared fee total
    const sharedFeeTotal = round2(
      sharedInternationalShippingFeeJpy
      + sharedBoxFeeJpy
    );

    // Final payable = personal + shared - tail_balance deduction
    const finalFeeTotal = round2(personalFeeTotal + sharedFeeTotal - tailBalanceJpy);

    results.push({
      user_id: userId,
      tenant_id: shipmentRequest.tenant_id,
      shipping_request_id: shipment_request_id,

      // Summary
      personal_fee_total_jpy: personalFeeTotal,
      shared_fee_total_jpy: sharedFeeTotal,
      final_fee_total_jpy: finalFeeTotal,

      // Personal breakdown
      tail_balance_jpy: tailBalanceJpy,
      size_surcharge_jpy: sizeSurchargeJpy,
      packing_fee_jpy: packingFeeJpy,
      addon_fee_jpy: addonFeeJpy,
      transit_shipping_fee_jpy: transitShippingFeeJpy,

      // Shared breakdown
      shared_international_shipping_fee_jpy: sharedInternationalShippingFeeJpy,
      shared_box_fee_jpy: sharedBoxFeeJpy,

      // Audit
      weight_ratio: round2(weightRatio),
      user_item_weight_g: userWeightG,

      is_paid: false,
    });
  }

  // ── 7. Upsert ShippingUserCharge records ─────────────────────────────────
  // Delete existing charges for this request, then recreate (clean recalculation)
  const existingCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
    { shipping_request_id: shipment_request_id }
  );
  for (const ec of existingCharges) {
    await base44.asServiceRole.entities.ShippingUserCharge.delete(ec.id);
  }

  const created = [];
  for (const charge of results) {
    const record = await base44.asServiceRole.entities.ShippingUserCharge.create(charge);
    created.push(record);
  }

  // ── 8. Return full breakdown for admin preview ────────────────────────────
  return Response.json({
    shipment_request_id,
    request_type,
    destination_type,
    total_weight_g: totalWeightG,
    international_shipping_fee_jpy: internationalShippingFeeJpy,
    box_fee_jpy: boxFeeJpy,
    packing_fee_pool_jpy: packingFeePoolJpy,
    transit_method_fee_jpy: transitMethodFeeJpy,
    user_charges: results,
  });
});