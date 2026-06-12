import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * manageProfileComments — 公开资料页留言区
 * actions: list / create / delete / subscribe / unsubscribe
 * 权限：message:send_profile_comment（仅当租户已配置该权限时强制检查，未配置则默认允许）
 */

function computeEffectivePermissions(userRecord, allRoles) {
  const base = new Set();
  (userRecord.assigned_role_ids || []).forEach(roleId => {
    let role = allRoles.find(r => r.id === roleId);
    if (!role && typeof roleId === 'string') {
      role = allRoles.find(r => r.predefined_key === `builtin_${roleId}` || r.name === roleId);
    }
    (role?.direct_permissions || []).forEach(p => base.add(p));
  });
  const overrides = userRecord.permission_overrides || {};
  Object.entries(overrides).forEach(([p, action]) => {
    if (action === 'add') base.add(p);
    else if (action === 'remove') base.delete(p);
  });
  return Array.from(base);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const meRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const me = meRecords?.[0];
    if (!me) return Response.json({ error: 'User record not found' }, { status: 404 });
    if (me.is_active === false) {
      return Response.json({ error: '您的账户已被停用' }, { status: 403 });
    }

    const isAdminUser = ['platform_admin', 'tenant_admin', 'admin'].includes(user.role);
    const isPlatformAdmin = user.role === 'platform_admin';
    const body = await req.json();
    const { action } = body;

    // ===== 通过 handle 解析目标资料页用户（须公开 + 同租户，管理员/本人除外） =====
    const resolveTarget = async (handle) => {
      if (!handle) return null;
      const targets = await base44.asServiceRole.entities.User.filter({
        handle: String(handle).toLowerCase().trim()
      });
      const target = targets?.[0];
      if (!target || !target.public_profile_enabled) return null;
      const isOwner = target.email === user.email;
      if (!isPlatformAdmin && !isAdminUser && !isOwner && target.tenant_id !== me.tenant_id) return null;
      return target;
    };

    // ===== 留言权限检查（settings-driven：租户配置了该权限才强制） =====
    const checkCanComment = async () => {
      if (isAdminUser) return true;
      const roles = await base44.asServiceRole.entities.Role.filter({
        tenant_id: me.tenant_id,
        is_archived: false
      });
      const effective = computeEffectivePermissions(me, roles);
      // 阻断标签优先级最高：精确或整类通配，强制禁止留言
      if (effective.includes('block_message:send_profile_comment') ||
          effective.includes('block_message:send_message') ||
          effective.includes('block_message:*')) {
        return false;
      }
      const perms = await base44.asServiceRole.entities.Permission.filter({
        tenant_id: me.tenant_id,
        name: 'message:send_profile_comment'
      });
      if (!perms || perms.length === 0) return true; // 租户未配置该权限 → 默认允许
      return effective.includes('message:send_profile_comment') || effective.includes(perms[0].id);
    };

    if (action === 'list') {
      const target = await resolveTarget(body.handle);
      if (!target) return Response.json({ error: '用户不存在或不可访问' }, { status: 404 });

      const [comments, subs, canComment] = await Promise.all([
        base44.asServiceRole.entities.ProfileComment.filter(
          { tenant_id: target.tenant_id, profile_user_id: target.id },
          '-created_date',
          50
        ),
        base44.asServiceRole.entities.ProfileCommentSubscription.filter({
          profile_user_id: target.id,
          subscriber_email: user.email
        }),
        checkCanComment()
      ]);

      return Response.json({
        comments: (comments || []).map(c => ({
          id: c.id,
          author_email: c.author_email,
          author_name: c.author_name,
          author_avatar_url: c.author_avatar_url,
          author_handle: c.author_handle,
          content: c.content,
          image_urls: c.image_urls || [],
          created_date: c.created_date
        })),
        comments_enabled: target.profile_comments_enabled !== false,
        can_comment: canComment,
        is_owner: target.email === user.email,
        is_subscribed: (subs || []).length > 0
      });
    }

    if (action === 'create') {
      const target = await resolveTarget(body.handle);
      if (!target) return Response.json({ error: '用户不存在或不可访问' }, { status: 404 });
      if (target.profile_comments_enabled === false) {
        return Response.json({ error: '该用户已关闭留言区' }, { status: 403 });
      }
      if (!(await checkCanComment())) {
        return Response.json({ error: '您没有在他人资料页留言的权限' }, { status: 403 });
      }

      const content = String(body.content || '').trim().slice(0, 2000);
      const imageUrls = Array.isArray(body.image_urls) ? body.image_urls.slice(0, 4) : [];
      if (!content && imageUrls.length === 0) {
        return Response.json({ error: '留言内容不能为空' }, { status: 400 });
      }

      const comment = await base44.asServiceRole.entities.ProfileComment.create({
        tenant_id: target.tenant_id,
        profile_user_id: target.id,
        profile_user_email: target.email,
        author_email: user.email,
        author_name: me.display_name || user.full_name || user.email,
        author_avatar_url: me.avatar_url || '',
        author_handle: me.handle || '',
        content,
        image_urls: imageUrls
      });

      // ===== 通知：资料页主人 + 订阅者（排除留言者本人），尊重站内通知偏好 =====
      const subs = await base44.asServiceRole.entities.ProfileCommentSubscription.filter({
        profile_user_id: target.id
      });
      const recipients = new Set([target.email, ...(subs || []).map(s => s.subscriber_email)]);
      recipients.delete(user.email);
      const authorName = me.display_name || user.full_name || user.email;

      for (const email of recipients) {
        try {
          const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
            tenant_id: target.tenant_id,
            user_email: email
          });
          const p = prefs?.[0];
          if (p && (p.in_app_enabled === false || p.notification_settings?.message?.in_app === false)) continue;
          await base44.asServiceRole.entities.Notification.create({
            tenant_id: target.tenant_id,
            user_email: email,
            notification_type: 'message',
            notification_subtype: 'profile_comment_new',
            icon: 'MessageSquare',
            title: email === target.email
              ? `${authorName} 在您的资料页留言`
              : `${authorName} 在 ${target.display_name || target.handle} 的资料页发布了新留言`,
            content: content || '[图片]',
            related_entity_type: 'ProfileComment',
            related_entity_id: comment.id,
            related_url: `/u/${target.handle}`
          });
        } catch (e) {
          console.error('profile comment notify failed:', e.message);
        }
      }

      return Response.json({ success: true, comment });
    }

    if (action === 'delete') {
      const comments = await base44.asServiceRole.entities.ProfileComment.filter({ id: body.comment_id });
      const comment = comments?.[0];
      if (!comment) return Response.json({ error: '留言不存在' }, { status: 404 });
      // 租户隔离 + 权限：留言者本人 / 资料页主人 / 管理员（本租户）
      if (!isPlatformAdmin && comment.tenant_id !== me.tenant_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const allowed = isAdminUser ||
        comment.author_email === user.email ||
        comment.profile_user_email === user.email;
      if (!allowed) return Response.json({ error: '无权删除此留言' }, { status: 403 });

      await base44.asServiceRole.entities.ProfileComment.delete(comment.id);
      return Response.json({ success: true });
    }

    if (action === 'subscribe' || action === 'unsubscribe') {
      const target = await resolveTarget(body.handle);
      if (!target) return Response.json({ error: '用户不存在或不可访问' }, { status: 404 });

      const existing = await base44.asServiceRole.entities.ProfileCommentSubscription.filter({
        profile_user_id: target.id,
        subscriber_email: user.email
      });

      if (action === 'subscribe') {
        if (!existing || existing.length === 0) {
          await base44.asServiceRole.entities.ProfileCommentSubscription.create({
            tenant_id: target.tenant_id,
            profile_user_id: target.id,
            profile_user_handle: target.handle || '',
            subscriber_email: user.email
          });
        }
        return Response.json({ success: true, is_subscribed: true });
      } else {
        for (const sub of (existing || [])) {
          await base44.asServiceRole.entities.ProfileCommentSubscription.delete(sub.id);
        }
        return Response.json({ success: true, is_subscribed: false });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('manageProfileComments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});