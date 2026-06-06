/**
 * listTenantUsers
 * Returns all users in the same tenant as the caller (excluding themselves).
 * Any authenticated user can call this (no admin role required).
 * Used by the privacy / shared-with user picker in ShippingPool and UserNotifyShipmentModal.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const emailHint = extractEmailFromJwt(req);
    const [user, earlyUserRecords] = await Promise.all([
      base44.auth.me(),
      emailHint
        ? base44.asServiceRole.entities.User.filter({ email: emailHint })
        : Promise.resolve(null),
    ]);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    if (!tenantId) {
      return Response.json({ users: [] });
    }

    // Check account is active
    if (userRecords[0].is_active === false) {
      return Response.json({ error: 'Account suspended' }, { status: 403 });
    }

    const allTenantUsers = await base44.asServiceRole.entities.User.filter({ tenant_id: tenantId }, '-created_date', 50);

    const others = (allTenantUsers || [])
      .filter(u => u.email !== user.email)
      .map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || '',
        role: u.role || 'user',
      }));

    return Response.json({ users: others });
  } catch (error) {
    console.error('listTenantUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});