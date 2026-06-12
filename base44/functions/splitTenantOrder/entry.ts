import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * splitTenantOrder
 * 
 * Called by admin when they mark a split-marker order as "purchased".
 * This function:
 *  1. Updates the parent order to order_status="purchased" with " - 00" suffix on order_number
 *  2. Creates N child orders (one per split section), numbered " - 01", " - 02", etc.
 *  3. Divides estimated_jpy, prepayment_amount, paid_amount equally among children
 * 
 * Body params:
 *  - orderId: the parent order ID
 *  - purchaseScreenshotUrl: optional screenshot URL
 *  - adminNote: optional admin note
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'platform_admin' && user.role !== 'tenant_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { orderId, purchaseScreenshotUrl, adminNote } = body;

    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 });

    // Fetch the parent order (verify tenant ownership via user session)
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) return Response.json({ error: 'User not found' }, { status: 404 });
    const tenantId = userRecords[0].tenant_id;

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // Tenant isolation check
    if (order.tenant_id !== tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!order.has_split_marker || !order.split_sections || order.split_sections.length < 2) {
      return Response.json({ error: 'Order has no split marker' }, { status: 400 });
    }

    const sections = order.split_sections;
    const n = sections.length;

    // Chinese ordinal suffixes
    const ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

    // Divide financial amounts equally (round JPY)
    const divideJpy = (total) => {
      if (!total || total === 0) return Array(n).fill(0);
      const base = Math.floor(total / n);
      const remainder = Math.round(total) - base * n;
      return Array.from({ length: n }, (_, i) => i === 0 ? base + remainder : base);
    };

    const jpyAmounts = divideJpy(order.estimated_jpy);
    const prepayAmounts = divideJpy(order.prepayment_amount_jpy || order.prepayment_amount);
    const paidAmounts = divideJpy(order.paid_amount);
    // 尾款继承：按比例分配到子订单，父订单清零防止重复收取
    const balanceAmounts = divideJpy(order.order_balance_settled ? 0 : order.order_balance_due_jpy);
    const surchargeAmounts = divideJpy(order.order_balance_settled ? 0 : order.order_balance_surcharge_jpy);

    const today = new Date().toISOString().split('T')[0];

    // 1. Update parent order: rename to " - 00", mark purchased
    const parentUpdates = {
      order_status: 'purchased',
      order_number: `${order.order_number} - 00`,
      purchased_date: today,
      split_total: n,
      split_index: -1, // -1 = the combined purchase order
    };
    if (purchaseScreenshotUrl) parentUpdates.purchase_screenshot_url = purchaseScreenshotUrl;
    if (adminNote !== undefined) parentUpdates.admin_note = adminNote;
    // 尾款已转移至子订单，父订单（合并采购记录）清零并标记已结，防止重复收取
    parentUpdates.order_balance_due_jpy = 0;
    parentUpdates.order_balance_surcharge_jpy = 0;
    parentUpdates.order_balance_settled = true;

    await base44.asServiceRole.entities.Order.update(orderId, parentUpdates);

    // 2. Create child orders
    const childOrders = [];
    for (let i = 0; i < n; i++) {
      const ordinal = ORDINALS[i] || String(i + 1);
      const childNumber = `${order.order_number} - ${String(i + 1).padStart(2, '0')}`;
      const childName = `${order.product_name} - 之${ordinal}`;

      const childData = {
        // Inherit most fields from parent
        tenant_id: order.tenant_id,
        user_email: order.user_email,
        user_name: order.user_name,
        product_name: childName,
        product_description: order.product_description,
        product_image_url: order.product_image_url,
        order_number: childNumber,
        order_status: 'purchased',
        payment_status: order.payment_status,
        payment_mode: order.payment_mode,
        payment_method: order.payment_method,
        online_store_tag: order.online_store_tag,
        online_store_tag_color: order.online_store_tag_color,
        service_fee_rate: order.service_fee_rate,
        user_note: order.user_note,
        purchased_date: today,
        purchase_screenshot_url: purchaseScreenshotUrl || order.purchase_screenshot_url || '',
        // Divided amounts
        estimated_jpy: jpyAmounts[i],
        prepayment_amount: prepayAmounts[i],
        prepayment_amount_jpy: prepayAmounts[i],
        prepayment_currency: order.prepayment_currency || 'JPY',
        paid_amount: paidAmounts[i],
        // 尾款继承（随运费收取）
        order_balance_due_jpy: balanceAmounts[i],
        order_balance_surcharge_jpy: surchargeAmounts[i],
        order_balance_surcharge_rate: order.order_balance_surcharge_rate || 0,
        order_balance_settled: false,
        quantity: 1,
        weight_g: 100,
        // Split section URL
        product_url: sections[i],
        // Split tracking
        parent_order_id: orderId,
        split_index: i + 1,
        split_total: n,
        has_split_marker: false,
        // Inherit addons divided by n (simplified: carry to first child only)
        selected_addons: i === 0 ? (order.selected_addons || []) : [],
        selected_addon_ids: i === 0 ? (order.selected_addon_ids || []) : [],
      };

      const child = await base44.asServiceRole.entities.Order.create(childData);
      childOrders.push(child);
    }

    return Response.json({
      success: true,
      parent_order_number: `${order.order_number} - 00`,
      child_count: n,
      children: childOrders.map(c => ({ id: c.id, order_number: c.order_number, product_name: c.product_name })),
    });

  } catch (error) {
    console.error('splitTenantOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});