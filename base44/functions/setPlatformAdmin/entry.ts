import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * One-time utility: grant platform_admin role to a specific email.
 * This bypasses normal auth checks since it's a bootstrap operation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { email } = body;

    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    const users = await base44.asServiceRole.entities.User.filter({ email });
    const user = users?.[0];
    if (!user) return Response.json({ error: `User not found: ${email}` }, { status: 404 });

    const updated = await base44.asServiceRole.entities.User.update(user.id, { role: 'platform_admin' });
    return Response.json({ success: true, user: { id: user.id, email: user.email, role: updated.role } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});