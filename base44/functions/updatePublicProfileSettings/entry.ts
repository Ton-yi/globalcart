import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RESERVED_WORDS = new Set([
  'admin', 'administrator', 'staff', 'mod', 'moderator', 'sysop', 'system',
  'support', 'help', 'security', 'official', 'root', 'api', 'auth', 'login',
  'logout', 'register', 'settings', 'mypage', 'me', 'user', 'users', 'torrent',
  'torrents', 'forum', 'forums', 'invite', 'rules', 'profile', 'profiles',
  'account', 'accounts', 'dashboard', 'admincp', 'staffcp', 'manage', 'management',
  'password', 'email', 'verify', 'reset', 'oauth', 'callback', 'static', 'assets',
  'cdn', 'uploads', 'images', 'zhcn', 'zhtw', 'zh', 'cn', 'tw', 'en', 'ja', 'jp',
  'ko', 'kr', 'ms', 'i18n', 'locale', 'lang', 'language'
]);

const HANDLE_REGEX = /^(?=.*[a-z])[a-z0-9]{3,24}$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      handle,
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

    // handle 必须经过服务端验证后才能写入（格式、保留词、全站唯一）
    if (handle !== undefined && handle !== null && handle !== '') {
      const normalizedHandle = String(handle).toLowerCase().trim();
      if (!HANDLE_REGEX.test(normalizedHandle)) {
        return Response.json({ error: 'Handle 格式不正确。必须是 3-24 位小写字母 a-z 和数字 0-9，包含至少一个字母，不允许纯数字' }, { status: 400 });
      }
      if (RESERVED_WORDS.has(normalizedHandle)) {
        return Response.json({ error: '此 Handle 为系统保留词，不可使用' }, { status: 400 });
      }
      const existingUsers = await base44.asServiceRole.entities.User.filter({ handle: normalizedHandle });
      if (existingUsers.some(u => u.id !== user.id)) {
        return Response.json({ error: '此 Handle 已被其他用户使用' }, { status: 409 });
      }
      updateData.handle = normalizedHandle;
    }

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