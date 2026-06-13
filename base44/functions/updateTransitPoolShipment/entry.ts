import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * updateTransitPoolShipment - 更新中转地发货信息
 * 支持 GroupBuyRequest (新) 和 ShippingPool (旧) 两种数据结构
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      request_id,
      pool_id,
      action,
      // transit fields
      transit_shipping_method,
      transit_tracking_number,
      transit_fee_jpy,
      transit_note,
      transit_image_urls,
      transit_shipped_date,
      // batch-level storage/pickup fields
      order_ids: batchOrderIds,
      storage_until,
      pickup_time_slot,
      user_email: targetUserEmail,
    } = body;
    
    // Support both new (request_id) and legacy (pool_id) parameters
    const targetId = request_id || pool_id;
    if (!targetId) {
      return Response.json({ error: 'request_id or pool_id is required' }, { status: 400 });
    }

    // ── Batch-level actions: confirm_storage_batch / confirm_pickup_batch ──────
    // These always operate on a ShippingPool (request_id == pool id for transit pools)
    if (action === 'confirm_storage_batch' || action === 'confirm_pickup_batch') {
      // Try ShippingPool first, then GroupBuyRequest
      let pool = await base44.asServiceRole.entities.ShippingPool.get(targetId).catch(() => null);
      let entityName = 'ShippingPool';
      if (!pool) {
        pool = await base44.asServiceRole.entities.GroupBuyRequest.get(targetId).catch(() => null);
        entityName = 'GroupBuyRequest';
      }
      if (!pool) return Response.json({ error: 'Pool not found' }, { status: 404 });

      // Auth: manager or admin
      const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
      if (!isAdmin && pool.transit_location_id) {
        const loc = await base44.asServiceRole.entities.TransitLocation.get(pool.transit_location_id).catch(() => null);
        if (!loc || loc.manager_email !== user.email) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      if (action === 'confirm_storage_batch') {
        // Mark each order in this batch as in_storage
        if (batchOrderIds && batchOrderIds.length > 0) {
          await Promise.all(batchOrderIds.map(orderId =>
            base44.asServiceRole.entities.Order.update(orderId, {
              order_status: 'in_storage',
              transit_storage_enabled: true,
              transit_storage_until: storage_until || null,
              transit_location_id: pool.transit_location_id,
              transit_location_name: pool.transit_location_name,
            }).catch(e => console.error('Failed to update order for storage:', e))
          ));
        }
        // Mark pool-level transit_storage_enabled if all orders are storage
        await base44.asServiceRole.entities[entityName].update(targetId, {
          transit_storage_enabled: true,
          transit_storage_until: storage_until || null,
        }).catch(() => {});

        // 发送暂存确认通知
        if (targetUserEmail) {
          try {
            await base44.asServiceRole.functions.invoke('createNotificationWithEmail', {
              user_email: targetUserEmail,
              notification_type: 'order',
              notification_subtype: 'transit_storage_confirmed',
              title: '您的包裹已在中转地暂存',
              content: `您的包裹（共 ${batchOrderIds.length} 件）已在中转地 ${pool.transit_location_name || '中转地'} 完成暂存${storage_until ? `，暂存期限至 ${storage_until}` : ''}。如需发出请在订单页操作。`,
              icon: 'Package',
              priority: 'normal',
              related_entity_type: entityName,
              related_entity_id: targetId,
              metadata: {
                pool_code: pool.pool_code || targetId,
                transit_location: pool.transit_location_name || '',
                storage_until: storage_until || '',
                order_count: batchOrderIds.length,
              }
            }).catch(e => console.error('Failed to send storage notification:', e));
          } catch (notifErr) {
            console.error('Storage notification error (non-fatal):', notifErr);
          }
        }
        return Response.json({ success: true });
      }

      if (action === 'confirm_pickup_batch') {
        // Set pickup time slot on pool (pool-level for now)
        await base44.asServiceRole.entities[entityName].update(targetId, {
          transit_pickup_enabled: true,
          transit_pickup_time_slot: pickup_time_slot || null,
          transit_pickup_admin_confirmed: true,
        }).catch(() => {});

        // 发送自取时间通知给用户
        if (targetUserEmail && pickup_time_slot) {
          try {
            await base44.asServiceRole.functions.invoke('createNotificationWithEmail', {
              user_email: targetUserEmail,
              notification_type: 'order',
              notification_subtype: 'transit_pickup_scheduled',
              title: '自取时间已约定',
              content: `中转地 ${pool.transit_location_name || '中转地'} 已为您约定自取时间：${pickup_time_slot}。请按时前往自取，并在系统中确认。`,
              icon: 'Calendar',
              priority: 'high',
              related_entity_type: entityName,
              related_entity_id: targetId,
              metadata: {
                pool_code: pool.pool_code || targetId,
                transit_location: pool.transit_location_name || '',
                pickup_time_slot: pickup_time_slot,
              }
            }).catch(e => console.error('Failed to send pickup notification:', e));
          } catch (notifErr) {
            console.error('Pickup notification error (non-fatal):', notifErr);
          }
        }
        return Response.json({ success: true });
      }
    }

    // Handle GroupBuyRequest updates (new)
    if (request_id) {
      const request = await base44.asServiceRole.entities.GroupBuyRequest.get(request_id);
      if (!request) {
        return Response.json({ error: 'Request not found' }, { status: 404 });
      }

      // Verify user is transit location manager or admin
      if (request.transit_location_id) {
        const location = await base44.asServiceRole.entities.TransitLocation.get(request.transit_location_id);
        if (location && user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
          return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
        }
      } else if (user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
      }

      // Update request with transit shipment info
      const updatedRequest = await base44.asServiceRole.entities.GroupBuyRequest.update(request_id, {
        transit_shipping_method,
        transit_tracking_number,
        transit_fee_jpy: transit_fee_jpy || 0,
        transit_note,
        transit_image_urls: transit_image_urls || [],
        transit_shipped_date: transit_shipped_date || new Date().toISOString().split('T')[0],
        transit_shipped_by: user.email
      });

      return Response.json({
        success: true,
        request: updatedRequest
      });
    }

    // Handle ShippingPool updates (legacy)
    if (pool_id) {
      const pool = await base44.asServiceRole.entities.ShippingPool.get(pool_id);
      if (!pool) {
        return Response.json({ error: 'Pool not found' }, { status: 404 });
      }

      // Verify user is transit location manager or admin
      if (pool.transit_location_id) {
        const location = await base44.asServiceRole.entities.TransitLocation.get(pool.transit_location_id);
        if (location && user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
          return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
        }
      } else if (user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
      }

      // Update pool with transit shipment info
      const updatedPool = await base44.asServiceRole.entities.ShippingPool.update(pool_id, {
        transit_shipping_method,
        transit_tracking_number,
        transit_fee_jpy: transit_fee_jpy || 0,
        transit_note,
        transit_image_urls: transit_image_urls || [],
        transit_shipped_date: transit_shipped_date || new Date().toISOString().split('T')[0],
        transit_shipped_by: user.email
      });

      // Update all orders in this pool to transit_shipped status
      if (pool.order_ids && pool.order_ids.length > 0) {
        const updatePromises = pool.order_ids.map(orderId => 
          base44.asServiceRole.entities.Order.update(orderId, {
            order_status: 'transit_shipped',
            transit_shipped_date: transit_shipped_date || new Date().toISOString().split('T')[0],
            transit_tracking_number: transit_tracking_number || '',
            transit_shipping_method: transit_shipping_method || '',
          }).catch(e => console.error(`Failed to update order ${orderId}:`, e))
        );
        await Promise.all(updatePromises);

        // 发送通知给受影响用户
        try {
          const fetchedOrders = await Promise.all(
            pool.order_ids.map(id => base44.asServiceRole.entities.Order.get(id).catch(() => null))
          );
          const validOrders = fetchedOrders.filter(Boolean);
          const affectedEmails = [...new Set(validOrders.map(o => o.user_email).filter(Boolean))];
          for (const recipientEmail of affectedEmails) {
            await base44.asServiceRole.functions.invoke('createNotificationWithEmail', {
              user_email: recipientEmail,
              notification_type: 'order',
              notification_subtype: 'transit_shipped',
              title: '您的包裹已从中转地发出',
              content: `您在中转地的包裹已发货，运单号：${transit_tracking_number || '待填写'}，运输方式：${transit_shipping_method || ''}。请留意最终收货。`,
              icon: 'Truck',
              priority: 'high',
              related_entity_type: 'ShippingPool',
              related_entity_id: pool_id,
              metadata: {
                pool_code: pool.pool_code || pool_id,
                tracking_number: transit_tracking_number || '',
                transit_method: transit_shipping_method || '',
              }
            }).catch(e => console.error('Failed to send transit notification:', e));
          }
        } catch (notifErr) {
          console.error('Notification error (non-fatal):', notifErr);
        }
      }

      return Response.json({
        success: true,
        pool: updatedPool
      });
    }

  } catch (error) {
    console.error('Error in updateTransitPoolShipment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});