import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'staff')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, order_id, actual_weight_g, shipping_method_code, destination_country } = await req.json();

    if (action === 'update_weight_and_calculate') {
      // Fetch the order
      const order = await base44.asServiceRole.entities.Order.get(order_id);
      
      if (!order || order.payment_mode !== 'fullpay_once') {
        return Response.json({ error: 'Order not found or not a one-time payment order' }, { status: 404 });
      }

      const config = order.fullpay_once_config;
      if (!config) {
        return Response.json({ error: 'One-time payment config not found' }, { status: 404 });
      }

      // Fetch shipping methods to calculate actual shipping fee
      const shippingMethodsRes = await base44.asServiceRole.functions.invoke('getTenantShippingPools', { 
        action: 'list_shipping_methods' 
      });
      const shippingMethods = shippingMethodsRes.data?.methods || [];
      
      const method = shippingMethods.find(m => m.code === (shipping_method_code || config.shipping_method_code));
      if (!method) {
        return Response.json({ error: 'Shipping method not found' }, { status: 404 });
      }

      // Calculate actual shipping fee
      let actualShippingFee = 0;
      const country = destination_country || 'CN';
      const weight = actual_weight_g || order.weight_g || 0;

      if (method.rate_mode === 'simple' && method.simple_rates) {
        const rate = method.simple_rates.find(r => r.country === country);
        if (rate) {
          const firstWeight = rate.first_weight_g || 500;
          const firstFee = rate.first_weight_fee || 0;
          const additionalUnit = rate.additional_unit_g || 500;
          const additionalFee = rate.additional_unit_fee || 0;
          
          if (weight <= firstWeight) {
            actualShippingFee = firstFee;
          } else {
            const additionalUnits = Math.ceil((weight - firstWeight) / additionalUnit);
            actualShippingFee = firstFee + (additionalUnits * additionalFee);
          }
        }
      } else if (method.rate_mode === 'detailed' && method.detailed_rates) {
        const rate = method.detailed_rates.find(r => 
          r.country === country && 
          weight >= r.weight_from_g && 
          weight <= r.weight_to_g
        );
        if (rate) {
          actualShippingFee = rate.fee || 0;
        }
      }

      // Calculate differences
      const estimatedWeight = config.user_estimated_weight_g || 0;
      const estimatedFee = config.estimated_shipping_fee_jpy || 0;
      const weightDifference = weight - estimatedWeight;
      const feeDifference = actualShippingFee - estimatedFee;
      
      // Determine settlement status
      let settlementStatus = 'settled';
      if (feeDifference > 0) {
        settlementStatus = 'needs_supplement';
      } else if (feeDifference < 0) {
        settlementStatus = 'needs_refund';
      }

      // Update the order
      const updatedOrder = await base44.asServiceRole.entities.Order.update(order_id, {
        weight_g: weight,
        shipping_method: shipping_method_code || config.shipping_method_code,
        fullpay_once_config: {
          ...config,
          user_estimated_weight_g: estimatedWeight,
          shipping_method_code: shipping_method_code || config.shipping_method_code,
          estimated_shipping_fee_jpy: estimatedFee,
          actual_shipping_fee_jpy: actualShippingFee,
          total_paid_jpy: config.total_paid_jpy,
          weight_difference_g: weightDifference,
          fee_difference_jpy: feeDifference,
          settlement_status: settlementStatus,
          updated_at: new Date().toISOString()
        }
      });

      return Response.json({
        success: true,
        order: updatedOrder,
        calculation: {
          estimated_weight_g: estimatedWeight,
          actual_weight_g: weight,
          weight_difference_g: weightDifference,
          estimated_shipping_fee_jpy: estimatedFee,
          actual_shipping_fee_jpy: actualShippingFee,
          fee_difference_jpy: feeDifference,
          settlement_status: settlementStatus
        }
      });
    }

    if (action === 'settle') {
      // Mark the order as settled after user pays supplement or receives refund
      const order = await base44.asServiceRole.entities.Order.get(order_id);
      
      if (!order || order.payment_mode !== 'fullpay_once') {
        return Response.json({ error: 'Order not found or not a one-time payment order' }, { status: 404 });
      }

      const config = order.fullpay_once_config;
      if (!config) {
        return Response.json({ error: 'One-time payment config not found' }, { status: 404 });
      }

      const updatedOrder = await base44.asServiceRole.entities.Order.update(order_id, {
        fullpay_once_config: {
          ...config,
          settlement_status: 'settled',
          settled_at: new Date().toISOString()
        }
      });

      return Response.json({
        success: true,
        order: updatedOrder
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('handleFullpayOnceSettlement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});