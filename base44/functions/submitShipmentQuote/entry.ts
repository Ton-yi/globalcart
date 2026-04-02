/**
 * submitShipmentQuote
 *
 * Admin submits (or re-submits) a shipment quotation.
 * This runs calculateShipmentCharges internally, freezes the quote,
 * and advances ShipmentRequest status to quote_ready.
 *
 * If re-submitting (admin modified weight/fees), the quote is unfrozen first,
 * charges are recalculated, then re-frozen.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   box_template_id?: string,
 *   final_total_weight_g: number,
 *   shipping_fee_jpy: number,
 *   box_fee_jpy?: number,
 *   packing_fee_default_jpy?: number,         // reference/display only
 *   per_user_packing_fees?: { [user_id]: number },  // pooled: per-user, can be negative
 *   note?: string,
 *   packaging_image_urls?: string[],
 *   shipping_label_image_urls?: string[],
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const CALCULATION_VERSION = 1;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const {
    shipment_request_id,
    box_template_id,
    final_total_weight_g,
    shipping_fee_jpy,
    box_fee_jpy = 0,
    packing_fee_default_jpy = 0,
    per_user_packing_fees = {},
    note,
    packaging_image_urls,
    shipping_label_image_urls,
  } = body;

  if (!shipment_request_id) {
    return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
  }
  if (shipping_fee_jpy == null || final_total_weight_g == null) {
    return Response.json({ error: 'final_total_weight_g and shipping_fee_jpy are required' }, { status: 400 });
  }

  // ── 1. Load & validate ShipmentRequest ──────────────────────────────────
  const shipmentRequests = await base44.asServiceRole.entities.ShipmentRequest.filter(
    { id: shipment_request_id }
  );
  const sr = shipmentRequests[0];
  if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

  if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Only allow quoting on valid statuses
  const quotableStatuses = ['draft', 'submitted', 'quote_ready'];
  if (!quotableStatuses.includes(sr.shipping_request_status)) {
    return Response.json({
      error: `Cannot submit quote when status is '${sr.shipping_request_status}'`
    }, { status: 400 });
  }

  const {
    request_type,
    destination_type,
    creator_user_id,
    selected_transit_shipping_method,
    transit_location_id,
    tenant_id,
  } = sr;

  const isOtherAddress = destination_type === 'other_address';
  const isTransitLocation = destination_type === 'transit_location';

  // ── 2. Upsert ShippingQuote ──────────────────────────────────────────────
  const existingQuotes = await base44.asServiceRole.entities.ShippingQuote.filter(
    { shipping_request_id: shipment_request_id }
  );

  const quoteData = {
    tenant_id,
    shipping_request_id: shipment_request_id,
    box_template_id: box_template_id || null,
    final_total_weight_g: round2(final_total_weight_g),
    shipping_fee_jpy: round2(shipping_fee_jpy),
    box_fee_jpy: round2(box_fee_jpy),
    packing_fee_default_jpy: round2(packing_fee_default_jpy),
    per_user_packing_fees,
    note: note || '',
    is_frozen: false, // will be set to true after charges calculated
    quote_step_status: 'draft_quote',
  };

  if (packaging_image_urls !== undefined) quoteData.packaging_image_urls = packaging_image_urls;
  if (shipping_label_image_urls !== undefined) quoteData.shipping_label_image_urls = shipping_label_image_urls;

  let quote;
  if (existingQuotes.length > 0) {
    quote = await base44.asServiceRole.entities.ShippingQuote.update(existingQuotes[0].id, quoteData);
  } else {
    quote = await base44.asServiceRole.entities.ShippingQuote.create(quoteData);
  }

  // ── 3. Load dependencies for charge calculation ──────────────────────────
  const items = await base44.asServiceRole.entities.ShippingRequestItem.filter(
    { shipping_request_id: shipment_request_id }
  );
  if (!items || items.length === 0) {
    return Response.json({ error: 'No ShippingRequestItems found' }, { status: 400 });
  }

  let transitShippingMethodFeeJpy = 0;
  if (selected_transit_shipping_method) {
    const methods = await base44.asServiceRole.entities.TransitShippingMethod.filter(
      { id: selected_transit_shipping_method }
    );
    if (methods[0]) transitShippingMethodFeeJpy = methods[0].fee || 0;
  }

  let transitHandlingFeeJpy = 0;
  if (isTransitLocation && transit_location_id) {
    const locs = await base44.asServiceRole.entities.TransitLocation.filter(
      { id: transit_location_id }
    );
    if (locs[0]) transitHandlingFeeJpy = locs[0].handling_fee || 0;
  }

  // ── 4. Group items by user ───────────────────────────────────────────────
  const userItems = {};
  let totalWeightG = 0;

  for (const item of items) {
    const uid = item.user_id;
    if (!userItems[uid]) userItems[uid] = { items: [], weight_g: 0 };
    userItems[uid].items.push(item);
    userItems[uid].weight_g += item.item_weight_g || 0;
    totalWeightG += item.item_weight_g || 0;
  }

  // ── 5. Calculate per-user charges ────────────────────────────────────────
  const chargeResults = [];

  for (const [userId, userData] of Object.entries(userItems)) {
    const userWeightG = userData.weight_g;
    const weightRatio = totalWeightG > 0 ? userWeightG / totalWeightG : 0;

    let tailBalanceJpy = 0;
    let sizeSurchargeJpy = 0;
    let addonFeeJpy = 0;

    for (const item of userData.items) {
      tailBalanceJpy   += item.tail_balance_snapshot || 0;
      sizeSurchargeJpy += item.size_surcharge_snapshot || 0;
      addonFeeJpy      += item.addon_fee_snapshot || 0;
    }

    const packingFeeJpy = per_user_packing_fees[userId] ?? 0;
    const thisTransitHandlingFeeJpy = transitHandlingFeeJpy;

    let thisTransitShippingFeeJpy = 0;
    if (transitShippingMethodFeeJpy > 0) {
      const isCreator = userId === creator_user_id;
      if (!(isOtherAddress && isCreator)) {
        thisTransitShippingFeeJpy = transitShippingMethodFeeJpy;
      }
    }

    const personalFeeTotal = round2(
      tailBalanceJpy + sizeSurchargeJpy + thisTransitHandlingFeeJpy
      + packingFeeJpy + addonFeeJpy + thisTransitShippingFeeJpy
    );

    const sharedIntlFeeJpy = round2(weightRatio * round2(shipping_fee_jpy));
    const sharedBoxFeeJpy  = round2(weightRatio * round2(box_fee_jpy));
    const sharedFeeTotal   = round2(sharedIntlFeeJpy + sharedBoxFeeJpy);
    const finalFeeTotal    = round2(personalFeeTotal + sharedFeeTotal);

    chargeResults.push({
      user_id: userId,
      tenant_id,
      shipping_request_id: shipment_request_id,
      personal_fee_total_jpy: personalFeeTotal,
      shared_fee_total_jpy: sharedFeeTotal,
      final_fee_total_jpy: finalFeeTotal,
      tail_balance_jpy: tailBalanceJpy,
      size_surcharge_jpy: sizeSurchargeJpy,
      transit_handling_fee_jpy: thisTransitHandlingFeeJpy,
      packing_fee_jpy: packingFeeJpy,
      addon_fee_jpy: addonFeeJpy,
      transit_shipping_fee_jpy: thisTransitShippingFeeJpy,
      shared_international_shipping_fee_jpy: sharedIntlFeeJpy,
      shared_box_fee_jpy: sharedBoxFeeJpy,
      weight_ratio: round2(weightRatio),
      user_item_weight_g: userWeightG,
      is_paid: false,
      calculation_version: CALCULATION_VERSION,
    });
  }

  // ── 6. Replace ShippingUserCharge records ────────────────────────────────
  const existing = await base44.asServiceRole.entities.ShippingUserCharge.filter(
    { shipping_request_id: shipment_request_id }
  );
  for (const ec of existing) {
    await base44.asServiceRole.entities.ShippingUserCharge.delete(ec.id);
  }
  for (const charge of chargeResults) {
    await base44.asServiceRole.entities.ShippingUserCharge.create(charge);
  }

  // ── 7. Freeze the quote ──────────────────────────────────────────────────
  await base44.asServiceRole.entities.ShippingQuote.update(quote.id, {
    is_frozen: true,
    quote_step_status: 'draft_quote',
  });

  // ── 8. Advance ShipmentRequest to quote_ready ────────────────────────────
  await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, {
    shipping_request_status: 'quote_ready',
    user_confirmed_quote: false,
  });

  return Response.json({
    success: true,
    shipment_request_id,
    total_weight_g: totalWeightG,
    user_charges: chargeResults,
  });
});