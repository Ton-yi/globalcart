import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// 客户备注管理（仅管理员/员工）：create / update / delete / toggle_pin
// 租户隔离：只能操作本租户客户的备注（platform_admin 除外）
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isAdminViewer = isPlatformAdmin || ['admin', 'tenant_admin', 'staff'].includes(user.role);
    if (!isAdminViewer) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, userId, noteId, content, note_type, is_pinned } = await req.json();

    if (action === 'create') {
      if (!userId || !content?.trim()) {
        return Response.json({ error: 'userId and content are required' }, { status: 400 });
      }
      const targets = await base44.asServiceRole.entities.User.filter({ id: userId });
      const target = targets[0];
      if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
      if (!isPlatformAdmin && target.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden: Cross-tenant access denied' }, { status: 403 });
      }
      const note = await base44.asServiceRole.entities.CustomerNote.create({
        tenant_id: target.tenant_id,
        customer_user_id: target.id,
        customer_email: target.email,
        content: content.trim(),
        note_type: note_type === 'customer_visible' ? 'customer_visible' : 'internal',
        is_pinned: false,
        created_by_email: user.email,
        created_by_name: user.full_name || user.email
      });
      return Response.json({ success: true, note });
    }

    // update / delete / toggle_pin
    if (!noteId) return Response.json({ error: 'noteId is required' }, { status: 400 });
    const notes = await base44.asServiceRole.entities.CustomerNote.filter({ id: noteId });
    const note = notes[0];
    if (!note) return Response.json({ error: 'Note not found' }, { status: 404 });
    if (!isPlatformAdmin && note.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: Cross-tenant access denied' }, { status: 403 });
    }

    if (action === 'update') {
      await base44.asServiceRole.entities.CustomerNote.update(note.id, {
        content: content !== undefined ? String(content).trim() : note.content,
        note_type: note_type !== undefined ? (note_type === 'customer_visible' ? 'customer_visible' : 'internal') : note.note_type,
        updated_by_email: user.email
      });
    } else if (action === 'toggle_pin') {
      await base44.asServiceRole.entities.CustomerNote.update(note.id, {
        is_pinned: is_pinned !== undefined ? !!is_pinned : !note.is_pinned,
        updated_by_email: user.email
      });
    } else if (action === 'delete') {
      await base44.asServiceRole.entities.CustomerNote.delete(note.id);
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});