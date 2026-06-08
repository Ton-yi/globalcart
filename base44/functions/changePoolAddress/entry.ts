import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      pool_id,
      new_address
    } = await req.json();
    
    if (!pool_id || !new_address) {
      return Response.json({ error: 'pool_id and new_address are required' }, { status: 400 });
    }

    const pool = await base44.entities.ShippingPool.get(pool_id);
    if (!pool) {
      return Response.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify user is creator
    if (user.email !== pool.creator_email && user.role !== 'admin' && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Creator only' }, { status: 403 });
    }

    // Check if address change is allowed
    const currentCount = pool.address_change_count || 0;
    const maxChanges = pool.max_address_changes ?? 1; // Default 1

    if (currentCount >= maxChanges) {
      return Response.json({ 
        error: `地址更改次数已达上限 (${maxChanges}次)`,
        current_count: currentCount,
        max_changes: maxChanges
      }, { status: 400 });
    }

    // Update address in pool
    const updateData = {
      address_change_count: currentCount + 1,
      recipient_name: new_address.recipient_name,
      recipient_phone: new_address.phone,
      address_line1: new_address.addr1,
      address_line2: new_address.addr2,
      address_line3: new_address.addr3,
      city: new_address.city,
      state: new_address.state,
      postal_code: new_address.postal_code,
      destination_country: new_address.country
    };

    await base44.entities.ShippingPool.update(pool_id, updateData);

    return Response.json({ 
      success: true,
      new_count: currentCount + 1,
      remaining: maxChanges - (currentCount + 1)
    });
  } catch (error) {
    console.error('Error in changePoolAddress:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});