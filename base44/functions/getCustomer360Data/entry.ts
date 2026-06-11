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
    
    if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { userId } = body;
    
    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }
    
    // Get target user record
    const targetUsers = await base44.asServiceRole.entities.User.filter({ email: userId });
    if (!targetUsers || targetUsers.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const targetUser = targetUsers[0];
    const targetEmail = targetUser.email;
    const tenantId = targetUser.tenant_id;
    
    // Tenant isolation check
    if (!isPlatformAdmin && tenantId && tenantId !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: Cannot view users from other tenants' }, { status: 403 });
    }
    
    const t1 = Date.now();
    
    // Parallel fetch all data
    const [allOrders, creditApps] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(tenantId ? { tenant_id: tenantId, user_email: targetEmail } : { user_email: targetEmail }),
      base44.asServiceRole.entities.CreditApplication.filter({ user_email: targetEmail })
    ]);
    
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
      
      // Payment methods
      if (order.payment_method) {
        paymentMethods[order.payment_method] = (paymentMethods[order.payment_method] || 0) + 1;
      }
      
      // Destination countries
      if (order.destination_country) {
        countries[order.destination_country] = (countries[order.destination_country] || 0) + 1;
      }
    });
    
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
    
    // Build timeline events (simplified for phase 1)
    const timelineEvents = [];
    
    // Registration
    timelineEvents.push({
      type: 'registered',
      date: targetUser.created_date,
      title: '用户注册',
      description: `${targetEmail} 注册账户`
    });
    
    // Orders
    (allOrders || []).forEach(order => {
      timelineEvents.push({
        type: 'order_created',
        date: order.created_date,
        title: '创建订单',
        description: `订单 ${order.order_number} - ${order.product_name}`,
        orderId: order.id
      });
      
      if (order.paid_amount && order.paid_amount > 0) {
        timelineEvents.push({
          type: 'payment',
          date: order.submit_date || order.created_date,
          title: '付款',
          description: `支付 ¥${order.paid_amount}`,
          orderId: order.id
        });
      }
      
      if (order.order_status === 'shipped' || order.order_status === 'delivered') {
        timelineEvents.push({
          type: 'shipped',
          date: order.shipped_date || order.created_date,
          title: '发货',
          description: `订单已发货`,
          orderId: order.id
        });
      }
    });
    
    // Sort timeline
    timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`[TIMING] getCustomer360Data | TOTAL: ${Date.now() - t0}ms`);
    
    return Response.json({
      userProfile: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.full_name || '',
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
      metrics: {
        totalOrders: orderCount,
        totalPaidJpy,
        totalGoodsJpy,
        totalServiceFeeJpy,
        totalRefundJpy,
        avgOrderValue,
        unpaidOrderCount: unpaidOrders.length,
        pendingShipOrderCount: pendingShipOrders.length,
        lastOrderDate,
      },
      recentOrders: sortedOrders.slice(0, 10).map(o => ({
        id: o.id,
        order_number: o.order_number,
        product_name: o.product_name,
        created_date: o.created_date,
        order_status: o.order_status,
        payment_status: o.payment_status,
        paid_amount: o.paid_amount || 0,
        estimated_jpy: o.estimated_jpy || 0,
      })),
      pendingTasks: {
        unpaidOrders: unpaidOrders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          amount: o.paid_amount || 0,
          due_date: o.payment_due_date,
        })),
        pendingShipOrders: pendingShipOrders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          status: o.order_status,
        })),
      },
      riskFlags,
      preferences: {
        topStores: Object.entries(storeTags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topShippingMethods: Object.entries(shippingMethods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topPaymentMethods: Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topCountries: Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      },
      timeline: timelineEvents.slice(0, 50),
    });
    
  } catch (error) {
    console.error(`[TIMING] getCustomer360Data | error: ${Date.now() - t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});