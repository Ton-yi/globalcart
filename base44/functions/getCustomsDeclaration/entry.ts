/**
 * getCustomsDeclaration
 *
 * Returns the customs declaration for a ShipmentRequest, plus the
 * customs_dangerous_goods_text setting for the user acknowledgement.
 *
 * Users may only fetch their own shipment's declaration.
 * Admins may fetch any declaration within their tenant.
 *
 * Payload: { shipment_request_id: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { shipment_request_id } = body;
    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'platform_admin';

    // Load ShipmentRequest to verify ownership/tenant
    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter({ id: shipment_request_id });
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (!isAdmin && sr.creator_user_id !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (isAdmin && sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load customs declaration
    const declarations = await base44.asServiceRole.entities.CustomsDeclaration.filter(
      { shipping_request_id: shipment_request_id }
    );
    const declaration = declarations[0] || null;

    // Load dangerous goods acknowledgement text from SiteSettings
    const settings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: sr.tenant_id,
      key: 'customs_dangerous_goods_text',
    });
    const dangerousGoodsText = settings[0]?.value ||
      'I confirm that the shipment does not contain any prohibited or dangerous goods.';

    return Response.json({
      declaration,
      customs_declaration_mode: sr.customs_declaration_mode || 'admin_fill',
      dangerous_goods_text: dangerousGoodsText,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});