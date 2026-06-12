import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// 根据邮箱查询用户的公开资料页 handle。
// 仅当目标用户开启公开资料页且访问者为同租户用户或管理员时返回 handle，否则统一返回 null。
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    if (!currentUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { email } = await req.json();
    if (!email) return Response.json({ handle: null });

    const users = await base44.asServiceRole.entities.User.filter({ email: String(email).toLowerCase().trim() });
    const target = users[0];
    if (!target || !target.public_profile_enabled || !target.handle) {
      return Response.json({ handle: null });
    }

    const viewerRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role];
    const isViewerAdmin = viewerRoles.includes('platform_admin') || viewerRoles.includes('tenant_admin');
    if (!isViewerAdmin && currentUser.tenant_id !== target.tenant_id) {
      return Response.json({ handle: null });
    }

    return Response.json({ handle: target.handle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});