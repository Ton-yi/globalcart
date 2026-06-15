/**
 * getLocalShippingOptions
 * 获取本地运输方式选项（日本国内运输）和自提点列表
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户所在租户
    const tenantContext = await base44.functions.invoke('getTenantContext', {});
    const tenantId = tenantContext.data?.tenant_id;

    if (!tenantId) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 获取本地运输方式（从 SiteSettings 中的 local_shipping_methods_config 字段）
    const settings = await base44.entities.SiteSettings.filter({
      tenant_id: tenantId,
      key: 'local_shipping_methods_config'
    });

    let shippingMethods = [];
    if (settings && settings.length > 0) {
      try {
        const methodsData = JSON.parse(settings[0].value);
        shippingMethods = Array.isArray(methodsData) ? methodsData : [];
      } catch {
        shippingMethods = [];
      }
    }

    // 获取自提点列表
    const pickupLocations = await base44.entities.PickupLocation.filter({
      tenant_id: tenantId,
      is_active: true
    });

    // 按 sort_order 排序
    const sortedPickupLocations = (pickupLocations || []).sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    return Response.json({
      shippingMethods,
      pickupLocations: sortedPickupLocations
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});