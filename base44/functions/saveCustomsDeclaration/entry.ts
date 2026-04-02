/**
 * saveCustomsDeclaration
 *
 * Creates or updates the customs declaration for a ShipmentRequest.
 *
 * Users may only save declarations for their own shipments and only
 * when customs_declaration_mode = 'user_fill'.
 * Admins may save for any shipment in their tenant.
 *
 * Declaration is editable until shipping_request_status = 'shipped'.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   items: Array<{
 *     item_name_en: string,
 *     unit_price: number,
 *     currency: string,
 *     quantity: number,
 *     weight_g: number,
 *     item_type: string,
 *     total_value: number,
 *   }>,
 *   dangerous_goods_confirmed: boolean,
 *   undeliverable_instruction: 'return_to_sender' | 'abandon' | 'forward_to_other_address',
 *   return_method?: 'air' | 'most_economical_route',
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ENGLISH_ONLY_RE = /^[A-Za-z0-9\s\-\/&,.()'"]+$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const {
      shipment_request_id,
      items,
      dangerous_goods_confirmed,
      undeliverable_instruction,
      return_method,
    } = body;

    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'platform_admin';

    // Load ShipmentRequest
    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter({ id: shipment_request_id });
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (!isAdmin && sr.creator_user_id !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (isAdmin && sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // User can only fill if mode = user_fill
    if (!isAdmin && sr.customs_declaration_mode !== 'user_fill') {
      return Response.json({ error: 'Customs declaration is not user-fillable for this shipment' }, { status: 403 });
    }

    // Editable until shipped
    if (sr.shipping_request_status === 'shipped' || sr.shipping_request_status === 'delivered') {
      return Response.json({ error: 'Declaration cannot be edited after shipment is shipped' }, { status: 400 });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'At least one declaration item is required' }, { status: 400 });
    }

    for (const item of items) {
      if (!item.item_name_en || !ENGLISH_ONLY_RE.test(item.item_name_en)) {
        return Response.json({ error: `item_name_en must contain English characters only: "${item.item_name_en}"` }, { status: 400 });
      }
      if (item.unit_price == null || item.unit_price < 0) {
        return Response.json({ error: 'unit_price must be >= 0' }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1) {
        return Response.json({ error: 'quantity must be >= 1' }, { status: 400 });
      }
      if (item.weight_g == null || item.weight_g < 0) {
        return Response.json({ error: 'weight_g must be >= 0' }, { status: 400 });
      }
    }

    // Normalise items: auto-calculate total_value
    const normalisedItems = items.map(item => ({
      item_name_en: item.item_name_en.trim(),
      unit_price: Number(item.unit_price),
      currency: item.currency || 'JPY',
      quantity: Number(item.quantity),
      weight_g: Number(item.weight_g),
      item_type: item.item_type || 'gift',
      total_value: Math.round(Number(item.unit_price) * Number(item.quantity) * 100) / 100,
    }));

    const declarationData = {
      tenant_id: sr.tenant_id,
      shipping_request_id: shipment_request_id,
      filled_by: user.email,
      items: normalisedItems,
      dangerous_goods_confirmed: !!dangerous_goods_confirmed,
      undeliverable_instruction: undeliverable_instruction || null,
      return_method: undeliverable_instruction === 'return_to_sender' ? (return_method || null) : null,
    };

    // Upsert
    const existing = await base44.asServiceRole.entities.CustomsDeclaration.filter(
      { shipping_request_id: shipment_request_id }
    );

    let declaration;
    if (existing[0]) {
      declaration = await base44.asServiceRole.entities.CustomsDeclaration.update(existing[0].id, declarationData);
    } else {
      declaration = await base44.asServiceRole.entities.CustomsDeclaration.create(declarationData);
    }

    return Response.json({ success: true, declaration });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});