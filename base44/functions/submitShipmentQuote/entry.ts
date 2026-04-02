/**
 * submitShipmentQuote
 *
 * Admin submits a shipment quotation (first time or re-quotation).
 *
 * Freeze / re-quotation rules:
 *   - A ShippingQuote record is frozen (is_frozen=true) immediately after creation.
 *     It is NEVER mutated again.
 *   - If a frozen quote already exists and admin submits new figures, a NEW quote
 *     record is created with quote_version incremented.
 *   - The old quote record is marked superseded_by = new quote ID (audit trail).
 *   - ALL existing ShippingUserCharge records are replaced with fresh snapshots.
 *   - ALL user_confirmed flags on the new charge records are reset to false.
 *   - ShipmentRequest returns to quote_ready for fresh user confirmation.
 *
 * This means:
 *   - Old frozen quote records are preserved for audit.
 *   - Active charges always correspond to the latest quote version.
 *   - Re-quotation is always allowed (no status gate blocking admin), as long as
 *     the shipment has not yet been paid or shipped.
 *
 * All monetary values are stored as whole JPY integers.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   box_template_id?: string,
 *   final_total_weight_g: number,
 *   shipping_fee_jpy: number,          // whole JPY
 *   box_fee_jpy?: number,              // whole JPY
 *   packing_fee_default_jpy?: number,  // reference/display only, whole JPY
 *   per_user_packing_fees?: { [user_id]: number },  // whole JPY, can be negative
 *   note?: string,
 *   packaging_image_urls?: string[],
 *   shipping_label_image_urls?: string[],
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // ── 1. Load & validate ShipmentRequest ────────────────────────────────
    const shipmentRequests = await base44.asServiceRole.entities.ShipmentRequest.filter(
      { id: shipment_request_id }
    );
    const sr = shipmentRequests[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Re-quotation is blocked once payment is underway or shipment is complete.
    const nonQuotableStatuses = ['waiting_payment', 'paid', 'packing', 'shipped', 'delivered', 'cancelled'];
    if (nonQuotableStatuses.includes(sr.shipping_request_status)) {
      return Response.json({
        error: `Cannot submit a new quote when status is '${sr.shipping_request_status}'.`
      }, { status: 400 });
    }

    const {
      destination_type,
      creator_user_id,
      selected_transit_shipping_method,
      transit_location_id,
      tenant_id,
    } = sr;

    const isOtherAddress = destination_type === 'other_address';
    const isTransitLocation = destination_type === 'transit_location';

    // ── 2. Find existing active quote (if any) ─────────────────────────────
    // Active quote = no superseded_by set (i.e. not yet replaced by a newer version).
    const allQuotes = await base44.asServiceRole.entities.ShippingQuote.filter(
      { shipping_request_id: shipment_request_id }
    );
    // The active quote is the one not superseded by anything
    const supersededIds = new Set(allQuotes.map(q => q.superseded_by).filter(Boolean));
    const activeQuote = allQuotes.find(q => !supersededIds.has(q.id) && !q.superseded_by) || allQuotes[allQuotes.length - 1] || null;

    const nextVersion = activeQuote ? (activeQuote.quote_version || 1) + 1 : 1;

    // ── 3. Prepare rounded fee values ─────────────────────────────────────
    const shippingFeeJpy = roundJpy(shipping_fee_jpy);
    const boxFeeJpy = roundJpy(box_fee_jpy);

    // ── 4. Create the new frozen quote record ──────────────────────────────
    const newQuoteData = {
      tenant_id,
      shipping_request_id: shipment_request_id,
      quote_version: nextVersion,
      box_template_id: box_template_id || null,
      final_total_weight_g,
      shipping_fee_jpy: shippingFeeJpy,
      box_fee_jpy: boxFeeJpy,
      packing_fee_default_jpy: roundJpy(packing_fee_default_jpy),
      per_user_packing_fees,
      note: note || '',
      is_frozen: true,
      quote_step_status: 'draft_quote',
    };

    if (packaging_image_urls !== undefined) newQuoteData.packaging_image_urls = packaging_image_urls;
    if (shipping_label_image_urls !== undefined) newQuoteData.shipping_label_image_urls = shipping_label_image_urls;

    const newQuote = await base44.asServiceRole.entities.ShippingQuote.create(newQuoteData);

    // ── 5. Mark old active quote as superseded (audit trail) ──────────────
    if (activeQuote) {
      await base44.asServiceRole.entities.ShippingQuote.update(activeQuote.id, {
        superseded_by: newQuote.id,
      });
    }

    // ── 6. Load dependencies for charge calculation ────────────────────────
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
      if (methods[0]) transitShippingMethodFeeJpy = roundJpy(methods[0].fee || 0);
    }

    let transitHandlingFeeJpy = 0;
    if (isTransitLocation && transit_location_id) {
      const locs = await base44.asServiceRole.entities.TransitLocation.filter(
        { id: transit_location_id }
      );
      if (locs[0]) transitHandlingFeeJpy = roundJpy(locs[0].handling_fee || 0);
    }

    // ── 7. Group items by user ─────────────────────────────────────────────
    const userItems = {};
    let totalWeightG = 0;

    for (const item of items) {
      const uid = item.user_id;
      if (!userItems[uid]) userItems[uid] = { items: [], weight_g: 0 };
      userItems[uid].items.push(item);
      userItems[uid].weight_g += item.item_weight_g || 0;
      totalWeightG += item.item_weight_g || 0;
    }

    // ── 8. Calculate fresh per-user charges (all amounts in whole JPY) ─────
    const chargeResults = [];

    for (const [userId, userData] of Object.entries(userItems)) {
      const userWeightG = userData.weight_g;
      const weightRatio = totalWeightG > 0 ? userWeightG / totalWeightG : 0;

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

      const packingFeeJpy = roundJpy(per_user_packing_fees[userId] ?? 0);
      const thisTransitHandlingFeeJpy = transitHandlingFeeJpy;

      let thisTransitShippingFeeJpy = 0;
      if (transitShippingMethodFeeJpy > 0) {
        const isCreator = userId === creator_user_id;
        if (!(isOtherAddress && isCreator)) {
          thisTransitShippingFeeJpy = transitShippingMethodFeeJpy;
        }
      }

      const personalFeeTotal = roundJpy(
        tailBalanceJpy + sizeSurchargeJpy + thisTransitHandlingFeeJpy
        + packingFeeJpy + addonFeeJpy + thisTransitShippingFeeJpy
      );

      const sharedIntlFeeJpy = roundJpy(weightRatio * shippingFeeJpy);
      const sharedBoxFeeJpy  = roundJpy(weightRatio * boxFeeJpy);
      const sharedFeeTotal   = sharedIntlFeeJpy + sharedBoxFeeJpy;
      const finalFeeTotal    = personalFeeTotal + sharedFeeTotal;

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
        weight_ratio: weightRatio,
        user_item_weight_g: userWeightG,
        user_confirmed: false,  // always reset — new quote requires fresh confirmation
        is_paid: false,
        calculation_version: CALCULATION_VERSION,
      });
    }

    // ── 9. Replace ShippingUserCharge records with fresh snapshots ─────────
    const existingCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
      { shipping_request_id: shipment_request_id }
    );
    for (const ec of existingCharges) {
      await base44.asServiceRole.entities.ShippingUserCharge.delete(ec.id);
    }
    for (const charge of chargeResults) {
      await base44.asServiceRole.entities.ShippingUserCharge.create(charge);
    }

    // ── 10. Reset ShipmentRequest to quote_ready for fresh confirmation ────
    await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, {
      shipping_request_status: 'quote_ready',
      user_confirmed_quote: false,
    });

    return Response.json({
      success: true,
      shipment_request_id,
      quote_version: nextVersion,
      re_quoted: nextVersion > 1,
      total_weight_g: totalWeightG,
      user_charges: chargeResults,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});