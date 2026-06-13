import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch { return null; }
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
    const userRecord = userRecords?.[0];
    const tenantId = userRecord?.tenant_id;
    if (!tenantId) return Response.json({
      orders: [], pools: [], notifications: [], announcements: [], faqQuestions: []
    });

    const tenantFilter = { tenant_id: tenantId };

    const [orders, pools, notifications, announcements, faqQuestions] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(
        { tenant_id: tenantId, user_email: user.email, is_archived: false },
        '-updated_date', 500
      ),
      base44.asServiceRole.entities.ShippingPool.filter(tenantFilter),
      base44.asServiceRole.entities.Notification.filter(
        { tenant_id: tenantId, recipient_email: user.email, is_read: false },
        '-created_date', 50
      ),
      base44.asServiceRole.entities.Announcement.filter(tenantFilter),
      base44.asServiceRole.entities.FaqQuestion.filter(
        { tenant_id: tenantId, user_email: user.email, unread_by_user: true }
      ),
    ]);

    // Filter pools accessible to this user
    const myPools = (pools || []).filter(pool => {
      if (pool.creator_email === user.email) return true;
      if (pool.is_private) return (pool.shared_with_emails || []).includes(user.email);
      return false;
    });

    // Active (non-expired) announcements
    const now = new Date();
    const activeAnnouncements = (announcements || []).filter(a => {
      if (!a.is_active) return false;
      if (a.expires_at && new Date(a.expires_at) < now) return false;
      return true;
    });

    return Response.json({
      orders: orders || [],
      pools: myPools,
      notifications: notifications || [],
      announcements: activeAnnouncements,
      faqQuestions: faqQuestions || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});