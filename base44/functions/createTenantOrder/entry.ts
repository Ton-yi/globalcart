import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Create an order with automatic tenant_id assignment from authenticated user
 * Frontend must NOT send tenant_id; it will be derived from the authenticated session
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Remove any tenant_id from request body (security: never trust client)
    delete body.tenant_id;

    // Get user record to find tenant_id
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // For platform admins, tenant_id must be provided in body; for others it's auto-assigned
    const assignedTenantId = user.role === 'platform_admin' && body.tenant_id 
      ? body.tenant_id 
      : tenantId;

    if (!assignedTenantId) {
      return Response.json({ error: 'Cannot determine tenant for order creation' }, { status: 400 });
    }

    // Create order with tenant_id
    // Also snapshot the original JPY prepayment amount for reference
    const orderData = {
      ...body,
      tenant_id: assignedTenantId,
      // Always store the original JPY amount separately for display/accounting
      ...(body.prepayment_amount ? { prepayment_amount_jpy: parseFloat(body.prepayment_amount) } : {}),
    };

    const order = await base44.asServiceRole.entities.Order.create(orderData);

    // === Credit accounting: if order uses credit payment, check limit and update balance ===
    if (body.payment_mode === 'credit') {
      const creditAmount = parseFloat(body.estimated_jpy) || 0;
      const serviceFeeRate = parseFloat(body.service_fee_rate) || 10;
      const addonTotal = (body.selected_addons || []).reduce((sum, a) => {
        return sum + (parseFloat(a.fee) || 0);
      }, 0);
      const totalJpy = Math.round(creditAmount + creditAmount * (serviceFeeRate / 100) + addonTotal);

      const currentUser = userRecord[0];
      const currentBalance = parseFloat(currentUser.credit_balance_jpy) || 0;
      const creditLimit = parseFloat(currentUser.credit_limit_jpy) || 0;
      const availableCredit = Math.max(0, creditLimit - currentBalance);

      // If this order would exceed the credit limit, downgrade to deferred payment
      if (totalJpy > availableCredit) {
        // Update the order to deferred payment mode
        await base44.asServiceRole.entities.Order.update(order.id, {
          payment_mode: 'deferred',
          order_status: 'payment_pending',
          payment_status: 'awaiting_payment',
        });
        const updatedOrder = { ...order, payment_mode: 'deferred', order_status: 'payment_pending', payment_status: 'awaiting_payment' };
        return Response.json({
          success: true,
          order: updatedOrder,
          credit_downgraded: true,
          credit_downgrade_reason: `记账额度不足：本次需记账 ¥${totalJpy.toLocaleString()} JPY，剩余可用额度仅 ¥${availableCredit.toLocaleString()} JPY，订单已自动改为后付款方式。`,
          required_jpy: totalJpy,
          available_credit_jpy: availableCredit,
        });
      }

      // Credit within limit — update balance
      if (totalJpy > 0) {
        const newBalance = currentBalance + totalJpy;
        const balanceUpdate = { credit_balance_jpy: newBalance };

        // If this is the first time they're incurring debt, set start date + next due date
        if (currentBalance === 0) {
          const now = new Date();
          balanceUpdate.credit_start_date = now.toISOString().slice(0, 10);
          const cycle = currentUser.credit_cycle;
          if (cycle === 'weekly') {
            const nextDue = new Date(now);
            nextDue.setDate(now.getDate() + 7);
            balanceUpdate.credit_next_due_date = nextDue.toISOString().slice(0, 10);
          } else if (cycle === 'monthly') {
            const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            balanceUpdate.credit_next_due_date = nextDue.toISOString().slice(0, 10);
          }
        }

        await base44.asServiceRole.entities.User.update(currentUser.id, balanceUpdate);
      }
    }

    return Response.json({ 
      success: true,
      order 
    });

  } catch (error) {
    console.error('createTenantOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});