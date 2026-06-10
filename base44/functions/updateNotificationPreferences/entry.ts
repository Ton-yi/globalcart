import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 更新用户通知偏好设置
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await req.json();

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // Fetch existing preferences
    const existingPreferences = await base44.asServiceRole.entities.NotificationPreference.filter({
      tenant_id: tenantId,
      user_email: user.email
    });

    if (existingPreferences && existingPreferences.length > 0) {
      // Update existing
      await base44.asServiceRole.entities.NotificationPreference.update(existingPreferences[0].id, {
        ...settings
      });
      
      return Response.json({
        success: true,
        action: 'updated'
      });
    } else {
      // Create new
      const preference = await base44.asServiceRole.entities.NotificationPreference.create({
        tenant_id: tenantId,
        user_email: user.email,
        ...settings
      });
      
      return Response.json({
        success: true,
        action: 'created',
        preference_id: preference.id
      });
    }

  } catch (error) {
    console.error('updateNotificationPreferences error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});