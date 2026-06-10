import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取用户通知偏好设置
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

    // Fetch user's notification preferences
    const preferences = await base44.asServiceRole.entities.NotificationPreference.filter({
      tenant_id: tenantId,
      user_email: user.email
    });

    // Fetch notification templates
    const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({
      tenant_id: tenantId,
      is_active: true
    });

    return Response.json({
      preferences: preferences && preferences.length > 0 ? preferences[0] : null,
      templates: templates || []
    });

  } catch (error) {
    console.error('getNotificationPreferences error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});