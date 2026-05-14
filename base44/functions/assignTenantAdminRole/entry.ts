import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only allow platform admins to assign tenant_admin role
    if (!user || !user.roles?.includes('platform_admin')) {
      return Response.json({ error: 'Forbidden: Platform admin access required' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get the user to update
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = users[0];
    const currentRoles = Array.isArray(targetUser.roles) ? targetUser.roles : [];
    
    // Add tenant_admin role if not already present
    if (!currentRoles.includes('tenant_admin')) {
      currentRoles.push('tenant_admin');
      await base44.asServiceRole.entities.User.update(targetUser.id, { roles: currentRoles });
    }

    return Response.json({ success: true, roles: currentRoles });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});