import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取用户通知列表（支持分页）
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { limit = 20, skip = 0, type } = await req.json();

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // Build filter
    const filter = {
      tenant_id: tenantId,
      user_email: user.email
    };

    if (type) {
      filter.notification_type = type;
    }

    // Fetch notifications
    const allNotifications = await base44.asServiceRole.entities.Notification.filter(filter, '-created_date', limit + skip);
    
    // Apply pagination
    const paginatedNotifications = allNotifications ? allNotifications.slice(skip, skip + limit) : [];

    return Response.json({
      notifications: paginatedNotifications,
      total: allNotifications ? allNotifications.length : 0,
      has_more: allNotifications && allNotifications.length > skip + limit
    });

  } catch (error) {
    console.error('getUserNotifications error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});