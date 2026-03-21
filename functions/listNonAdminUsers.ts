import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Any authenticated user can fetch the list of non-admin users (for sharing purposes)
  const allUsers = await base44.asServiceRole.entities.User.list();
  const nonAdmins = (allUsers || [])
    .filter(u => u.role !== 'admin' && u.email !== user.email)
    .map(u => ({ email: u.email, full_name: u.full_name || '' }));

  return Response.json({ users: nonAdmins });
});