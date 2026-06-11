import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取当前租户的邮箱设置
 * 仅管理员可访问
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限验证：仅管理员可访问
    if (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 获取租户邮箱设置（使用 tenant_id 过滤）
    const settingsList = await base44.asServiceRole.entities.TenantEmailSettings.filter({
      tenant_id: user.tenant_id
    });

    const settings = settingsList && settingsList.length > 0 ? settingsList[0] : null;

    // 安全：不返回密码字段
    if (settings) {
      const safeSettings = { ...settings };
      delete safeSettings.smtp_password;
      
      return Response.json({ 
        success: true, 
        settings: safeSettings 
      });
    }

    return Response.json({ 
      success: true, 
      settings: null 
    });

  } catch (error) {
    console.error('[getTenantEmailSettings] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});