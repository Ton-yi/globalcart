import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 管理租户的 Google Sheets 设置
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

    const data = await req.json();
    const { google_sheets_enabled } = data;

    // 验证参数
    if (google_sheets_enabled !== undefined && !['true', 'false'].includes(google_sheets_enabled)) {
      return Response.json({ 
        error: 'google_sheets_enabled 必须是 "true" 或 "false"',
        success: false 
      }, { status: 400 });
    }

    // 获取现有设置
    const existingSettings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: user.tenant_id
    });

    // 更新或创建 google_sheets_enabled 设置
    const gsEnabledSetting = existingSettings.find(s => s.key === 'google_sheets_enabled');
    
    if (google_sheets_enabled !== undefined) {
      if (gsEnabledSetting) {
        await base44.asServiceRole.entities.SiteSettings.update(gsEnabledSetting.id, {
          value: google_sheets_enabled
        });
      } else {
        await base44.asServiceRole.entities.SiteSettings.create({
          tenant_id: user.tenant_id,
          key: 'google_sheets_enabled',
          value: google_sheets_enabled,
          description: '是否启用 Google Sheets 订单归档',
          category: 'notifications'
        });
      }
    }

    return Response.json({ 
      success: true,
      message: 'Google Sheets 设置已更新'
    });

  } catch (error) {
    console.error('[manageTenantGoogleSheetsSettings] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});