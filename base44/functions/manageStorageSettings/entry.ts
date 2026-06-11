import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 管理租户的库存存放期限设置
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
    const {
      storage_enabled,
      default_storage_days,
      default_reminder_days,
      default_storage_fee_per_day,
      storage_fee_currency,
      on_deadline_action,
      deadline_status
    } = data;

    // 验证参数
    if (storage_enabled !== undefined && typeof storage_enabled !== 'boolean') {
      return Response.json({ error: 'storage_enabled 必须是布尔值', success: false }, { status: 400 });
    }

    if (default_storage_days !== undefined && (typeof default_storage_days !== 'number' || default_storage_days < 0)) {
      return Response.json({ error: 'default_storage_days 必须是正整数', success: false }, { status: 400 });
    }

    if (default_reminder_days !== undefined && (typeof default_reminder_days !== 'number' || default_reminder_days < 0)) {
      return Response.json({ error: 'default_reminder_days 必须是正整数', success: false }, { status: 400 });
    }

    // 获取现有设置
    const existingSettings = await base44.asServiceRole.entities.StorageSettings.filter({
      tenant_id: user.tenant_id
    });

    const storageSettings = existingSettings[0];

    if (storageSettings) {
      // 更新现有设置
      const updateData = {
        updated_by: user.email,
        updated_at: new Date().toISOString()
      };

      if (storage_enabled !== undefined) updateData.storage_enabled = storage_enabled;
      if (default_storage_days !== undefined) updateData.default_storage_days = default_storage_days;
      if (default_reminder_days !== undefined) updateData.default_reminder_days = default_reminder_days;
      if (default_storage_fee_per_day !== undefined) updateData.default_storage_fee_per_day = default_storage_fee_per_day;
      if (storage_fee_currency !== undefined) updateData.storage_fee_currency = storage_fee_currency;
      if (on_deadline_action !== undefined) updateData.on_deadline_action = on_deadline_action;
      if (deadline_status !== undefined) updateData.deadline_status = deadline_status;

      await base44.asServiceRole.entities.StorageSettings.update(storageSettings.id, updateData);
    } else {
      // 创建新设置
      await base44.asServiceRole.entities.StorageSettings.create({
        tenant_id: user.tenant_id,
        storage_enabled: storage_enabled ?? false,
        default_storage_days: default_storage_days ?? 90,
        default_reminder_days: default_reminder_days ?? 60,
        default_storage_fee_per_day: default_storage_fee_per_day ?? 0,
        storage_fee_currency: storage_fee_currency ?? 'JPY',
        on_deadline_action: on_deadline_action ?? 'change_status',
        deadline_status: deadline_status ?? 'expired',
        updated_by: user.email,
        updated_at: new Date().toISOString()
      });
    }

    return Response.json({ 
      success: true,
      message: '库存存放期限设置已更新'
    });

  } catch (error) {
    console.error('[manageStorageSettings] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});