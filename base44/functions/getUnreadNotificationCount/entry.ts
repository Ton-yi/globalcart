import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取当前用户的未读通知数量
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // Count unread notifications
    const unreadCount = await base44.asServiceRole.entities.Notification.filter({
      tenant_id: tenantId,
      user_email: user.email,
      is_read: false
    });

    return Response.json({
      unread_count: unreadCount?.length || 0
    });

  } catch (error) {
    console.error('getUnreadNotificationCount error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});