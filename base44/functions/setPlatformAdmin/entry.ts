import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Assign roles to a user (supports multiple roles).
 * If roles already exist, they are merged (no duplicates).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { email, roles } = body;

    if (!email) return Response.json({ error: 'email required' }, { status: 400 });
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return Response.json({ error: 'roles must be a non-empty array' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email });
    const user = users?.[0];
    if (!user) return Response.json({ error: `User not found: ${email}` }, { status: 404 });

    // Merge roles (no duplicates)
    const currentRoles = Array.isArray(user.roles) ? user.roles : [];
    const mergedRoles = [...new Set([...currentRoles, ...roles])];

    const updated = await base44.asServiceRole.entities.User.update(user.id, { roles: mergedRoles });
    return Response.json({ 
      success: true, 
      user: { id: user.id, email: user.email, roles: updated.roles } 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});