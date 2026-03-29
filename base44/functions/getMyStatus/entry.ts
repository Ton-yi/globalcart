import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Returns the current user's is_active status from the User entity record.
 * Used by frontend to detect account suspension on app boot.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const records = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = records?.[0];
    if (!userRecord) return Response.json({ is_active: true }); // no record = not suspended

    return Response.json({ is_active: userRecord.is_active !== false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});