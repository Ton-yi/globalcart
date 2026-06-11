import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle } = await req.json();
    
    if (!handle) return Response.json({ error: 'Handle is required' }, { status: 400 });

    const normalizedHandle = handle.toLowerCase().trim();
    const targetUsers = await base44.asServiceRole.entities.User.filter({ handle: normalizedHandle });
    
    if (!targetUsers || targetUsers.length === 0) {
      return Response.json({ error: '用户不存在或不可访问' }, { status: 404 });
    }

    const targetUser = targetUsers[0];
    
    if (!targetUser.public_profile_enabled) {
      return Response.json({ error: '用户不存在或不可访问' }, { status: 404 });
    }

    const isViewerAdmin = currentUser.role === 'platform_admin' || currentUser.role === 'tenant_admin';
    const isSameTenant = currentUser.tenant_id === targetUser.tenant_id;
    
    if (!isViewerAdmin && !isSameTenant) {
      return Response.json({ error: '用户不存在或不可访问' }, { status: 404 });
    }

    // Update stats
    await base44.entities.User.update(targetUser.id, {
      public_profile_views_total: (targetUser.public_profile_views_total || 0) + 1,
      public_profile_last_viewed_at: new Date().toISOString()
    });

    const publicProfile = {
      id: targetUser.id,
      handle: targetUser.handle,
      avatar_url: targetUser.avatar_url,
      display_name: targetUser.display_name || targetUser.full_name,
      email: targetUser.email,
      member_tier_name: targetUser.privacy_show_role_badges ? targetUser.member_tier_name : null,
      roles: targetUser.privacy_show_role_badges ? targetUser.roles : null,
      created_date: targetUser.privacy_show_registered_date ? targetUser.created_date : null,
      public_profile_bio: targetUser.privacy_show_bio ? targetUser.public_profile_bio : null,
      public_profile_bio_image_url: targetUser.privacy_show_bio ? targetUser.public_profile_bio_image_url : null,
      last_login_at: targetUser.privacy_show_last_login ? targetUser.last_login_at : null,
    };

    return Response.json({ publicProfile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});