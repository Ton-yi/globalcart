import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Tenant management — create, list, update, update_branding.
 * - platform_admin: full access including subdomain changes
 * - admin / tenant_admin: can only update their own tenant's branding (not subdomain/code)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    if (!isPlatformAdmin && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ── list ──────────────────────────────────────────────────────────────
    if (action === 'list') {
      const tenants = await base44.asServiceRole.entities.Tenant.list();
      return Response.json({ tenants: tenants || [] });
    }

    // ── create (platform_admin only) ─────────────────────────────────────
    if (action === 'create') {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: only platform_admin can create tenants' }, { status: 403 });

      const { name, code, branding_name, timezone, subdomain, login_title, login_subtitle, logo_url, favicon_url, theme_color, contact_info, initial_fee_rule_template_id, allowed_features, tenant_template_id } = body;
      if (!name || !code) return Response.json({ error: 'name and code are required' }, { status: 400 });

      // 加载租户模板（初始化配置包：规则模板 + 功能模块 + 仓储策略）
      let tenantTemplate = null;
      if (tenant_template_id) {
        const tpls = await base44.asServiceRole.entities.TenantTemplate.filter({ id: tenant_template_id });
        if (tpls?.[0] && !tpls[0].is_archived) tenantTemplate = tpls[0];
      }
      const effectiveFeatures = Array.isArray(allowed_features) ? allowed_features : (tenantTemplate?.allowed_features || []);
      const effectiveFeeTplId = initial_fee_rule_template_id || tenantTemplate?.fee_rule_template_id || '';

      const normalizedCode = code.toUpperCase();
      const normalizedSubdomain = (subdomain || code).toLowerCase().replace(/[^a-z0-9-]/g, '');

      // Enforce unique code
      const existingCode = await base44.asServiceRole.entities.Tenant.filter({ code: normalizedCode });
      if (existingCode?.length > 0) return Response.json({ error: `Code "${normalizedCode}" is already in use` }, { status: 409 });

      // Enforce unique subdomain
      const existingSubdomain = await base44.asServiceRole.entities.Tenant.filter({ subdomain: normalizedSubdomain });
      if (existingSubdomain?.length > 0) return Response.json({ error: `Subdomain "${normalizedSubdomain}" is already in use` }, { status: 409 });

      const tenant = await base44.asServiceRole.entities.Tenant.create({
        name,
        code: normalizedCode,
        subdomain: normalizedSubdomain,
        branding_name: branding_name || name,
        timezone: timezone || 'Asia/Tokyo',
        login_title: login_title || branding_name || name,
        login_subtitle: login_subtitle || '',
        logo_url: logo_url || '',
        favicon_url: favicon_url || '',
        theme_color: theme_color || '#dc2626',
        contact_info: contact_info || '',
        is_active: true,
        // 功能模块化付费：开通的功能模块标识列表（后续付费开关均基于此字段）
        allowed_features: effectiveFeatures,
        initial_fee_rule_template_id: effectiveFeeTplId,
        tenant_template_id: tenant_template_id || '',
      });

      // 为新租户自动创建内置预定义角色
      await initTenantBuiltinRoles(base44, tenant.id);

      // 套用全局服务费规则模板（克隆为该租户的草稿规则）
      let appliedFeeRule = null;
      if (effectiveFeeTplId) {
        appliedFeeRule = await cloneFeeRuleTemplateToTenant(base44, effectiveFeeTplId, tenant.id);
      }

      // 联动初始化：默认通知模板 + 仓储设置（模板可覆盖仓储策略）
      const initialized = await initTenantDefaultSettings(base44, tenant.id, user.email, tenantTemplate?.storage_policy || null);

      return Response.json({ tenant, applied_fee_rule: appliedFeeRule, initialized });
    }

    // ── get_platform_domain (any admin) ─────────────────────────────────────
    if (action === 'get_platform_domain') {
      // Read the platform-level base domain setting (tenant_id is null or empty)
      const allSettings = await base44.asServiceRole.entities.SiteSettings.filter({ key: 'platform_base_domain' });
      const setting = (allSettings || []).find(s => !s.tenant_id || s.tenant_id === '');
      return Response.json({ platform_base_domain: setting?.value || '' });
    }

    // ── set_platform_domain (platform_admin only) ─────────────────────────
    if (action === 'set_platform_domain') {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: only platform_admin can set platform domain' }, { status: 403 });
      const { platform_base_domain } = body;
      if (platform_base_domain === undefined) return Response.json({ error: 'platform_base_domain required' }, { status: 400 });
      // Normalize: strip protocol, trailing slash
      const normalized = (platform_base_domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      // Upsert: find existing platform-level setting
      const allSettings = await base44.asServiceRole.entities.SiteSettings.filter({ key: 'platform_base_domain' });
      const existing = (allSettings || []).find(s => !s.tenant_id || s.tenant_id === '');
      if (existing) {
        await base44.asServiceRole.entities.SiteSettings.update(existing.id, { value: normalized });
      } else {
        await base44.asServiceRole.entities.SiteSettings.create({
          key: 'platform_base_domain',
          value: normalized,
          description: '平台二级域名（租户三级域名的基础）',
          category: 'general',
          tenant_id: '',
        });
      }
      return Response.json({ platform_base_domain: normalized });
    }

    // ── update (platform_admin: all fields; admin: branding + subdomain of own tenant) ──
    if (action === 'update') {
      const { id, ...fields } = body;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      delete fields.action;

      if (!isPlatformAdmin) {
        // Tenant admin: must own this tenant
        const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const userRecord = userRecords?.[0];
        if (!userRecord?.tenant_id || userRecord.tenant_id !== id) {
          return Response.json({ error: 'Forbidden: you can only edit your own tenant' }, { status: 403 });
        }
        // Restrict: cannot change code or is_active; CAN change subdomain
        delete fields.code;
        delete fields.is_active;
        // 功能模块化付费：仅 platform_admin 可变更开通模块与模板溯源字段
        delete fields.allowed_features;
        delete fields.initial_fee_rule_template_id;
        delete fields.tenant_template_id;
        // Validate and normalize subdomain if provided
        if (fields.subdomain !== undefined) {
          const normalizedSubdomain = (fields.subdomain || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (!normalizedSubdomain) return Response.json({ error: 'subdomain cannot be empty' }, { status: 400 });
          fields.subdomain = normalizedSubdomain;
          const existing = await base44.asServiceRole.entities.Tenant.filter({ subdomain: normalizedSubdomain });
          const conflict = (existing || []).find(t => t.id !== id);
          if (conflict) return Response.json({ error: `子域名 "${normalizedSubdomain}" 已被其他租户占用` }, { status: 409 });
        }
      } else {
        // platform_admin: if subdomain is being changed, enforce uniqueness
        if (fields.subdomain) {
          const normalizedSubdomain = fields.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
          fields.subdomain = normalizedSubdomain;
          const existing = await base44.asServiceRole.entities.Tenant.filter({ subdomain: normalizedSubdomain });
          const conflict = (existing || []).find(t => t.id !== id);
          if (conflict) return Response.json({ error: `Subdomain "${normalizedSubdomain}" is already in use` }, { status: 409 });
        }
        if (fields.code) {
          const normalizedCode = fields.code.toUpperCase();
          fields.code = normalizedCode;
          const existing = await base44.asServiceRole.entities.Tenant.filter({ code: normalizedCode });
          const conflict = (existing || []).find(t => t.id !== id);
          if (conflict) return Response.json({ error: `Code "${normalizedCode}" is already in use` }, { status: 409 });
        }
      }

      const tenant = await base44.asServiceRole.entities.Tenant.update(id, fields);
      return Response.json({ tenant });
    }

    // ── init_builtin_roles: ensure builtin roles exist for a tenant (platform_admin) ──
    if (action === 'init_builtin_roles') {
      if (!isPlatformAdmin && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { tenant_id } = body;
      if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });
      await initTenantBuiltinRoles(base44, tenant_id);
      return Response.json({ success: true });
    }

    // ── assign_all: set tenant_id on every user missing it (platform_admin only) ──
    if (action === 'assign_all') {
      if (!isPlatformAdmin && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { tenant_id } = body;
      if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });

      const allUsers = await base44.asServiceRole.entities.User.list();
      const missing = (allUsers || []).filter(u => !u.tenant_id);
      await Promise.all(missing.map(u =>
        base44.asServiceRole.entities.User.update(u.id, { tenant_id })
      ));
      return Response.json({ assigned: missing.length, tenant_id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('manageTenants error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * 租户默认通知模板（与 initializeDefaultNotificationTemplates 保持一致）
 */
const DEFAULT_NOTIFICATION_TEMPLATES = [
  { notification_type: 'payment', notification_subtype: 'order_payment_required', title_template: '订单 {{order_number}} 需付款', content_template: '您的订单 {{order_number}} 需支付 {{amount}} JPY，请及时付款。', default_in_app: true, default_email: true },
  { notification_type: 'payment', notification_subtype: 'order_supplement_required', title_template: '订单 {{order_number}} 需补款', content_template: '您的订单 {{order_number}} 需补款 {{amount}} JPY，请查看订单详情。', default_in_app: true, default_email: true },
  { notification_type: 'payment', notification_subtype: 'shipping_fee_required', title_template: '发货申请需付运费', content_template: '您的发货申请需支付运费 {{amount}} {{currency}}，请及时付款。', default_in_app: true, default_email: true },
  { notification_type: 'payment', notification_subtype: 'shipping_fee_supplement_required', title_template: '发货申请需补运费', content_template: '您的发货申请需补运费 {{amount}} {{currency}}，请查看。', default_in_app: true, default_email: true },
  { notification_type: 'shipping_request', notification_subtype: 'shipping_request_sent', title_template: '发货申请已发出', content_template: '您的发货申请已提交，等待管理员处理。', default_in_app: true, default_email: false },
  { notification_type: 'shipping_request', notification_subtype: 'shipping_request_arrived', title_template: '发货申请已送达中转地', content_template: '您的发货申请已送达中转地 {{transit_location_name}}，正在处理中。', default_in_app: true, default_email: true },
  { notification_type: 'shipping_request', notification_subtype: 'transit_shipped', title_template: '中转地已发货', content_template: '您的货物已从中转地发出，运单号：{{tracking_number}}', default_in_app: true, default_email: true },
  { notification_type: 'order_status', notification_subtype: 'order_created', title_template: '订单 {{order_number}} 已创建', content_template: '您的订单 {{order_number}} 已创建成功，等待管理员确认。', default_in_app: false, default_email: false },
  { notification_type: 'order_status', notification_subtype: 'order_payment_confirmed', title_template: '订单 {{order_number}} 付款已确认', content_template: '您的订单 {{order_number}} 付款已确认，我们将尽快处理。', default_in_app: true, default_email: false },
  { notification_type: 'order_status', notification_subtype: 'order_purchased', title_template: '订单 {{order_number}} 已下单', content_template: '您的订单 {{order_number}} 已成功下单，预计 {{estimated_days}} 天内入库。', default_in_app: true, default_email: false },
  { notification_type: 'order_status', notification_subtype: 'order_in_warehouse', title_template: '订单 {{order_number}} 已入库', content_template: '您的订单 {{order_number}} 已入库，可以提交发货申请了。', default_in_app: true, default_email: false },
  { notification_type: 'order_status', notification_subtype: 'order_added_to_pool', title_template: '订单已添加至发货申请', content_template: '您的订单 {{order_number}} 已添加到发货申请 {{pool_code}}。', default_in_app: false, default_email: false },
  { notification_type: 'message', notification_subtype: 'new_reply', title_template: '订单/发货申请有新回复', content_template: '您的订单 {{order_number}} 或发货申请有新回复，请查看。', default_in_app: true, default_email: true },
  { notification_type: 'other', notification_subtype: 'store_template_pending_review', title_template: '店铺模板待审核', content_template: '您有新的店铺模板提交，等待审核。', default_in_app: true, default_email: false },
  { notification_type: 'other', notification_subtype: 'store_template_reviewed', title_template: '店铺模板审核结果', content_template: '您的店铺模板 {{template_name}} 审核{{review_result}}，请查看。', default_in_app: true, default_email: true },
];

/**
 * 联动初始化新租户的默认设置：通知模板 + 仓储设置（幂等：已存在则跳过）
 */
async function initTenantDefaultSettings(base44, tenantId, adminEmail, storagePolicy = null) {
  const result = { notification_templates: 0, storage_settings: false };

  // 1. 默认通知模板（批量创建，已存在的子类型跳过）
  const existingTpls = await base44.asServiceRole.entities.NotificationTemplate.filter({ tenant_id: tenantId });
  const existingKeys = new Set((existingTpls || []).map(t => `${t.notification_type}:${t.notification_subtype}`));
  const toCreate = DEFAULT_NOTIFICATION_TEMPLATES
    .filter(t => !existingKeys.has(`${t.notification_type}:${t.notification_subtype}`))
    .map(t => ({ ...t, tenant_id: tenantId, is_active: true, updated_by: adminEmail }));
  if (toCreate.length > 0) {
    await base44.asServiceRole.entities.NotificationTemplate.bulkCreate(toCreate);
    result.notification_templates = toCreate.length;
  }

  // 2. 默认仓储设置（租户模板策略优先，否则与 manageStorageSettings 默认值一致）
  const existingStorage = await base44.asServiceRole.entities.StorageSettings.filter({ tenant_id: tenantId });
  if (!existingStorage || existingStorage.length === 0) {
    const sp = storagePolicy || {};
    await base44.asServiceRole.entities.StorageSettings.create({
      tenant_id: tenantId,
      storage_enabled: sp.storage_enabled ?? false,
      default_storage_days: sp.default_storage_days ?? 90,
      default_reminder_days: sp.default_reminder_days ?? 60,
      default_storage_fee_per_day: sp.default_storage_fee_per_day ?? 0,
      storage_fee_currency: 'JPY',
      on_deadline_action: sp.on_deadline_action ?? 'change_status',
      deadline_status: sp.deadline_status ?? 'expired',
      updated_by: adminEmail,
      updated_at: new Date().toISOString(),
    });
    result.storage_settings = true;
  }

  console.log(`[initTenantDefaultSettings] tenant ${tenantId}: ${result.notification_templates} templates, storage=${result.storage_settings}`);
  return result;
}

/**
 * 克隆全局服务费规则模板为指定租户的草稿规则（字段白名单与 serviceFeeRuleEngine 保持一致）
 */
const FEE_TEMPLATE_COPY_FIELDS = [
  'name', 'description', 'fee_phase', 'priority', 'effective_from', 'effective_until',
  'mode', 'formula', 'simple_rate', 'simple_fixed_fee', 'customer_level_filter',
  'store_filter', 'tiered_config', 'shipping_fee_simple_config', 'shipping_fee_tiered_config',
  'min_fee', 'max_fee', 'round_mode', 'round_unit',
];

async function cloneFeeRuleTemplateToTenant(base44, templateId, tenantId) {
  const found = await base44.asServiceRole.entities.ServiceFeeRule.filter({ id: templateId });
  const tpl = found?.[0];
  if (!tpl || !tpl.is_global_template || tpl.is_archived) {
    console.warn(`[cloneFeeRuleTemplateToTenant] Template ${templateId} not found or invalid, skipped`);
    return null;
  }
  const data = {};
  FEE_TEMPLATE_COPY_FIELDS.forEach(f => { if (tpl[f] !== undefined) data[f] = tpl[f]; });
  const rule = await base44.asServiceRole.entities.ServiceFeeRule.create({
    ...data,
    status: 'draft',
    tenant_id: tenantId,
    is_global_template: false,
    source_template_id: tpl.id,
    version: 1,
  });
  console.log(`[cloneFeeRuleTemplateToTenant] Cloned template ${templateId} → rule ${rule.id} for tenant ${tenantId}`);
  return rule;
}

/**
 * 为租户创建两个内置预定义角色：用户（builtin_user）和管理员（builtin_admin）
 * 若已存在则跳过，保证幂等。
 */
async function initTenantBuiltinRoles(base44, tenantId) {
  const BUILTIN_USER_PERMISSIONS = [
    "order:submit_purchase_request",
    "shipping:notify_shipment",
    "shipping:direct_shipment",
    "message:send_message",
    "message:send_order_message",
    "message:send_shipping_message",
    "message:send_image",
    "payment:self_pay",
    "payment:manual_pay",
    "payment:pre_pay",
    "payment:pay_full_amount",
    "order:archive_order",
    "profile:change_display_name",
    "profile:change_avatar",
    "profile:change_auto_archive_settings",
    "view:my_orders_module",
    "addon:select_value_added_services",
    "addon:select_order_value_added_services",
    "addon:select_shipping_value_added_services",
  ];

  const existing = await base44.asServiceRole.entities.Role.filter({ tenant_id: tenantId, is_predefined: true });
  const existingKeys = (existing || []).map(r => r.predefined_key);

  if (!existingKeys.includes('builtin_user')) {
    await base44.asServiceRole.entities.Role.create({
      tenant_id: tenantId,
      name: '用户',
      description: '普通用户内置角色，新注册用户默认分配',
      color: '#6b7280',
      is_global: false,
      is_predefined: true,
      predefined_key: 'builtin_user',
      direct_permissions: BUILTIN_USER_PERMISSIONS,
      overridden_permissions: [],
    });
    console.log(`[initTenantBuiltinRoles] Created builtin_user for tenant ${tenantId}`);
  }

  if (!existingKeys.includes('builtin_admin')) {
    await base44.asServiceRole.entities.Role.create({
      tenant_id: tenantId,
      name: '管理员',
      description: '租户管理员内置角色，拥有全部权限',
      color: '#dc2626',
      is_global: false,
      is_predefined: true,
      predefined_key: 'builtin_admin',
      direct_permissions: [], // 管理员通过系统角色权限控制，此处留空
      overridden_permissions: [],
    });
    console.log(`[initTenantBuiltinRoles] Created builtin_admin for tenant ${tenantId}`);
  }
}