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

    const { handle } = await req.json();
    
    if (!handle) {
      return Response.json({ error: 'Handle is required' }, { status: 400 });
    }

    const normalizedHandle = handle.toLowerCase().trim();
    
    // Validate format
    if (!HANDLE_REGEX.test(normalizedHandle)) {
      return Response.json({ 
        error: 'Handle 格式不正确。必须是 3-24 位小写字母 a-z 和数字 0-9，包含至少一个字母，不允许纯数字' 
      }, { status: 400 });
    }

    // Check reserved words
    if (RESERVED_WORDS.has(normalizedHandle)) {
      return Response.json({ error: '此 Handle 为系统保留词，不可使用' }, { status: 400 });
    }

    // Check uniqueness
    const existingUsers = await base44.asServiceRole.entities.User.filter({ handle: normalizedHandle });
    
    if (existingUsers && existingUsers.length > 0) {
      // Allow if it's the current user
      if (existingUsers[0].id !== user.id) {
        return Response.json({ error: '此 Handle 已被其他用户使用' }, { status: 409 });
      }
    }

    return Response.json({ valid: true, handle: normalizedHandle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});