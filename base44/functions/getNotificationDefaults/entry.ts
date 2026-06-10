import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取通知偏好默认设置
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取租户上下文
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // 优先获取租户级默认设置，否则获取平台级
    let defaults = await base44.asServiceRole.entities.NotificationPreferenceDefaults.filter({ 
      tenant_id: tenantId 
    });

    if (!defaults || defaults.length === 0) {
      defaults = await base44.asServiceRole.entities.NotificationPreferenceDefaults.filter({ 
        tenant_id: null 
      });
    }

    return Response.json({
      defaults: defaults && defaults.length > 0 ? defaults[0] : null
    });

  } catch (error) {
    console.error('getNotificationDefaults error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});