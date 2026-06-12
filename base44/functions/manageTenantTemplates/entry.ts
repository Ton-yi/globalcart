import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 租户模板管理（平台级初始化配置包）
 * 仅 platform_admin 可管理；模板打包：服务费规则模板 + 功能模块 + 仓储策略
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: 仅平台管理员可管理租户模板' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list') {
      const templates = await base44.asServiceRole.entities.TenantTemplate.list();
      return Response.json({ templates: (templates || []).filter(t => !t.is_archived) });
    }

    if (action === 'save') {
      const { template } = body;
      if (!template?.name) return Response.json({ error: '模板名称必填' }, { status: 400 });

      // 校验关联的规则模板有效性
      let feeRuleTemplateName = '';
      if (template.fee_rule_template_id) {
        const found = await base44.asServiceRole.entities.ServiceFeeRule.filter({ id: template.fee_rule_template_id });
        const tpl = found?.[0];
        if (!tpl || !tpl.is_global_template || tpl.is_archived) {
          return Response.json({ error: '关联的服务费规则模板不存在或已失效' }, { status: 400 });
        }
        feeRuleTemplateName = tpl.name;
      }

      const data = {
        name: template.name,
        description: template.description || '',
        fee_rule_template_id: template.fee_rule_template_id || '',
        fee_rule_template_name: feeRuleTemplateName,
        allowed_features: Array.isArray(template.allowed_features) ? template.allowed_features : [],
        storage_policy: template.storage_policy || null,
        updated_by: user.email,
      };

      if (template.id) {
        const existing = await base44.asServiceRole.entities.TenantTemplate.filter({ id: template.id });
        if (!existing?.[0] || existing[0].is_archived) return Response.json({ error: 'Template not found' }, { status: 404 });
        const saved = await base44.asServiceRole.entities.TenantTemplate.update(template.id, data);
        return Response.json({ success: true, template: saved });
      }
      const saved = await base44.asServiceRole.entities.TenantTemplate.create(data);
      return Response.json({ success: true, template: saved });
    }

    if (action === 'delete') {
      const existing = await base44.asServiceRole.entities.TenantTemplate.filter({ id: body.template_id });
      if (!existing?.[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      await base44.asServiceRole.entities.TenantTemplate.update(body.template_id, { is_archived: true });
      return Response.json({ success: true });
    }

    return Response.json({ error: `未知操作: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('manageTenantTemplates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});