import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Unified Shipping Pool Creation Engine
 *
 * Accepts a standardized shipment_payload and handles all cases:
 *   - join_existing: join an existing pool (transit or direct)
 *   - official_pool (specific target): join a specific official pool
 *   - official_pool (default): stage order for admin assignment
 *   - new_pool: create a brand new ShippingPool
 *
 * Called by:
 *   - UserNotifyShipmentModal (user manual notify)
 *   - CreateShippingPoolModal (manual batch pool creation)
 *   - autoCreatePreShipmentPool (automatic trigger on in_warehouse)
 *
 * Payload schema:
 * {
 *   order_ids: string[],          // required - one or more order IDs
 *   consType: string,             // "" | "transit" | "other" | "official_pool"
 *   shipping_method: string,
 *   scheduled_ship_date: string,
 *   user_note: string,
 *   pool_title: string,
 *   address: {                    // final destination address object
 *     recipient_name, country, addr1, addr2, addr3, state, phone
 *   } | null,
 *   transit_location_id: string,
 *   transit_location_name: string,
 *   transit_location_country: string,
 *   transit_shipping_method_id: string,
 *   transit_shipping_method_name: string,
 *   selected_addon_ids: string[],
 *   selected_addons: object[],
 *   target_pool_id: string,       // for join_existing or specific official pool
 *   join_existing_pool: boolean,  // true = join existing user/transit pool
 *   is_private: boolean,
 *   shared_with_emails: string[],
 *   customs_declaration: object | null,
 *   // fullpay_once config — stored but not processed here (handled separately)
 *   fullpay_once_config: object | null,
 * }
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support service-role calls (e.g. from autoCreatePreShipmentPool) that pass
    // service_user_email + service_user_name instead of a real user token.
    let user = null;
    if (body.service_user_email) {
      // Caller is a trusted backend function; skip auth.me()
      user = { email: body.service_user_email, full_name: body.service_user_name || body.service_user_email };
    } else {
      user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_ids, payload } = body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return Response.json({ error: 'Missing order_ids' }, { status: 400 });
    }
    if (!payload) {
      return Response.json({ error: 'Missing payload' }, { status: 400 });
    }

    // Resolve tenant from the authenticated user
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id;
    if (!tenantId) return Response.json({ error: 'No tenant assigned' }, { status: 403 });

    // Load all orders and verify ownership + tenant
    const orders = [];
    for (const order_id of order_ids) {
      const found = await base44.asServiceRole.entities.Order.filter({ id: order_id }).catch(() => []);
      const order = found?.[0];
      if (!order || order.tenant_id !== tenantId) {
        return Response.json({ error: `Order not found: ${order_id}` }, { status: 404 });
      }
      orders.push(order);
    }

    const {
      consType = '',
      shipping_method = '',
      scheduled_ship_date = '',
      user_note = '',
      pool_title = '',
      address = null,
      transit_location_id = '',
      transit_location_name = '',
      transit_location_country = '',
      transit_shipping_method_id = '',
      transit_shipping_method_name = '',
      selected_addon_ids = [],
      selected_addons = [],
      target_pool_id = '',
      join_existing_pool = false,
      is_private = false,
      shared_with_emails = [],
      customs_declaration = null,
      // fullpay_once_config is stored for later processing, not used here
      fullpay_once_config = null,
    } = payload;

    // Normalize special transit method IDs
    const normalizeMethodId = (id) => {
      if (id === 'pickup') return '__pickup__';
      if (id === 'storage') return '__storage__';
      return id || '';
    };
    const normalizedTransitMethodId = normalizeMethodId(transit_shipping_method_id);
    const isPickupOrStorage = normalizedTransitMethodId === '__pickup__' || normalizedTransitMethodId === '__storage__';

    // Helper: verify pool exists, belongs to tenant, and is not shipped
    const checkPool = async (poolId) => {
      if (!poolId) return { exists: false };
      const pools = await base44.asServiceRole.entities.ShippingPool.filter({ id: poolId }).catch(() => []);
      const pool = pools?.[0];
      if (!pool || pool.tenant_id !== tenantId) return { exists: false };
      return {
        exists: true,
        pool,
        isShipped: pool.status === 'shipped' || pool.status === 'delivered',
        isLocked: ['awaiting_payment', 'awaiting_payment_confirmation', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'].includes(pool.status),
      };
    };

    // Build per_user_groups entry for an order being added to a pool
    const buildOrderEntry = (order) => ({
      order_id: order.id,
      note: order.product_name || '',
      image_urls: order.product_image_url ? [order.product_image_url] : [],
      selected_addon_ids: order.selected_addon_ids || [],
      selected_addons: order.selected_addons || [],
      override_final_address: null,
      use_group_address: true,
      transit_shipping_method_id: normalizedTransitMethodId,
      transit_shipping_method_name: transit_shipping_method_name || '',
      transit_note: user_note || '',
    });

    // Build per_user_groups: merges orders into existing group if same user+method, else creates new group
    const buildUpdatedPerUserGroups = (existingGroups, ordersToAdd) => {
      let updatedGroups = [...(existingGroups || [])];
      const addr = address || {};

      for (const order of ordersToAdd) {
        const newEntry = buildOrderEntry(order);
        const existingIdx = updatedGroups.findIndex(g => {
          if (g.user_email !== order.user_email) return false;
          const gMethodId = normalizeMethodId(g.transit_shipping_method_id);
          return gMethodId === normalizedTransitMethodId;
        });

        if (existingIdx >= 0) {
          updatedGroups[existingIdx] = {
            ...updatedGroups[existingIdx],
            order_entries: [...(updatedGroups[existingIdx].order_entries || []), newEntry],
          };
        } else {
          updatedGroups.push({
            user_email: order.user_email,
            user_name: order.user_name || order.user_email,
            group_label: order.user_name || order.user_email,
            note: user_note || '',
            image_urls: [],
            transit_shipping_method_id: normalizedTransitMethodId,
            transit_shipping_method_name: transit_shipping_method_name || '',
            selected_addon_ids: selected_addon_ids || [],
            selected_addons: selected_addons || [],
            group_final_address: isPickupOrStorage ? {} : {
              recipient_name: addr.recipient_name || '',
              country: addr.country || '',
              addr1: addr.addr1 || '',
              addr2: addr.addr2 || '',
              addr3: addr.addr3 || '',
              state: addr.state || '',
              phone: addr.phone || '',
            },
            order_entries: [newEntry],
          });
        }
      }
      return updatedGroups;
    };

    // Build per_user_groups for official pool (no transit method grouping, group by user only)
    const buildOfficialPoolPerUserGroups = (existingGroups, ordersToAdd) => {
      let updatedGroups = [...(existingGroups || [])];
      const addr = address || {};

      for (const order of ordersToAdd) {
        const newEntry = buildOrderEntry(order);
        const existingIdx = updatedGroups.findIndex(g => g.user_email === order.user_email);

        if (existingIdx >= 0) {
          updatedGroups[existingIdx] = {
            ...updatedGroups[existingIdx],
            order_entries: [...(updatedGroups[existingIdx].order_entries || []), newEntry],
          };
        } else {
          updatedGroups.push({
            user_email: order.user_email,
            user_name: order.user_name || order.user_email,
            group_label: order.user_name || order.user_email,
            note: user_note || '',
            image_urls: [],
            transit_shipping_method_id: transit_shipping_method_id || '',
            transit_shipping_method_name: transit_shipping_method_name || '',
            selected_addon_ids: selected_addon_ids || [],
            selected_addons: selected_addons || [],
            group_final_address: {
              recipient_name: addr.recipient_name || '',
              country: addr.country || '',
              addr1: addr.addr1 || '',
              addr2: addr.addr2 || '',
              addr3: addr.addr3 || '',
              state: addr.state || '',
              phone: addr.phone || '',
            },
            order_entries: [newEntry],
          });
        }
      }
      return updatedGroups;
    };

    // Update orders status and pool association
    const markOrdersAsNotified = async (orders, poolId, extraOrderFields = {}) => {
      for (const order of orders) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          order_status: 'notified_shipment',
          consolidation_pool_id: poolId,
          ...(customs_declaration ? { customs_declaration } : {}),
          ...extraOrderFields,
        });
      }
    };

    // ----------------------------------------------------------------
    // CASE 1: Join existing pool (direct or transit)
    // ----------------------------------------------------------------
    if (join_existing_pool && target_pool_id) {
      const { exists, pool, isShipped, isLocked } = await checkPool(target_pool_id);
      if (!exists) return Response.json({ error: 'Pool not found' }, { status: 404 });

      if (isShipped) {
        // Notify user that pool is already shipped
        for (const order of orders) {
          await base44.asServiceRole.entities.Order.update(order.id, {
            messages: [...(order.messages || []), {
              id: `shipped_${Date.now()}`, from: '系统通知', from_email: '__system__', role: 'admin',
              content: `您选择的发货申请 ${pool.pool_code} 已发出，操作已取消。`,
              timestamp: new Date().toISOString(),
            }],
            unread_roles: [...new Set([...(order.unread_roles || []), 'user'])],
          });
        }
        return Response.json({ skipped: true, reason: 'pool_shipped', pool_code: pool.pool_code });
      }
      if (isLocked) {
        return Response.json({ error: 'Pool is locked' }, { status: 403 });
      }

      const updatedPerUserGroups = buildUpdatedPerUserGroups(pool.per_user_groups, orders);
      const totalAddedWeight = orders.reduce((s, o) => s + (o.weight_g || 0), 0);
      const addedOrderIds = orders.map(o => o.id);
      const addedOrderNames = orders.map(o => o.product_name).filter(Boolean);

      await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
        order_ids: [...new Set([...(pool.order_ids || []), ...addedOrderIds])],
        order_names: [...(pool.order_names || []), ...addedOrderNames].filter(Boolean),
        total_weight_g: (pool.total_weight_g || 0) + totalAddedWeight,
        per_user_groups: updatedPerUserGroups,
      });
      await markOrdersAsNotified(orders, pool.id);

      console.log(`[createShippingPool] Joined existing pool ${pool.pool_code} | ${Date.now()-t0}ms`);
      return Response.json({ success: true, pool_id: pool.id, pool_code: pool.pool_code, joined_existing: true });
    }

    // ----------------------------------------------------------------
    // CASE 2: Official pool — specific target
    // ----------------------------------------------------------------
    if (consType === 'official_pool' && target_pool_id) {
      const { exists, pool, isShipped } = await checkPool(target_pool_id);
      if (!exists) return Response.json({ error: 'Official pool not found' }, { status: 404 });

      if (isShipped) {
        for (const order of orders) {
          await base44.asServiceRole.entities.Order.update(order.id, {
            messages: [...(order.messages || []), {
              id: `official_shipped_${Date.now()}`, from: '系统通知', from_email: '__system__', role: 'admin',
              content: `您选择的官方拼邮池 ${pool.pool_code} 已发出，已改为默认匹配。`,
              timestamp: new Date().toISOString(),
            }],
            unread_roles: [...new Set([...(order.unread_roles || []), 'user'])],
          });
        }
        return Response.json({ skipped: true, reason: 'official_pool_shipped', reset_to_default: true });
      }

      const updatedPerUserGroups = buildOfficialPoolPerUserGroups(pool.per_user_groups, orders);
      const totalAddedWeight = orders.reduce((s, o) => s + (o.weight_g || 0), 0);
      const addedOrderIds = orders.map(o => o.id);
      const addedOrderNames = orders.map(o => o.product_name).filter(Boolean);

      await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
        order_ids: [...new Set([...(pool.order_ids || []), ...addedOrderIds])],
        order_names: [...(pool.order_names || []), ...addedOrderNames].filter(Boolean),
        total_weight_g: (pool.total_weight_g || 0) + totalAddedWeight,
        per_user_groups: updatedPerUserGroups,
      });
      await markOrdersAsNotified(orders, pool.id);

      console.log(`[createShippingPool] Joined official pool ${pool.pool_code} | ${Date.now()-t0}ms`);
      return Response.json({ success: true, pool_id: pool.id, pool_code: pool.pool_code, is_official_pool: true });
    }

    // ----------------------------------------------------------------
    // CASE 3: Official pool — default match (stage for admin assignment)
    // ----------------------------------------------------------------
    if (consType === 'official_pool' && !target_pool_id) {
      for (const order of orders) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          order_status: 'notified_shipment',
          ...(customs_declaration ? { customs_declaration } : {}),
        });
      }
      console.log(`[createShippingPool] Staged for official pool default match | ${Date.now()-t0}ms`);
      return Response.json({ success: true, is_staging: true, is_official_pool: true });
    }

    // ----------------------------------------------------------------
    // CASE 4: Create new pool
    // ----------------------------------------------------------------

    // Duplicate prevention: check if any order is already in a pool
    for (const order of orders) {
      if (order.consolidation_pool_id) {
        console.log(`[createShippingPool] Order ${order.id} already has pool, skipping`);
        return Response.json({ skipped: true, reason: 'order_already_has_pool', pool_id: order.consolidation_pool_id });
      }
    }

    // Resolve transit location if needed
    const transitLoc = transit_location_id
      ? (await base44.asServiceRole.entities.TransitLocation.filter({ id: transit_location_id }).catch(() => []))?.[0]
      : null;

    const prefix = consType === 'transit' && transitLoc?.code_prefix
      ? transitLoc.code_prefix.toUpperCase()
      : 'AAA';

    // Generate unique pool_code
    const generatePoolCode = async (prefix, tenantId) => {
      const allPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
      const prefixPools = (allPools || []).filter(p => p.pool_code?.startsWith(prefix));
      const maxSeq = prefixPools.reduce((max, p) => {
        const seq = parseInt(p.pool_code.slice(prefix.length), 10);
        return isNaN(seq) ? max : Math.max(max, seq);
      }, 0);
      return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
    };

    let pool_code = await generatePoolCode(prefix, tenantId);
    let retryCount = 0;
    while (retryCount < 3) {
      const existing = (await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId, pool_code }).catch(() => []))?.[0];
      if (!existing) break;
      retryCount++;
      const currentSeq = parseInt(pool_code.slice(prefix.length), 10);
      pool_code = `${prefix}${String(currentSeq + 1).padStart(5, '0')}`;
    }

    const addr = address || {};
    const destinationCountry = consType === 'transit'
      ? (transit_location_country || transitLoc?.country || addr.country || '')
      : (addr.country || '');

    const totalWeight = orders.reduce((s, o) => s + (o.weight_g || 0), 0);
    const perUserGroups = buildUpdatedPerUserGroups([], orders);

    const pool = await base44.asServiceRole.entities.ShippingPool.create({
      tenant_id: tenantId,
      pool_code,
      title: pool_title || '',
      shipping_method: shipping_method || '',
      scheduled_ship_date: scheduled_ship_date === '__asap__' ? '' : (scheduled_ship_date || ''),
      transit_location_id: transit_location_id || '',
      transit_location_name: transitLoc?.name || transit_location_name || '',
      transit_shipping_method_id: normalizedTransitMethodId || '',
      transit_shipping_method_name: transit_shipping_method_name || '',
      user_note: user_note || '',
      consolidation_type: consType || '',
      order_ids: orders.map(o => o.id),
      order_names: orders.map(o => o.product_name).filter(Boolean),
      creator_email: user.email,
      creator_name: user.full_name || user.email,
      is_admin_created: false,
      is_private: is_private || false,
      shared_with_emails: shared_with_emails || [],
      total_weight_g: totalWeight,
      status: 'pending',
      destination_country: destinationCountry,
      recipient_name: addr.recipient_name || '',
      address_line1: addr.addr1 || '',
      address_line2: addr.addr2 || '',
      selected_addon_ids: selected_addon_ids || [],
      selected_addons: selected_addons || [],
      per_user_groups: perUserGroups,
    });

    await markOrdersAsNotified(orders, pool.id);

    console.log(`[createShippingPool] Created new pool ${pool_code} for ${orders.length} order(s) | ${Date.now()-t0}ms`);
    return Response.json({ success: true, pool_id: pool.id, pool_code });

  } catch (error) {
    console.error('createShippingPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});