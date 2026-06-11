import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取租户的库存存放期限设置
 * 仅管理员可访问
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限验证
    if (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 获取设置
    const settings = await base44.asServiceRole.entities.StorageSettings.filter({
      tenant_id: user.tenant_id
    });

    const storageSettings = settings[0] || null;

    return Response.json({ 
      success: true, 
      settings: storageSettings
    });

  } catch (error) {
    console.error('[getStorageSettings] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});