import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * manageGroupBuy - 拼下单功能后端
 * Actions:
 *   list_templates     - 列出店铺模板（approved + active 的）
 *   create_template    - 创建店铺模板
 *   update_template    - 更新店铺模板
 *   delete_template    - 删除模板（仅管理员或创建者未审核前）
 *   review_template    - 审核模板（仅管理员）approve/reject
 *   list_requests      - 列出拼下单申请（open 的）
 *   get_request        - 获取拼下单申请详情（含条目）
 *   create_request     - 创建拼下单申请
 *   join_request       - 加入拼下单申请（提交 entry）
 *   update_entry       - 更新自己的条目
 *   cancel_entry       - 退出拼单（取消自己的条目）
 *   complete_request   - 管理员完成拼单（转化为订单）
 *   cancel_request     - 管理员取消拼单
 *   expire_requests    - （定时任务）过期处理
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // Resolve tenant_id from session
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const tenantId = userRecords[0].tenant_id;
    const isAdmin = user.role === 'admin' || user.role === 'platform_admin' || user.role === 'staff';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    if (!tenantId && !isAdmin) {
      return Response.json({ error: 'No tenant assigned' }, { status: 403 });
    }

    // ── list_templates ───────────────────────────────────────────────
    if (action === 'list_templates') {
      const all = await base44.asServiceRole.entities.GroupBuyTemplate.filter({ tenant_id: tenantId });
      // Admins see all; users see approved+active OR their own submissions (any status)
      const visible = isAdmin ? all : (all || []).filter(t =>
        (t.status === 'approved' && t.is_active !== false) ||
        t.created_by_email === user.email
      );
      return Response.json({ templates: visible || [] });
    }

    // ── create_template ──────────────────────────────────────────────
    if (action === 'create_template') {
      const { name, description, color, logo_url, url_keywords, shipping_tiers, is_active } = body;
      if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

      const template = await base44.asServiceRole.entities.GroupBuyTemplate.create({
        tenant_id: tenantId,
        name, description: description || '', color: color || '#6366f1',
        logo_url: logo_url || '', url_keywords: url_keywords || [],
        shipping_tiers: shipping_tiers || [],
        is_active: is_active !== false,
        status: isAdmin ? 'approved' : 'pending_review',
        is_admin_created: isAdmin,
        created_by_email: user.email,
      });
      return Response.json({ success: true, template });
    }

    // ── update_template ──────────────────────────────────────────────
    if (action === 'update_template') {
      const { template_id, ...updateFields } = body;
      if (!template_id) return Response.json({ error: 'template_id required' }, { status: 400 });

      const existing = (await base44.asServiceRole.entities.GroupBuyTemplate.filter({ id: template_id }))?.[0];
      if (!existing || existing.tenant_id !== tenantId) {
        return Response.json({ error: 'Template not found' }, { status: 404 });
      }
      // Only admin or original creator (while pending) can edit
      if (!isAdmin && existing.created_by_email !== user.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      delete updateFields.tenant_id;
      delete updateFields.action;
      // Non-admin edits reset to pending_review
      if (!isAdmin) updateFields.status = 'pending_review';

      const updated = await base44.asServiceRole.entities.GroupBuyTemplate.update(template_id, updateFields);
      return Response.json({ success: true, template: updated });
    }

    // ── review_template ──────────────────────────────────────────────
    if (action === 'review_template') {
      if (!isTenantAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { template_id, decision, reject_reason } = body; // decision: 'approve' | 'reject'
      const existing = (await base44.asServiceRole.entities.GroupBuyTemplate.filter({ id: template_id }))?.[0];
      if (!existing || existing.tenant_id !== tenantId) {
        return Response.json({ error: 'Template not found' }, { status: 404 });
      }
      const updated = await base44.asServiceRole.entities.GroupBuyTemplate.update(template_id, {
        status: decision === 'approve' ? 'approved' : 'rejected',
        reject_reason: reject_reason || '',
      });
      return Response.json({ success: true, template: updated });
    }

    // ── delete_template ──────────────────────────────────────────────
    if (action === 'delete_template') {
      const { template_id } = body;
      const existing = (await base44.asServiceRole.entities.GroupBuyTemplate.filter({ id: template_id }))?.[0];
      if (!existing || existing.tenant_id !== tenantId) {
        return Response.json({ error: 'Template not found' }, { status: 404 });
      }
      if (!isAdmin && existing.created_by_email !== user.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      await base44.asServiceRole.entities.GroupBuyTemplate.delete(template_id);
      return Response.json({ success: true });
    }

    // ── list_requests ────────────────────────────────────────────────
    if (action === 'list_requests') {
      const { status_filter } = body; // optional: 'open' | 'completed' | 'all'
      const all = await base44.asServiceRole.entities.GroupBuyRequest.filter({ tenant_id: tenantId });
      let filtered = all || [];
      if (status_filter && status_filter !== 'all') {
        filtered = filtered.filter(r => r.status === status_filter);
      }
      // Sort by created_date desc
      filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return Response.json({ requests: filtered });
    }

    // ── get_request ──────────────────────────────────────────────────
    if (action === 'get_request') {
      const { request_id } = body;
      const reqRecord = (await base44.asServiceRole.entities.GroupBuyRequest.filter({ id: request_id }))?.[0];
      if (!reqRecord || reqRecord.tenant_id !== tenantId) {
        return Response.json({ error: 'Request not found' }, { status: 404 });
      }
      const entries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ request_id });
      const activeEntries = (entries || []).filter(e => e.status !== 'cancelled');
      return Response.json({ request: reqRecord, entries: entries || [], active_entries: activeEntries });
    }

    // ── create_request ───────────────────────────────────────────────
    if (action === 'create_request') {
      const { title, template_id, deadline, on_deadline_action, condition_tier_id,
              product_url, product_name, product_description, product_image_url,
              estimated_jpy, user_note, custom_deadline } = body;
      if (!title || !template_id || !deadline) {
        return Response.json({ error: 'title, template_id, deadline are required' }, { status: 400 });
      }
      // Get template for tier info
      const template = (await base44.asServiceRole.entities.GroupBuyTemplate.filter({ id: template_id }))?.[0];
      if (!template || template.tenant_id !== tenantId || template.status !== 'approved') {
        return Response.json({ error: 'Template not available' }, { status: 404 });
      }

      // Find condition tier
      const tier = condition_tier_id
        ? (template.shipping_tiers || []).find(t => t.id === condition_tier_id)
        : (template.shipping_tiers || []).find(t => t.is_default);

      const request = await base44.asServiceRole.entities.GroupBuyRequest.create({
        tenant_id: tenantId,
        title,
        template_id,
        template_name: template.name,
        template_color: template.color || '#6366f1',
        deadline,
        on_deadline_action: on_deadline_action || 'cancel',
        condition_tier_id: tier?.id || '',
        condition_tier_name: tier?.name || '',
        condition_min_amount_jpy: tier?.min_amount_jpy || 0,
        condition_shipping_fee_jpy: tier?.shipping_fee_jpy || 0,
        status: 'open',
        creator_email: user.email,
        creator_name: user.full_name || user.email,
        total_amount_jpy: 0,
        entry_count: 0,
      });

      // Auto-join: if creator provides their own product info, add as first entry
      if (product_name && estimated_jpy) {
        const entry = await base44.asServiceRole.entities.GroupBuyEntry.create({
          tenant_id: tenantId,
          request_id: request.id,
          user_email: user.email,
          user_name: user.full_name || user.email,
          product_url: product_url || '',
          product_name,
          product_description: product_description || '',
          product_image_url: product_image_url || '',
          estimated_jpy: parseFloat(estimated_jpy) || 0,
          user_note: user_note || '',
          custom_deadline: custom_deadline || deadline,
          status: 'active',
          allocated_shipping_fee_jpy: 0,
        });

        // Update request totals
        await base44.asServiceRole.entities.GroupBuyRequest.update(request.id, {
          total_amount_jpy: parseFloat(estimated_jpy) || 0,
          entry_count: 1,
        });

        return Response.json({ success: true, request: { ...request, total_amount_jpy: parseFloat(estimated_jpy) || 0, entry_count: 1 }, entry });
      }

      return Response.json({ success: true, request });
    }

    // ── join_request ─────────────────────────────────────────────────
    if (action === 'join_request') {
      const { request_id, product_url, product_name, product_description, product_image_url,
              estimated_jpy, user_note, custom_deadline, deadline_action } = body;
      if (!request_id || !product_name || !estimated_jpy) {
        return Response.json({ error: 'request_id, product_name, estimated_jpy required' }, { status: 400 });
      }

      const reqRecord = (await base44.asServiceRole.entities.GroupBuyRequest.filter({ id: request_id }))?.[0];
      if (!reqRecord || reqRecord.tenant_id !== tenantId || reqRecord.status !== 'open') {
        return Response.json({ error: 'Request not available' }, { status: 404 });
      }

      // Check if user already has an active entry
      const existing = await base44.asServiceRole.entities.GroupBuyEntry.filter({ request_id, user_email: user.email });
      const activeExisting = (existing || []).find(e => e.status === 'active');
      if (activeExisting) {
        return Response.json({ error: 'Already joined this request' }, { status: 409 });
      }

      const entry = await base44.asServiceRole.entities.GroupBuyEntry.create({
        tenant_id: tenantId,
        request_id,
        user_email: user.email,
        user_name: user.full_name || user.email,
        product_url: product_url || '',
        product_name,
        product_description: product_description || '',
        product_image_url: product_image_url || '',
        estimated_jpy: parseFloat(estimated_jpy) || 0,
        user_note: user_note || '',
        custom_deadline: custom_deadline || reqRecord.deadline,
        deadline_action: deadline_action || 'cancel',
        status: 'active',
        allocated_shipping_fee_jpy: 0,
      });

      // Update request totals
      const newTotal = (reqRecord.total_amount_jpy || 0) + (parseFloat(estimated_jpy) || 0);
      const newCount = (reqRecord.entry_count || 0) + 1;
      await base44.asServiceRole.entities.GroupBuyRequest.update(request_id, {
        total_amount_jpy: newTotal,
        entry_count: newCount,
      });

      return Response.json({ success: true, entry });
    }

    // ── update_entry ─────────────────────────────────────────────────
    if (action === 'update_entry') {
      const { entry_id, ...updateFields } = body;
      const entry = (await base44.asServiceRole.entities.GroupBuyEntry.filter({ id: entry_id }))?.[0];
      if (!entry || entry.tenant_id !== tenantId) {
        return Response.json({ error: 'Entry not found' }, { status: 404 });
      }
      if (!isAdmin && entry.user_email !== user.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      delete updateFields.tenant_id;
      delete updateFields.action;
      delete updateFields.request_id;

      const oldAmt = entry.estimated_jpy || 0;
      const newAmt = parseFloat(updateFields.estimated_jpy ?? entry.estimated_jpy) || 0;
      const updated = await base44.asServiceRole.entities.GroupBuyEntry.update(entry_id, updateFields);

      // Recalculate request total if amount changed
      if (oldAmt !== newAmt) {
        const reqRecord = (await base44.asServiceRole.entities.GroupBuyRequest.filter({ id: entry.request_id }))?.[0];
        if (reqRecord) {
          await base44.asServiceRole.entities.GroupBuyRequest.update(entry.request_id, {
            total_amount_jpy: Math.max(0, (reqRecord.total_amount_jpy || 0) - oldAmt + newAmt),
          });
        }
      }

      return Response.json({ success: true, entry: updated });
    }

    // ── cancel_entry ─────────────────────────────────────────────────
    if (action === 'cancel_entry') {
      const { entry_id } = body;
      const entry = (await base44.asServiceRole.entities.GroupBuyEntry.filter({ id: entry_id }))?.[0];
      if (!entry || entry.tenant_id !== tenantId) {
        return Response.json({ error: 'Entry not found' }, { status: 404 });
      }
      if (!isAdmin && entry.user_email !== user.email) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      await base44.asServiceRole.entities.GroupBuyEntry.update(entry_id, { status: 'cancelled' });

      // Update request totals
      const reqRecord = (await base44.asServiceRole.entities.GroupBuyRequest.filter({ id: entry.request_id }))?.[0];
      if (reqRecord) {
        const amt = entry.estimated_jpy || 0;
        const count = Math.max(0, (reqRecord.entry_count || 0) - 1);
        await base44.asServiceRole.entities.GroupBuyRequest.update(entry.request_id, {
          total_amount_jpy: Math.max(0, (reqRecord.total_amount_jpy || 0) - amt),
          entry_count: count,
        });
      }

      return Response.json({ success: true });
    }

    // ── complete_request ─────────────────────────────────────────────
    if (action === 'complete_request') {
      if (!isTenantAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { request_id, actual_shipping_fee_jpy, fee_overrides, admin_note } = body;
      // fee_overrides: [{entry_id, allocated_fee_jpy}] optional per-user overrides

      const reqRecord = (await base44.asServiceRole.entities.GroupBuyRequest.filter({ id: request_id }))?.[0];
      if (!reqRecord || reqRecord.tenant_id !== tenantId) {
        return Response.json({ error: 'Request not found' }, { status: 404 });
      }

      const totalShipping = parseFloat(actual_shipping_fee_jpy) || 0;
      const entries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ request_id });
      const activeEntries = (entries || []).filter(e => e.status === 'active');

      if (activeEntries.length === 0) {
        return Response.json({ error: 'No active entries to complete' }, { status: 400 });
      }

      // Default: split shipping evenly
      const defaultShare = Math.round(totalShipping / activeEntries.length);
      const overrideMap = {};
      (fee_overrides || []).forEach(o => { overrideMap[o.entry_id] = parseFloat(o.allocated_fee_jpy) || 0; });

      // Generate sequential order numbers
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      const dateStr = `${jstNow.getUTCFullYear()}${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}${String(jstNow.getUTCDate()).padStart(2, '0')}`;
      const prefix = `TY${dateStr}`;
      const existingOrders = await base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId });
      const todayOrders = (existingOrders || []).filter(o => (o.order_number || '').startsWith(prefix));
      let maxSeq = todayOrders.reduce((max, o) => {
        const seq = parseInt((o.order_number || '').slice(prefix.length), 10) || 0;
        return Math.max(max, seq);
      }, 0);

      const createdOrders = [];
      for (const entry of activeEntries) {
        maxSeq++;
        const orderNumber = `${prefix}${String(maxSeq).padStart(4, '0')}`;
        const allocatedFee = overrideMap[entry.id] !== undefined ? overrideMap[entry.id] : defaultShare;
        const totalJpy = (entry.estimated_jpy || 0) + allocatedFee;

        const order = await base44.asServiceRole.entities.Order.create({
          tenant_id: tenantId,
          order_number: orderNumber,
          user_email: entry.user_email,
          user_name: entry.user_name,
          product_url: entry.product_url || '',
          product_name: entry.product_name,
          product_description: entry.product_description || '',
          estimated_jpy: totalJpy,
          prepayment_amount: totalJpy,
          prepayment_amount_jpy: totalJpy,
          prepayment_currency: 'JPY',
          payment_status: 'awaiting_payment',
          order_status: 'pending_purchase',
          payment_mode: 'prepay',
          product_image_url: entry.product_image_url || '',
          user_note: entry.user_note || '',
          quantity: 1,
          group_buy_request_id: request_id,
          group_buy_entry_id: entry.id,
        });

        // Update entry with order reference and allocated fee
        await base44.asServiceRole.entities.GroupBuyEntry.update(entry.id, {
          status: 'completed',
          allocated_shipping_fee_jpy: allocatedFee,
          order_id: order.id,
          order_number: orderNumber,
        });

        createdOrders.push(order);
      }

      // Mark request as completed
      await base44.asServiceRole.entities.GroupBuyRequest.update(request_id, {
        status: 'completed',
        actual_shipping_fee_jpy: totalShipping,
        completed_at: new Date().toISOString(),
        completed_by: user.email,
        admin_note: admin_note || '',
      });

      return Response.json({ success: true, orders_created: createdOrders.length, orders: createdOrders });
    }

    // ── cancel_request ───────────────────────────────────────────────
    if (action === 'cancel_request') {
      if (!isTenantAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { request_id, admin_note } = body;
      const reqRecord = (await base44.asServiceRole.entities.GroupBuyRequest.filter({ id: request_id }))?.[0];
      if (!reqRecord || reqRecord.tenant_id !== tenantId) {
        return Response.json({ error: 'Request not found' }, { status: 404 });
      }
      await base44.asServiceRole.entities.GroupBuyRequest.update(request_id, {
        status: 'cancelled',
        admin_note: admin_note || '',
      });
      // Cancel all active entries
      const entries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ request_id });
      await Promise.all((entries || []).filter(e => e.status === 'active').map(e =>
        base44.asServiceRole.entities.GroupBuyEntry.update(e.id, { status: 'cancelled' })
      ));
      return Response.json({ success: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('manageGroupBuy error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});