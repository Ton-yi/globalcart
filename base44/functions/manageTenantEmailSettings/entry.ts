import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 管理租户邮箱设置（创建/更新）
 * 仅管理员可访问
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限验证：仅管理员可配置
    if (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const data = await req.json();
    const {
      smtp_enabled,
      smtp_host,
      smtp_port,
      smtp_username,
      smtp_password,
      smtp_from_name,
      smtp_from_email,
      sender_name,
      sender_email,
      gmail_connection_enabled
    } = data;

    // 验证必填字段
    if (smtp_enabled) {
      if (!smtp_host || !smtp_username) {
        return Response.json({ 
          error: 'SMTP 服务器和用户名为必填项',
          success: false 
        }, { status: 400 });
      }
    }

    // 端口白名单验证
    const allowedPorts = [25, 465, 587, 2525];
    if (smtp_port && !allowedPorts.includes(smtp_port)) {
      return Response.json({ 
        error: '不支持的 SMTP 端口，请使用 25, 465, 587, 或 2525',
        success: false 
      }, { status: 400 });
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (smtp_from_email && !emailRegex.test(smtp_from_email)) {
      return Response.json({ 
        error: '发件人邮箱格式无效',
        success: false 
      }, { status: 400 });
    }

    // 获取现有设置
    const existingSettings = await base44.asServiceRole.entities.TenantEmailSettings.filter({
      tenant_id: user.tenant_id
    });

    const saveData = {
      tenant_id: user.tenant_id,
      email_provider: smtp_enabled ? 'smtp' : (gmail_connection_enabled ? 'gmail' : 'platform'),
      smtp_enabled: smtp_enabled || false,
      smtp_host: smtp_host || '',
      smtp_port: smtp_port || 587,
      smtp_username: smtp_username || '',
      smtp_from_name: smtp_from_name || '',
      smtp_from_email: smtp_from_email || '',
      sender_name: sender_name || '',
      sender_email: sender_email || '',
      gmail_connection_enabled: gmail_connection_enabled || false,
      configured_by: user.email,
      configured_at: new Date().toISOString()
    };

    // 仅当密码非空时才保存（更新场景）
    if (smtp_password && smtp_password.length > 0) {
      saveData.smtp_password = smtp_password;
    }

    let result;
    if (existingSettings && existingSettings.length > 0) {
      // 更新现有设置
      result = await base44.asServiceRole.entities.TenantEmailSettings.update(
        existingSettings[0].id,
        saveData
      );
    } else {
      // 创建新设置
      result = await base44.asServiceRole.entities.TenantEmailSettings.create(saveData);
    }

    return Response.json({ 
      success: true, 
      settings: result 
    });

  } catch (error) {
    console.error('[manageTenantEmailSettings] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});