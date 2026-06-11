import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取租户的 Google Sheets 设置
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
    const settings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: user.tenant_id
    });

    const gsEnabled = settings.find(s => s.key === 'google_sheets_enabled');
    const gsSpreadsheetId = settings.find(s => s.key === 'google_sheets_spreadsheet_id');
    const gsLastSyncDate = settings.find(s => s.key === 'google_sheets_last_sync_date');
    const gsSyncCount = settings.find(s => s.key === 'google_sheets_sync_count');

    return Response.json({ 
      success: true, 
      settings: {
        google_sheets_enabled: gsEnabled?.value || 'false',
        google_sheets_spreadsheet_id: gsSpreadsheetId?.value || null,
        last_sync_date: gsLastSyncDate?.value || null,
        sync_count: gsSyncCount?.value ? parseInt(gsSyncCount.value) : 0
      }
    });

  } catch (error) {
    console.error('[getTenantGoogleSheetsSettings] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});