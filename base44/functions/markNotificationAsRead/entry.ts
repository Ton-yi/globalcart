import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 标记通知为已读
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notification_id, mark_all_read = false } = await req.json();

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    if (mark_all_read) {
      // Mark all as read
      const unreadNotifications = await base44.asServiceRole.entities.Notification.filter({
        tenant_id: tenantId,
        user_email: user.email,
        is_read: false
      });

      for (const notification of unreadNotifications) {
        await base44.asServiceRole.entities.Notification.update(notification.id, {
          is_read: true,
          read_at: new Date().toISOString()
        });
      }

      return Response.json({
        success: true,
        marked_count: unreadNotifications.length
      });
    } else {
      // Mark single notification as read
      if (!notification_id) {
        return Response.json({ error: 'notification_id is required' }, { status: 400 });
      }

      const notification = await base44.asServiceRole.entities.Notification.get(notification_id);
      
      if (!notification) {
        return Response.json({ error: 'Notification not found' }, { status: 404 });
      }

      // Verify ownership
      if (notification.user_email !== user.email || notification.tenant_id !== tenantId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      await base44.asServiceRole.entities.Notification.update(notification_id, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});