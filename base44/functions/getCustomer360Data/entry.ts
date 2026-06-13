import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Extract email from JWT for parallel fetching
 */
function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Get comprehensive 360° customer profile data
 * Path: { userId: string }
 * 
 * Returns:
 * - userProfile: basic info, roles, credit status
 * - metrics: lifetime value, order counts, averages
 * - recentOrders: last 10 orders
 * - pendingTasks: unpaid orders, unshipped orders
 * - riskFlags: credit over limit, frequent refunds, etc.
 * - preferences: shipping methods, payment methods, stores
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    
    // Auth check
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';
    const isAdminViewer = isPlatformAdmin || isTenantAdmin || isStaff;
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    let { userId } = body;
    
    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }
    
    // Handle 'me' case - user can only view their own profile
    if (userId === 'me') {
      userId = user.id;
    }
    
    // 普通用户只能查看自己的档案；查看他人需要管理员/员工权限 或 细粒度 user:read 权限（与前端判断一致）
    const isSelf = userId === user.id;
    if (!isSelf && !isAdminViewer) {
      let hasUserRead = false;
      const viewerRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const viewer = viewerRecords?.[0];
      if (viewer?.tenant_id) {
        const [tRoles, gRoles] = await Promise.all([
          base44.asServiceRole.entities.Role.filter({ tenant_id: viewer.tenant_id, is_archived: false }),
          base44.asServiceRole.entities.Role.filter({ is_global: true, is_archived: false }),
        ]);
        const rolesArr = [...(tRoles || []), ...(gRoles || [])];
        const perms = new Set();
        (viewer.assigned_role_ids || []).forEach(rid => {
          const role = rolesArr.find(r => r.id === rid)
            || rolesArr.find(r => r.predefined_key === `builtin_${rid}` || r.name === rid);
          (role?.direct_permissions || []).forEach(p => perms.add(p));
        });
        Object.entries(viewer.permission_overrides || {}).forEach(([p, a]) => {
          if (a === 'add') perms.add(p);
          else if (a === 'remove') perms.delete(p);
        });
        hasUserRead = perms.has('user:read');
      }
      if (!hasUserRead) {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }
    
    // Get target user record by ID (not email)
    const targetUsers = await base44.asServiceRole.entities.User.filter({ id: userId });
    if (!targetUsers || targetUsers.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const targetUser = targetUsers[0];
    const targetEmail = targetUser.email;
    const targetTenantId = targetUser.tenant_id;
    
    // Tenant isolation check - CRITICAL: Always enforce tenant boundary
    if (!isPlatformAdmin) {
      // Staff and tenant admins can only view users in their own tenant
      if (targetTenantId && targetTenantId !== user.tenant_id) {
        return Response.json({ error: 'Forbidden: Cannot view users from other tenants' }, { status: 403 });
      }
      // Additional check: ensure tenant_id is present for non-platform-admins
      if (!targetTenantId) {
        return Response.json({ error: 'Forbidden: Invalid tenant context' }, { status: 403 });
      }
    }
    
    // Use targetTenantId for all queries - NEVER query without tenant filter
    const tenantId = targetTenantId;
    
    const t1 = Date.now();
    
    // Parallel fetch all data - CRITICAL: Always filter by tenant_id
    const [allOrders, creditApps, userPrefs, tenantPools, customerNotes, tenantRoles, memberTiers] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId, user_email: targetEmail }),
      base44.asServiceRole.entities.CreditApplication.filter({ tenant_id: tenantId, user_email: targetEmail }),
      base44.asServiceRole.entities.UserPreference.filter({ tenant_id: tenantId, user_email: targetEmail }),
      base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId }, '-created_date', 500),
      base44.asServiceRole.entities.CustomerNote.filter({ tenant_id: tenantId, customer_email: targetEmail }, '-created_date', 100),
      base44.asServiceRole.entities.Role.filter({ tenant_id: tenantId }).catch(() => []),
      targetUser.member_tier_id
        ? base44.asServiceRole.entities.MemberTier.filter({ tenant_id: tenantId }).catch(() => [])
        : Promise.resolve([]),
    ]);
    
    // 会员阶级完整配置（颜色/图标/字体色等，用于用户端展示）
    const tierRec = (memberTiers || []).find(t => t.id === targetUser.member_tier_id) || null;
    const memberTier = tierRec ? {
      id: tierRec.id,
      name: tierRec.name,
      color: tierRec.color || '',
      icon: tierRec.icon || '',
      name_font_color: tierRec.name_font_color || '',
      description: tierRec.description || '',
      is_permanent: !!tierRec.is_permanent,
    } : null;
    
    console.log(`[TIMING] getCustomer360Data | parallel fetches: ${Date.now() - t1}ms`);
    
    // Calculate metrics
    const orderCount = allOrders?.length || 0;
    const totalPaidJpy = allOrders?.reduce((sum, o) => sum + (o.paid_amount || 0), 0) || 0;
    const totalGoodsJpy = allOrders?.reduce((sum, o) => sum + (o.estimated_jpy || 0), 0) || 0;
    const totalServiceFeeJpy = allOrders?.reduce((sum, o) => sum + (o.service_fee_amount || 0), 0) || 0;
    const totalRefundJpy = allOrders?.reduce((sum, o) => sum + (o.refund_amount_jpy || 0), 0) || 0;
    
    const paidOrders = allOrders?.filter(o => o.payment_status === 'paid' || o.payment_status === 'confirmed') || [];
    const unpaidOrders = allOrders?.filter(o => o.payment_status === 'pending' || o.payment_status === 'awaiting_payment' || o.payment_status === 'underpaid') || [];
    const pendingShipOrders = allOrders?.filter(o => 
      o.order_status === 'paid' || o.order_status === 'pending_purchase' || o.order_status === 'purchased'
    ) || [];
    
    const avgOrderValue = orderCount > 0 ? totalPaidJpy / orderCount : 0;
    
    // Find most recent order
    const sortedOrders = [...(allOrders || [])].sort((a, b) => 
      new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
    );
    const lastOrderDate = sortedOrders[0]?.created_date || null;
    
    // Extract preferences
    const storeTags = {};
    const shippingMethods = {};
    const paymentMethods = {};
    const countries = {};
    
    (allOrders || []).forEach(order => {
      // Store tags
      const tag = order.online_store_tag || '其它';
      storeTags[tag] = (storeTags[tag] || 0) + 1;
      
      // Shipping methods
      if (order.shipping_method) {
        shippingMethods[order.shipping_method] = (shippingMethods[order.shipping_method] || 0) + 1;
      }
      
      // Payment methods（记账订单统一计为 credit；一次付款订单统一计为 fullpay_once）
      const pmKey = order.payment_mode === 'credit' ? 'credit'
        : order.payment_mode === 'fullpay_once' ? 'fullpay_once'
        : order.payment_method;
      if (pmKey) {
        paymentMethods[pmKey] = (paymentMethods[pmKey] || 0) + 1;
      }
      
      // Destination countries
      if (order.destination_country) {
        countries[order.destination_country] = (countries[order.destination_country] || 0) + 1;
      }
    });
    
    // ===== 财务账目 =====
    const activeOrders = (allOrders || []).filter(o => !['cancelled', 'expired'].includes(o.order_status));
    const addonFeeJpy = activeOrders.reduce((sum, o) =>
      sum + (o.selected_addons || []).reduce((s, a) => s + ((a.fee_currency || 'JPY') === 'JPY' ? (a.fee || 0) : 0), 0), 0);
    const storageFeeJpy = activeOrders.reduce((sum, o) => sum + (o.accrued_storage_fee_jpy || 0), 0);
    const rewarehouseFeeJpy = activeOrders.reduce((sum, o) => sum + (o.rewarehouse_fee_jpy || 0), 0);
    
    // 发货阶段费用：从该用户参与的发货池费用明细汇总
    const userPools = (tenantPools || []).filter(p =>
      p.creator_email === targetEmail ||
      (p.fee_breakdown_per_user || []).some(f => f.user_email === targetEmail) ||
      (p.per_user_payments || []).some(f => f.user_email === targetEmail)
    );
    let shippingStageReceivableJpy = 0;
    let shippingStagePaidJpy = 0;
    const ledger = [];
    userPools.forEach(p => {
      const fb = (p.fee_breakdown_per_user || []).find(f => f.user_email === targetEmail);
      const userFeeJpy = fb
        ? (fb.total_jpy || 0)
        : (p.creator_email === targetEmail && !(p.fee_breakdown_per_user || []).length
          ? (p.shipping_fee_jpy || 0) + (p.box_price_jpy || 0) + (p.packing_fee_jpy || 0)
          : 0);
      shippingStageReceivableJpy += userFeeJpy;
      const pay = (p.per_user_payments || []).find(f => f.user_email === targetEmail);
      const paidConfirmed = pay
        ? pay.payment_status === 'paid'
        : (p.creator_email === targetEmail && p.payment_status === 'paid');
      if (paidConfirmed && userFeeJpy > 0) {
        shippingStagePaidJpy += userFeeJpy;
        ledger.push({ date: p.shipped_date || p.updated_date || p.created_date, type: 'shipping_payment', title: `发货收款${p.post_shipment_paid ? '（后付款）' : ''} ${p.pool_code || ''}`, amount_jpy: userFeeJpy });
      }
    });
    // 后付款次数：该用户参与的、跳过付款先发货后补付确认收款的发货池数
    const postShipmentPaidCount = userPools.filter(p => p.post_shipment_paid).length;
    (allOrders || []).forEach(o => {
      const paid = o.order_stage_payment_jpy || o.paid_amount || 0;
      const modeLabel = o.payment_mode === 'fullpay_once' ? '（一次付款）'
        : o.payment_mode === 'credit' ? '（记账）'
        : o.payment_mode === 'deferred' ? '（后付款）' : '';
      if (paid > 0) ledger.push({ date: o.submit_date || o.created_date, type: 'order_payment', title: `订单收款${modeLabel} ${o.order_number || ''}`, amount_jpy: paid });
      // fullpay_once 结算退款/补款单独显示
      if (o.payment_mode === 'fullpay_once') {
        const fpo = o.fullpay_once_config || o.pre_shipment?.fullpay_once_config;
        if (fpo && fpo.settlement_status === 'settled' && fpo.fee_difference_jpy) {
          const diff = parseFloat(fpo.fee_difference_jpy) || 0;
          if (diff < 0) {
            ledger.push({ date: fpo.settled_at || o.updated_date, type: 'refund', title: `一次付款运费退差 ${o.order_number || ''}`, amount_jpy: diff });
          } else if (diff > 0) {
            ledger.push({ date: fpo.settled_at || o.updated_date, type: 'order_payment', title: `一次付款运费补差 ${o.order_number || ''}`, amount_jpy: diff });
          }
        }
      }
      if ((o.refund_amount_jpy || 0) > 0) ledger.push({ date: o.updated_date || o.created_date, type: 'refund', title: `退款 ${o.order_number || ''}`, amount_jpy: -o.refund_amount_jpy });
    });
    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const goodsJpyActive = activeOrders.reduce((s, o) => s + (o.estimated_jpy || 0), 0);
    const serviceFeeJpyActive = activeOrders.reduce((s, o) => s + (o.service_fee_amount || 0), 0);
    const receivableJpy = goodsJpyActive + serviceFeeJpyActive + addonFeeJpy + storageFeeJpy + rewarehouseFeeJpy + shippingStageReceivableJpy;
    // 记账挂账：未还清的记账金额不能算作实收（记账订单创建时 paid_amount 记入账面，但实际欠款在 credit_balance_jpy 追踪）
    const creditOutstandingJpy = targetUser.credit_enabled ? (targetUser.credit_balance_jpy || 0) : 0;
    const receivedJpy = Math.max(0, totalPaidJpy + shippingStagePaidJpy - creditOutstandingJpy);
    const outstandingJpy = Math.max(0, receivableJpy - receivedJpy - totalRefundJpy);
    
    // ===== 物流地址 =====
    const pref = (userPrefs || [])[0] || null;
    const savedAddresses = pref?.saved_addresses || [];
    const defaultAddress = savedAddresses.find(a => a.id === pref?.default_address_id) || savedAddresses[0] || null;
    const transitUsage = {};
    (allOrders || []).forEach(o => {
      const name = o.transit_location_name || o.pre_shipment?.transit_location_name;
      if (name) transitUsage[name] = (transitUsage[name] || 0) + 1;
    });
    userPools.forEach(p => {
      if (p.transit_location_name) transitUsage[p.transit_location_name] = (transitUsage[p.transit_location_name] || 0) + 1;
    });
    
    // ===== 备注（普通用户只能看到客户可见备注） =====
    const visibleNotes = (customerNotes || [])
      .filter(n => isAdminViewer || n.note_type === 'customer_visible')
      .sort((a, b) =>
        ((b.is_pinned === true) - (a.is_pinned === true)) ||
        (new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
      );
    
    // ===== 角色标签（来自用户管理的角色权限系统，仅展示，由管理员管理） =====
    const assignedRoleIds = targetUser.assigned_role_ids || [];
    const assignedRoles = (tenantRoles || [])
      .filter(r => assignedRoleIds.includes(r.id) && !r.is_archived)
      .map(r => ({ id: r.id, name: r.name, color: r.color || '#9ca3af' }));
    
    // Risk flags
    const riskFlags = [];
    if (targetUser.credit_enabled && targetUser.credit_balance_jpy > (targetUser.credit_limit_jpy || 0)) {
      riskFlags.push({ type: 'credit_over_limit', message: '记账额度已超限', severity: 'high' });
    }
    const refundRate = totalPaidJpy > 0 ? totalRefundJpy / totalPaidJpy : 0;
    if (refundRate > 0.2) {
      riskFlags.push({ type: 'high_refund_rate', message: `退款率较高 (${(refundRate * 100).toFixed(1)}%)`, severity: 'medium' });
    }
    if (unpaidOrders.length > 3) {
      riskFlags.push({ type: 'multiple_unpaid', message: `有 ${unpaidOrders.length} 笔未付款订单`, severity: 'medium' });
    }
    // Add refund count for frontend display
    const refundCount = allOrders.filter(o => (o.refund_amount_jpy || 0) > 0).length;
    
    // Build timeline events (enhanced for phase 2)
    const timelineEvents = [];
    
    // Registration
    timelineEvents.push({
      type: 'registered',
      date: targetUser.created_date,
      title: '用户注册',
      description: `${targetEmail} 注册账户`
    });
    
    // Orders and related events
    (allOrders || []).forEach(order => {
      // Order creation
      timelineEvents.push({
        type: 'order_created',
        date: order.created_date,
        title: '创建订单',
        description: `订单 ${order.order_number} - ${order.product_name}`,
        orderId: order.id
      });
      
      // Payment events
      if (order.paid_amount && order.paid_amount > 0) {
        timelineEvents.push({
          type: 'payment',
          date: order.submit_date || order.created_date,
          title: '付款',
          description: `支付 ¥${order.paid_amount}`,
          orderId: order.id
        });
      }
      
      // Refund events
      if (order.refund_amount_jpy && order.refund_amount_jpy > 0) {
        timelineEvents.push({
          type: 'refund',
          date: order.updated_date || order.created_date,
          title: '退款',
          description: `退款 ¥${order.refund_amount_jpy}`,
          orderId: order.id
        });
      }
      
      // Shipping events
      if (order.order_status === 'shipped' || order.order_status === 'delivered') {
        timelineEvents.push({
          type: 'shipped',
          date: order.shipped_date || order.created_date,
          title: '发货',
          description: `订单已发货`,
          orderId: order.id
        });
      }
      
      // Order status changes
      if (order.order_status === 'cancelled') {
        timelineEvents.push({
          type: 'order_cancelled',
          date: order.updated_date || order.created_date,
          title: '订单取消',
          description: `订单已取消${order.cancel_reason ? ': ' + order.cancel_reason : ''}`,
          orderId: order.id
        });
      }
      
      if (order.order_status === 'expired') {
        timelineEvents.push({
          type: 'order_expired',
          date: order.updated_date || order.created_date,
          title: '订单超期',
          description: `订单已超期`,
          orderId: order.id
        });
      }
    });
    
    // Credit application events
    (creditApps || []).forEach(app => {
      timelineEvents.push({
        type: 'credit_application',
        date: app.reviewed_at || app.created_date,
        title: '记账申请',
        description: `${app.application_type === 'apply' ? '申请开启记账' : app.application_type === 'disable' ? '申请关闭记账' : '申请调整额度'} - ${app.status === 'approved' ? '已通过' : app.status === 'rejected' ? '已拒绝' : '待审核'}`,
      });
    });
    
    // Note events
    visibleNotes.forEach(n => {
      timelineEvents.push({
        type: 'note_added',
        date: n.created_date,
        title: '添加备注',
        description: `${n.created_by_name || n.created_by_email || ''}：${(n.content || '').slice(0, 50)}`
      });
    });
    
    // Sort timeline
    timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`[TIMING] getCustomer360Data | TOTAL: ${Date.now() - t0}ms`);
    
    return Response.json({
      userProfile: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.full_name || '',
        display_name: targetUser.display_name || '',
        avatar_url: targetUser.avatar_url || '',
        handle: targetUser.handle || '',
        public_profile_bio: targetUser.public_profile_bio || '',
        role: targetUser.role || 'user',
        tenant_id: tenantId,
        created_date: targetUser.created_date,
        is_active: targetUser.is_active !== false,
        credit_enabled: targetUser.credit_enabled || false,
        credit_limit_jpy: targetUser.credit_limit_jpy || 0,
        credit_balance_jpy: targetUser.credit_balance_jpy || 0,
        credit_cycle: targetUser.credit_cycle || null,
        member_tier_id: targetUser.member_tier_id || null,
        member_tier_name: targetUser.member_tier_name || null,
        assigned_role_ids: targetUser.assigned_role_ids || [],
      },
      memberTier,
      metrics: {
        totalOrders: orderCount,
        totalPaidJpy,
        totalGoodsJpy,
        totalServiceFeeJpy,
        totalRefundJpy,
        refundCount,
        postShipmentPaidCount,
        avgOrderValue,
        unpaidOrderCount: unpaidOrders.length,
        pendingShipOrderCount: pendingShipOrders.length,
        lastOrderDate,
        unpaidAmountJpy: outstandingJpy,
        // 累计利润 = 实收 − 商品货款成本（下单时填写的日元货款）− 退款，仅管理员可见
        ...(isAdminViewer ? { totalProfitJpy: receivedJpy - goodsJpyActive - totalRefundJpy } : {}),
      },
      recentOrders: sortedOrders.slice(0, 10).map(o => ({
        id: o.id,
        order_number: o.order_number,
        product_name: o.product_name,
        product_image_url: o.product_image_url || null,
        product_url: o.product_url || null,
        created_date: o.created_date,
        order_status: o.order_status,
        payment_status: o.payment_status,
        payment_mode: o.payment_mode || null,
        payment_method: o.payment_method || null,
        online_store_tag: o.online_store_tag || null,
        service_fee_amount: o.service_fee_amount || 0,
        paid_amount: o.paid_amount || 0,
        estimated_jpy: o.estimated_jpy || 0,
        shipping_method: o.shipping_method || null,
        destination_country: o.destination_country || null,
        shipped_date: o.shipped_date || null,
        tracking_number: o.tracking_number || null,
      })),
      pendingTasks: {
        unpaidOrders: unpaidOrders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          // 未付款订单应显示应付金额（预付款金额，或货款+服务费），而非 paid_amount（未付款时恒为 0）
          amount: o.prepayment_amount_jpy || ((o.estimated_jpy || 0) + (o.service_fee_amount || 0)),
          due_date: o.payment_due_date,
        })),
        pendingShipOrders: pendingShipOrders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          status: o.order_status,
        })),
      },
      riskFlags,
      roles: assignedRoles,
      preferences: {
        topStores: Object.entries(storeTags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topShippingMethods: Object.entries(shippingMethods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topPaymentMethods: Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topCountries: Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      },
      timeline: timelineEvents.slice(0, 50),
      orders: sortedOrders.slice(0, 200).map(o => ({
        id: o.id,
        order_number: o.order_number,
        product_name: o.product_name,
        product_image_url: o.product_image_url || null,
        product_url: o.product_url || null,
        created_date: o.created_date,
        order_status: o.order_status,
        payment_status: o.payment_status,
        payment_mode: o.payment_mode || null,
        payment_method: o.payment_method || null,
        online_store_tag: o.online_store_tag || null,
        service_fee_amount: o.service_fee_amount || 0,
        paid_amount: o.order_stage_payment_jpy || o.paid_amount || 0,
        estimated_jpy: o.estimated_jpy || 0,
        shipping_method: o.shipping_method || null,
        destination_country: o.destination_country || null,
        shipped_date: o.shipped_date || null,
        tracking_number: o.tracking_number || null,
      })),
      finance: {
        receivableJpy,
        receivedJpy,
        creditOutstandingJpy,
        outstandingJpy,
        totalRefundJpy,
        totalGoodsJpy,
        totalServiceFeeJpy,
        shippingStageReceivableJpy,
        addonFeeJpy,
        storageFeeJpy,
        rewarehouseFeeJpy,
        ledger: ledger.slice(0, 100),
      },
      logistics: {
        defaultAddress,
        savedAddresses,
        usesTransit: Object.keys(transitUsage).length > 0,
        topTransit: Object.entries(transitUsage).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      },
      notes: visibleNotes,
    });
    
  } catch (error) {
    console.error(`[TIMING] getCustomer360Data | error: ${Date.now() - t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});