import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function validateTree(tree, depth = 1) {
  if (!Array.isArray(tree)) return '导航配置必须是数组';
  if (depth > 3) return '导航层级最多 3 层';
  for (const node of tree) {
    if (!node || typeof node.key !== 'string' || !node.key) return '节点缺少 key';
    if (node.label != null && (typeof node.label !== 'string' || node.label.length > 30)) return '显示文字最长 30 字';
    if (node.hidden != null && typeof node.hidden !== 'boolean') return 'hidden 必须是布尔值';
    if (node.children && node.children.length > 0) {
      if (depth >= 3) return '导航层级最多 3 层';
      const err = validateTree(node.children, depth + 1);
      if (err) return err;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdminRole = ['admin', 'tenant_admin', 'platform_admin'].includes(user.role);
    if (!isAdminRole) return Response.json({ error: 'Forbidden: 仅管理员可管理导航栏设置' }, { status: 403 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id;
    if (!tenantId) return Response.json({ error: '当前用户未分配租户' }, { status: 400 });

    const { action, admin_nav, user_nav } = await req.json();

    const existing = await base44.asServiceRole.entities.NavbarSettings.filter({ tenant_id: tenantId });

    if (action === 'get') {
      return Response.json({ settings: existing?.[0] || null });
    }

    if (action === 'save') {
      for (const [name, tree] of [['管理员导航', admin_nav], ['用户导航', user_nav]]) {
        if (tree != null) {
          const err = validateTree(tree);
          if (err) return Response.json({ error: `${name}: ${err}` }, { status: 400 });
        }
      }
      const data = {
        tenant_id: tenantId,
        ...(admin_nav != null && { admin_nav }),
        ...(user_nav != null && { user_nav }),
        updated_by: user.email,
      };
      let saved;
      if (existing?.[0]) {
        saved = await base44.asServiceRole.entities.NavbarSettings.update(existing[0].id, data);
      } else {
        saved = await base44.asServiceRole.entities.NavbarSettings.create(data);
      }
      return Response.json({ success: true, settings: saved });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});