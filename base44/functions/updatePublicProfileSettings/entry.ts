import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      public_profile_enabled,
      public_profile_bio,
      public_profile_bio_image_url,
      privacy_show_registered_date,
      privacy_show_role_badges,
      privacy_show_bio,
      privacy_show_stats,
      privacy_show_orders,
      privacy_show_country,
      privacy_show_last_login
    } = await req.json();

    const updateData = {};
    
    if (public_profile_enabled !== undefined) updateData.public_profile_enabled = public_profile_enabled;
    if (public_profile_bio !== undefined) updateData.public_profile_bio = public_profile_bio;
    if (public_profile_bio_image_url !== undefined) updateData.public_profile_bio_image_url = public_profile_bio_image_url;
    if (privacy_show_registered_date !== undefined) updateData.privacy_show_registered_date = privacy_show_registered_date;
    if (privacy_show_role_badges !== undefined) updateData.privacy_show_role_badges = privacy_show_role_badges;
    if (privacy_show_bio !== undefined) updateData.privacy_show_bio = privacy_show_bio;
    if (privacy_show_stats !== undefined) updateData.privacy_show_stats = privacy_show_stats;
    if (privacy_show_orders !== undefined) updateData.privacy_show_orders = privacy_show_orders;
    if (privacy_show_country !== undefined) updateData.privacy_show_country = privacy_show_country;
    if (privacy_show_last_login !== undefined) updateData.privacy_show_last_login = privacy_show_last_login;

    await base44.entities.User.update(user.id, updateData);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});