import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Update order weight and calculate one-time payment settlement
 * Calculates shipping fee difference and updates settlement status
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin' && user.role !== 'staff')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, weight_g, update_fullpay_settlement } = body;
    
    if (!order_id || !update_fullpay_settlement) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get the order
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only process one-time payment orders
    if (order.payment_mode !== 'fullpay_once') {
      return Response.json({ error: 'Not a one-time payment order' }, { status: 400 });
    }

    const config = order.fullpay_once_config;
    if (!config) {
      return Response.json({ error: 'No one-time payment config found' }, { status: 400 });
    }

    // Update weight
    if (weight_g !== undefined) {
      await base44.asServiceRole.entities.Order.update(order_id, { weight_g: parseFloat(weight_g) });
    }

    const actualWeight = parseFloat(weight_g) || order.weight_g || 0;
    const estimatedWeight = config.user_estimated_weight_g || 0;
    const estimatedFee = config.estimated_shipping_fee_jpy || 0;
    const weightDiff = actualWeight - estimatedWeight;
    
    // Calculate fee difference based on weight difference
    // Get shipping method rates
    let feeDiff = 0;
    if (weightDiff !== 0 && config.shipping_method_code) {
      const shippingMethods = await base44.asServiceRole.entities.ShippingMethod.filter({});
      const method = shippingMethods.find(m => m.code === config.shipping_method_code);
      
      if (method) {
        // Recalculate shipping fee with actual weight
        let actualFee = 0;
        const country = order.shipping_address_country || 'CN'; // Fallback to China
        
        if (method.rate_mode === 'simple' && method.simple_rates) {
          const rate = method.simple_rates.find(r => r.country === country);
          if (rate) {
            const firstWeight = rate.first_weight_g || 500;
            const firstFee = rate.first_weight_fee || 0;
            const additionalUnit = rate.additional_unit_g || 500;
            const additionalFee = rate.additional_unit_fee || 0;
            
            if (actualWeight <= firstWeight) {
              actualFee = firstFee;
            } else {
              const additionalUnits = Math.ceil((actualWeight - firstWeight) / additionalUnit);
              actualFee = firstFee + (additionalUnits * additionalFee);
            }
          }
        } else if (method.rate_mode === 'detailed' && method.detailed_rates) {
          const rate = method.detailed_rates.find(r => 
            r.country === country && 
            actualWeight >= r.weight_from_g && 
            actualWeight <= r.weight_to_g
          );
          if (rate) {
            actualFee = rate.fee || 0;
          }
        }
        
        feeDiff = Math.round(actualFee - estimatedFee);
      }
    }

    // Determine settlement status
    let settlementStatus = 'settled';
    if (feeDiff > 0) {
      settlementStatus = 'needs_supplement';
    } else if (feeDiff < 0) {
      settlementStatus = 'needs_refund';
    }

    // Update order with settlement info
    const updatedConfig = {
      ...config,
      actual_weight_g: actualWeight,
      weight_difference_g: weightDiff,
      fee_difference_jpy: feeDiff,
      settlement_status: settlementStatus,
      settled_at: settlementStatus === 'settled' ? new Date().toISOString() : undefined
    };

    await base44.asServiceRole.entities.Order.update(order_id, {
      fullpay_once_config: updatedConfig
    });

    return Response.json({
      success: true,
      settlement: {
        estimatedWeight,
        actualWeight,
        weightDiff,
        estimatedFee,
        feeDiff,
        settlementStatus
      }
    });

  } catch (error) {
    console.error('settleFullpayOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});