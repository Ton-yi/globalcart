import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * One-time migration function to initialize multi-tenant system
 * Creates a default tenant and assigns all existing users and data to it
 * 
 * This function should be called once by a platform admin
 * CAUTION: Do not run multiple times without checking existing state
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Only platform admins can run migrations' }, { status: 403 });
    }

    // Check if migration already done by looking for existing tenants
    const existingTenants = await base44.asServiceRole.entities.Tenant.list();
    if (existingTenants && existingTenants.length > 0) {
      return Response.json({ 
        status: 'already_migrated', 
        message: 'Default tenant already exists',
        tenants: existingTenants 
      });
    }

    // Create default tenant
    const defaultTenant = await base44.asServiceRole.entities.Tenant.create({
      name: 'Default Tenant',
      code: 'default',
      branding_name: 'Default Tenant',
      timezone: 'Asia/Tokyo',
      is_active: true
    });

    if (!defaultTenant || !defaultTenant.id) {
      return Response.json({ error: 'Failed to create default tenant' }, { status: 500 });
    }

    const defaultTenantId = defaultTenant.id;

    // Fetch all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const migratedCount = { users: 0, orders: 0, pools: 0, prefs: 0, locations: 0, methods: 0, templates: 0, rules: 0, addons: 0, settings: 0, requests: 0, edits: 0 };

    // Assign all users to default tenant
    for (const u of (allUsers || [])) {
      if (!u.tenant_id) {
        await base44.asServiceRole.entities.User.update(u.id, { tenant_id: defaultTenantId });
        migratedCount.users++;
      }
    }

    // Migrate all tenant-owned records
    const entityNames = [
      'Order', 'ShippingPool', 'ShippingRequest', 'UserPreference',
      'TransitLocation', 'ShippingMethod', 'TransitShippingMethod',
      'ItemSizeTemplate', 'OnlineStoreTagRule', 'AddonOption',
      'SiteSettings', 'ShippingEditRequest'
    ];

    for (const entityName of entityNames) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list();
        for (const record of (records || [])) {
          if (!record.tenant_id) {
            await base44.asServiceRole.entities[entityName].update(record.id, { tenant_id: defaultTenantId });
            migratedCount[entityName.charAt(0).toLowerCase() + entityName.slice(1)] = 
              (migratedCount[entityName.charAt(0).toLowerCase() + entityName.slice(1)] || 0) + 1;
          }
        }
      } catch (err) {
        console.warn(`Failed to migrate ${entityName}:`, err.message);
      }
    }

    return Response.json({
      status: 'success',
      message: 'Tenant migration completed',
      default_tenant: defaultTenant,
      migrated_records: migratedCount
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});