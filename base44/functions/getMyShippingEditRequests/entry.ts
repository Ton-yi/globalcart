import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Returns the current user's ShippingEditRequests for visibility in ShippingPool page.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ requests: [] });
    }

    const tenantId = userRecords[0].tenant_id;
    if (!tenantId) return Response.json({ requests: [] });

    const requests = await base44.asServiceRole.entities.ShippingEditRequest.filter({
      tenant_id: tenantId,
      user_email: user.email,
    });

    return Response.json({ requests: requests || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});