import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 管理用户提问（FAQ 问题工单）
 * Actions:
 *   submit    - 用户提交问题（any authenticated user）
 *   list      - 列出问题（admin: 全部；user: 仅自己的）
 *   answer    - 管理员回复（admin only）
 *   mark_read - 用户标记已读回复
 *   get_setting - 获取允许用户提问设置
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords?.length) return Response.json({ error: 'User not found' }, { status: 404 });

    const tenantId = userRecords[0].tenant_id;
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';

    const body = await req.json().catch(() => ({}));
    const { action, data, id } = body;

    // --- get_setting ---
    if (action === 'get_setting') {
      if (!tenantId) return Response.json({ allowed: false });
      const settings = await base44.asServiceRole.entities.SiteSettings.filter({
        tenant_id: tenantId, key: 'faq_allow_user_questions'
      });
      const globalAllowed = settings?.[0]?.value === 'true';

      // Check role-based permission for non-admins
      let roleAllowed = true;
      if (!isAdmin && globalAllowed) {
        const userRecord = userRecords[0];
        const userRoleIds = userRecord.role_ids || [];
        if (userRoleIds.length > 0) {
          const roleRecords = await base44.asServiceRole.entities.Role.filter({ tenant_id: tenantId });
          const userRoles = (roleRecords || []).filter(r => userRoleIds.includes(r.id));
          const allPerms = userRoles.flatMap(r => r.permissions || []);
          const explicitDeny = allPerms.some(p =>
            p === 'block_faq:ask_question' || p === 'block_faq:*'
          );
          if (explicitDeny) roleAllowed = false;
        }
      }

      return Response.json({ allowed: globalAllowed && roleAllowed });
    }

    // --- submit ---
    if (action === 'submit') {
      // Check global setting
      const settings = await base44.asServiceRole.entities.SiteSettings.filter({
        tenant_id: tenantId, key: 'faq_allow_user_questions'
      });
      if (settings?.[0]?.value !== 'true') {
        return Response.json({ error: 'User questions not enabled' }, { status: 403 });
      }

      // Check role-based permission: faq:ask_question
      // Admins always allowed; regular users need the permission granted (or not explicitly blocked)
      if (!isAdmin) {
        // Collect all role IDs assigned to this user
        const userRecord = userRecords[0];
        const userRoleIds = userRecord.role_ids || [];
        let hasPermission = true; // default allow (permission is opt-in via role label, deny only if blocked)

        if (userRoleIds.length > 0) {
          const roleRecords = await base44.asServiceRole.entities.Role.filter({ tenant_id: tenantId });
          const userRoles = (roleRecords || []).filter(r => userRoleIds.includes(r.id));

          // Gather all permissions from user's roles
          const allPerms = userRoles.flatMap(r => r.permissions || []);

          // If any role explicitly has faq:ask_question = false (block), deny
          // Convention: if a role has permissions list and faq:ask_question is listed as denied, block
          // We use: if granted list is non-empty and faq:ask_question is absent AND any role has explicit deny -> deny
          // Simpler: check for block_faq:ask_question pattern or explicit false entry
          const explicitDeny = allPerms.some(p =>
            p === 'block_faq:ask_question' ||
            p === 'block_faq:*'
          );
          if (explicitDeny) hasPermission = false;
        }

        if (!hasPermission) {
          return Response.json({ error: 'Permission denied: faq:ask_question' }, { status: 403 });
        }
      }

      const { question, category_id, category_title } = data || {};
      if (!question?.trim()) return Response.json({ error: 'question required' }, { status: 400 });

      const record = await base44.asServiceRole.entities.FaqQuestion.create({
        tenant_id: tenantId,
        user_email: user.email,
        user_name: user.full_name || user.email,
        question: question.trim(),
        category_id: category_id || 'unclassified',
        category_title: category_title || '未分类',
        status: 'pending',
        unread_by_user: false,
      });

      // Notify all admins in the tenant
      const adminUsers = await base44.asServiceRole.entities.User.filter({
        tenant_id: tenantId,
        role: 'admin'
      });
      const adminUsers2 = await base44.asServiceRole.entities.User.filter({
        tenant_id: tenantId,
        role: 'tenant_admin'
      });
      const allAdmins = [...(adminUsers || []), ...(adminUsers2 || [])];
      for (const admin of allAdmins) {
        await base44.asServiceRole.entities.Notification.create({
          tenant_id: tenantId,
          user_email: admin.email,
          notification_type: 'faq',
          notification_subtype: 'new_question',
          icon: 'HelpCircle',
          title: `用户提问：${question.trim().slice(0, 40)}`,
          content: `${user.full_name || user.email} 提交了一个新问题，请前往帮助中心管理回复。`,
          related_entity_type: 'FaqQuestion',
          related_entity_id: record.id,
          related_url: `/ja/AdminFaq`,
          is_system: true,
          sender_email: user.email,
          priority: 'normal',
          metadata: { question_id: record.id, user_email: user.email },
          created_by: user.id,
        });
      }

      return Response.json({ success: true, question: record });
    }

    // --- list ---
    if (action === 'list') {
      let filter = { tenant_id: tenantId };
      if (!isAdmin) filter.user_email = user.email;
      const questions = await base44.asServiceRole.entities.FaqQuestion.filter(filter);
      const sorted = (questions || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return Response.json({ questions: sorted });
    }

    // --- answer (admin only) ---
    if (action === 'answer') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });

      const existing = await base44.asServiceRole.entities.FaqQuestion.filter({ id });
      if (!existing?.length || existing[0].tenant_id !== tenantId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }

      const { answer, save_to_faq, save_category_id } = data || {};
      if (!answer?.trim()) return Response.json({ error: 'answer required' }, { status: 400 });

      const q = existing[0];
      const now = new Date().toISOString();

      let savedItemId = null;
      let savedCatId = null;

      // If save_to_faq, append to FaqCategory items
      if (save_to_faq && save_category_id) {
        const cats = await base44.asServiceRole.entities.FaqCategory.filter({ id: save_category_id });
        if (cats?.length && cats[0].tenant_id === tenantId) {
          const cat = cats[0];
          const newItemId = `faq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const items = [...(cat.items || []), {
            _id: newItemId,
            question: q.question,
            answer: answer.trim(),
            sort_order: (cat.items || []).length,
          }];
          await base44.asServiceRole.entities.FaqCategory.update(save_category_id, { items });
          savedItemId = newItemId;
          savedCatId = save_category_id;
        }
      }

      const updated = await base44.asServiceRole.entities.FaqQuestion.update(id, {
        answer: answer.trim(),
        answered_by: user.email,
        answered_at: now,
        status: 'answered',
        save_to_faq: !!save_to_faq,
        saved_item_id: savedItemId,
        saved_category_id: savedCatId,
        unread_by_user: true,
      });

      // Notify the user
      await base44.asServiceRole.entities.Notification.create({
        tenant_id: tenantId,
        user_email: q.user_email,
        notification_type: 'faq',
        notification_subtype: 'question_answered',
        icon: 'MessageCircle',
        title: `您的问题已获得回复`,
        content: `管理员已回复您的问题：${q.question.slice(0, 60)}`,
        related_entity_type: 'FaqQuestion',
        related_entity_id: id,
        related_url: `/ja/helpcenter/faq`,
        is_system: true,
        sender_email: user.email,
        priority: 'normal',
        metadata: { question_id: id },
        created_by: user.id,
      });

      return Response.json({ success: true, question: updated });
    }

    // --- mark_read ---
    if (action === 'mark_read') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.FaqQuestion.filter({ id });
      if (!existing?.length || existing[0].user_email !== user.email) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      await base44.asServiceRole.entities.FaqQuestion.update(id, { unread_by_user: false });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('manageFaqQuestions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});