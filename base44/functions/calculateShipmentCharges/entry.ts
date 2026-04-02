/**
 * calculateShipmentCharges
 *
 * Calculates per-user shipping charges for a ShipmentRequest and
 * writes ShippingUserCharge records for each user.
 *
 * Called by admin after setting up a ShippingQuote.
 * Re-running recalculates and replaces existing charge records.
 *
 * Payload:
 *   {
 *     shipment_request_id: string,
 *     per_user_packing_fees?: { [user_id]: number }  // admin-set per-user packing fee (whole JPY, can be negative)
 *   }
 *
 * Business rules:
 *
 *  Personal fee (per user):
 *    - tail_balance          (sum of item.tail_balance_snapshot — is a PAYABLE component, not a deduction)
 *    - size_surcharge        (sum of item.size_surcharge_snapshot)
 *    - transit_handling_fee  (from TransitLocation.handling_fee, if transit_location)
 *    - packing_fee           (admin-set per user, can be negative; NOT auto-split)
 *    - addon_fee             (sum of item.addon_fee_snapshot)
 *    - transit_shipping_fee  (from TransitShippingMethod.fee per user;
 *                             if destination_type = other_address, creator is EXEMPT)
 *
 *  Shared fee (split by weight ratio):
 *    - shared_international_shipping_fee = round( (user_weight / total_weight) * international_shipping_fee )
 *    - shared_box_fee                    = round( (user_weight / total_weight) * box_fee )
 *
 *  final_payable = personal_fee_total + shared_fee_total
 *
 *  All amounts are whole JPY integers (JPY has no fractional units).
 *
 *  ShippingUserCharge records are immutable snapshots once the quote is frozen.
 *  This function must not be called on a frozen quote (submitShipmentQuote enforces this).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// JPY has no fractional units — always round to nearest integer.
const roundJpy = Math.round;

const CALCULATION_VERSION = 1;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { shipment_request_id, per_user_packing_fees = {} } = body;

    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }

    // ── 1. Load ShipmentRequest ──────────────────────────────────────────
    const shipmentRequests = await base44.asServiceRole.entities.ShipmentRequest.filter(
      { id: shipment_request_id }
    );
    const shipmentRequest = shipmentRequests[0];
    if (!shipmentRequest) {
      return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });
    }

    if (shipmentRequest.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      destination_type,
      creator_user_id,
      selected_transit_shipping_method,
      transit_location_id,
      tenant_id,
    } = shipmentRequest;

    const isOtherAddress = destination_type === 'other_address';
    const isTransitLocation = destination_type === 'transit_location';

    // ── 2. Load ShippingQuote ──────────────────────────────────────────────
    const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
      { shipping_request_id: shipment_request_id }
    );
    const quote = quotes[0];
    if (!quote) {
      return Response.json({ error: 'ShippingQuote not found for this ShipmentRequest' }, { status: 404 });
    }

    // Guard: refuse to overwrite a frozen snapshot if any user has already confirmed
    if (quote.is_frozen) {
      const existingCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
        { shipping_request_id: shipment_request_id }
      );
      const anyConfirmed = existingCharges.some(c => c.user_confirmed === true);
      if (anyConfirmed) {
        return Response.json({
          error: 'Cannot recalculate charges on a frozen quote after users have confirmed. The snapshot is immutable.'
        }, { status: 409 });
      }
    }

    const internationalShippingFeeJpy = roundJpy(quote.shipping_fee_jpy || 0);
    const boxFeeJpy = roundJpy(quote.box_fee_jpy || 0);

    // ── 3. Load ShippingRequestItems ──────────────────────────────────────
    const items = await base44.asServiceRole.entities.ShippingRequestItem.filter(
      { shipping_request_id: shipment_request_id }
    );
    if (!items || items.length === 0) {
      return Response.json({ error: 'No ShippingRequestItems found' }, { status: 400 });
    }

    // ── 4. Load TransitShippingMethod fee (personal fee per user) ──────────
    let transitShippingMethodFeeJpy = 0;
    if (selected_transit_shipping_method) {
      const transitMethods = await base44.asServiceRole.entities.TransitShippingMethod.filter(
        { id: selected_transit_shipping_method }
      );
      if (transitMethods[0]) {
        transitShippingMethodFeeJpy = roundJpy(transitMethods[0].fee || 0);
      }
    }

    // ── 5. Load TransitLocation handling fee (personal fee per user) ────────
    let transitHandlingFeeJpy = 0;
    if (isTransitLocation && transit_location_id) {
      const locations = await base44.asServiceRole.entities.TransitLocation.filter(
        { id: transit_location_id }
      );
      if (locations[0]?.handling_fee) {
        transitHandlingFeeJpy = roundJpy(locations[0].handling_fee);
      }
    }

    // ── 6. Group items by user ─────────────────────────────────────────────
    const userItems = {};
    let totalWeightG = 0;

    for (const item of items) {
      const uid = item.user_id;
      if (!userItems[uid]) userItems[uid] = { items: [], weight_g: 0 };
      userItems[uid].items.push(item);
      userItems[uid].weight_g += item.item_weight_g || 0;
      totalWeightG += item.item_weight_g || 0;
    }

    // ── 7. Calculate per-user charges (all amounts in whole JPY) ──────────
    const results = [];

    for (const [userId, userData] of Object.entries(userItems)) {
      const userWeightG = userData.weight_g;
      // Divide-by-zero protection: if total weight is 0, shared fees are 0
      const weightRatio = totalWeightG > 0 ? userWeightG / totalWeightG : 0;

      // Aggregate item-level snapshots (round defensively — should already be integers)
      let tailBalanceJpy   = 0;
      let sizeSurchargeJpy = 0;
      let addonFeeJpy      = 0;

      for (const item of userData.items) {
        tailBalanceJpy   += item.tail_balance_snapshot || 0;
        sizeSurchargeJpy += item.size_surcharge_snapshot || 0;
        addonFeeJpy      += item.addon_fee_snapshot || 0;
      }

      tailBalanceJpy   = roundJpy(tailBalanceJpy);
      sizeSurchargeJpy = roundJpy(sizeSurchargeJpy);
      addonFeeJpy      = roundJpy(addonFeeJpy);

      // Packing fee: admin-set per user, NOT auto-split, can be negative
      const packingFeeJpy = roundJpy(per_user_packing_fees[userId] ?? 0);

      const thisTransitHandlingFeeJpy = transitHandlingFeeJpy;

      // Transit shipping method fee: exempt creator when destination is other_address
      let thisTransitShippingFeeJpy = 0;
      if (transitShippingMethodFeeJpy > 0) {
        const creatorExempt = isOtherAddress && (userId === creator_user_id);
        if (!creatorExempt) {
          thisTransitShippingFeeJpy = transitShippingMethodFeeJpy;
        }
      }

      // ── Personal fee total ──
      const personalFeeTotal = roundJpy(
        tailBalanceJpy
        + sizeSurchargeJpy
        + thisTransitHandlingFeeJpy
        + packingFeeJpy
        + addonFeeJpy
        + thisTransitShippingFeeJpy
      );

      // ── Shared fee total — each component rounded independently to nearest JPY ──
      const sharedInternationalShippingFeeJpy = roundJpy(weightRatio * internationalShippingFeeJpy);
      const sharedBoxFeeJpy = roundJpy(weightRatio * boxFeeJpy);
      const sharedFeeTotal  = sharedInternationalShippingFeeJpy + sharedBoxFeeJpy;

      // ── Final payable ──
      const finalFeeTotal = personalFeeTotal + sharedFeeTotal;

      results.push({
        user_id: userId,
        tenant_id,
        shipping_request_id: shipment_request_id,

        // Totals
        personal_fee_total_jpy: personalFeeTotal,
        shared_fee_total_jpy: sharedFeeTotal,
        final_fee_total_jpy: finalFeeTotal,

        // Personal fee breakdown
        tail_balance_jpy: tailBalanceJpy,
        size_surcharge_jpy: sizeSurchargeJpy,
        transit_handling_fee_jpy: thisTransitHandlingFeeJpy,
        packing_fee_jpy: packingFeeJpy,
        addon_fee_jpy: addonFeeJpy,
        transit_shipping_fee_jpy: thisTransitShippingFeeJpy,

        // Shared fee breakdown
        shared_international_shipping_fee_jpy: sharedInternationalShippingFeeJpy,
        shared_box_fee_jpy: sharedBoxFeeJpy,

        // Audit (weight_ratio is a float, not a monetary value)
        weight_ratio: weightRatio,
        user_item_weight_g: userWeightG,

        is_paid: false,
        calculation_version: CALCULATION_VERSION,
      });
    }

    // ── 8. Replace existing ShippingUserCharge records ─────────────────────
    const existingCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
      { shipping_request_id: shipment_request_id }
    );
    for (const ec of existingCharges) {
      await base44.asServiceRole.entities.ShippingUserCharge.delete(ec.id);
    }
    for (const charge of results) {
      await base44.asServiceRole.entities.ShippingUserCharge.create(charge);
    }

    // ── 9. Return full breakdown for admin preview ─────────────────────────
    return Response.json({
      shipment_request_id,
      destination_type,
      total_weight_g: totalWeightG,
      quote_summary: {
        international_shipping_fee_jpy: internationalShippingFeeJpy,
        box_fee_jpy: boxFeeJpy,
      },
      transit_method_fee_per_user_jpy: transitShippingMethodFeeJpy,
      transit_handling_fee_per_user_jpy: transitHandlingFeeJpy,
      user_charges: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});