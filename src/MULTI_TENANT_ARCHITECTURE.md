# Multi-Tenant Architecture Implementation Guide

## Overview

This system has been retrofitted to support a shared-codebase, shared-database multi-tenant architecture. Each user belongs to exactly one tenant, and all business data is properly isolated by `tenant_id`.

## Key Principles

1. **Never trust tenant_id from the client** - Always derive it from the authenticated user session
2. **All tenant-owned data must include tenant_id** - This is stored automatically by backend functions
3. **Frontend must not send tenant_id** - Tenant context is resolved server-side only
4. **Every query must filter by tenant** - List, detail, update, delete all require tenant verification

## Tenant-Owned Data

The following entities are tenant-scoped and include `tenant_id`:

### Core Business Data
- **Order** - Customer orders and shipments
- **ShippingPool** - Consolidated shipping requests
- **ShippingRequest** - Individual shipping details
- **ShippingEditRequest** - Shipping parameter modification requests

### User & Preferences
- **User** - User records with role and tenant assignment
- **UserPreference** - User-specific settings and saved addresses

### Configuration
- **ItemSizeTemplate** - Item size categories and handling fees
- **OnlineStoreTagRule** - Rules for auto-tagging orders by store
- **ShippingMethod** - Domestic/international shipping methods
- **TransitShippingMethod** - Transit location shipping methods
- **TransitLocation** - International consolidation locations
- **AddonOption** - Optional services (order and shipping add-ons)

### System Settings
- **SiteSettings** - Tenant-specific configuration (fees, rates, etc.)
- **Announcement** - Tenant-specific announcements (platform-wide if tenant_id is null)

## User Roles and Permissions

### Role Hierarchy
1. **platform_admin** - Can access all tenants and data globally
2. **tenant_admin** - Can manage all data within their assigned tenant
3. **staff** - Can view and modify operational data within their tenant
4. **user** - Regular tenant user with personal order access

### Permission Rules

| Action | Platform Admin | Tenant Admin | Staff | User |
|--------|---|---|---|---|
| View all tenant data | ✓ | ✓ | ✓ | ✗ |
| View own orders | ✓ | ✓ | ✓ | ✓ |
| Create orders | ✓ | ✓ | ✓ | ✓ |
| Edit own orders | ✓ | ✓ | ✓ | ✓ |
| Edit others' orders | ✓ | ✓ | ✓ | ✗ |
| Manage tenant settings | ✓ | ✓ | ✗ | ✗ |
| Cross-tenant access | ✓ | ✗ | ✗ | ✗ |

## Backend Functions (Safe Tenant-Aware APIs)

Use these functions from the frontend for safe, tenant-isolated operations:

### Authentication & Context
- **getTenantContext** - Get current user's tenant info and permissions
- **initializeTenantMigration** - One-time migration to set up default tenant (platform admin only)

### Data Queries
- **getTenantOrders** - List orders with proper tenant/user filtering
- **getTenantShippingPools** - List shipping pools with visibility rules
- **getTenantSettings** - Get tenant configuration
- **getTenantConfigData** - Get all tenant config (templates, rules, methods, etc.)

### Data Creation & Modification
- **createTenantOrder** - Create order with automatic tenant_id assignment
- **updateTenantOrder** - Update order with tenant verification
- **generateAlipayPaymentLink** - Generate payment with tenant isolation
- **listNonAdminUsers** - List users for sharing (same tenant only)

## Frontend Implementation

### 1. Load Tenant Context on App Init

```javascript
import { base44 } from '@/api/base44Client';

// In your main App component or layout
useEffect(() => {
  const getTenant = async () => {
    const res = await base44.functions.invoke('getTenantContext', {});
    setTenantContext(res.data);
    setUser(res.data.user);
  };
  getTenant();
}, []);
```

### 2. Use Backend Functions for Data Access

✓ **DO THIS** (safe, tenant-isolated):
```javascript
const res = await base44.functions.invoke('getTenantOrders', {});
const orders = res.data.orders;
```

✗ **DON'T DO THIS** (bypasses tenant isolation):
```javascript
const orders = await base44.entities.Order.list();
```

### 3. Pass Data via Backend Functions for Creation

✓ **DO THIS**:
```javascript
const res = await base44.functions.invoke('createTenantOrder', {
  product_name: 'Item',
  quantity: 1
  // tenant_id is NOT sent - it's auto-assigned server-side
});
```

✗ **DON'T DO THIS**:
```javascript
await base44.entities.Order.create({
  product_name: 'Item',
  quantity: 1,
  tenant_id: '...' // NEVER send tenant_id from client
});
```

## Migration from Single-Tenant to Multi-Tenant

### Step 1: Create Entities
All entity schemas have been updated with `tenant_id`. The database will auto-create tables.

### Step 2: Run Migration (Platform Admin Only)
```javascript
// Call once by platform admin
const res = await base44.functions.invoke('initializeTenantMigration', {});
console.log(res.data.migrated_records);
```

This will:
- Create a default tenant named "Default Tenant" with code "default"
- Assign all existing users to this tenant
- Assign all existing records to this tenant

### Step 3: Update Frontend Data Loading
Replace direct entity queries with backend function calls:

**Before:**
```javascript
const orders = await base44.entities.Order.filter({ user_email });
```

**After:**
```javascript
const res = await base44.functions.invoke('getTenantOrders', {});
const orders = res.data.orders;
```

## Tenant Settings Isolation

Each tenant has isolated settings for:

- **Payment configuration** - Exchange rates, service fees, payment methods
- **Shipping methods** - Domestic and international shipping rules
- **Announcement text** - Tenant-specific notices and reminders
- **Branding** - Logo, theme colors, display names
- **Future customization** - Any additional per-tenant settings

Admin pages should:
1. Load tenant context
2. Filter SiteSettings by current tenant_id
3. Only allow editing of own tenant's settings

## Audit & Compliance

Future audit logging should record:
- User ID (who made the change)
- Tenant ID (which tenant was affected)
- Action type (create, update, delete)
- Target entity type and ID
- Timestamp

This enables:
- Tenant isolation verification
- Cross-tenant access detection
- Compliance audits
- Security monitoring

## Security Checklist

- [ ] All entity mutations verify tenant ownership before allowing changes
- [ ] All queries filter by tenant_id (except platform_admin)
- [ ] User role checks include tenant_id verification
- [ ] File uploads/downloads verify tenant ownership
- [ ] Payment processing verifies order belongs to user's tenant
- [ ] Shipping operations verify pool/order belong to user's tenant
- [ ] Settings pages only show/edit current tenant's settings
- [ ] Search/filters respect tenant boundaries
- [ ] Notifications are tenant-scoped
- [ ] Exports only include tenant-owned data

## Troubleshooting

### "User has no tenant assigned" Error
- User record is missing tenant_id field
- Run initializeTenantMigration to assign default tenant
- Or manually assign via admin panel

### Data Not Visible to User
- Check user's tenant_id matches the data's tenant_id
- Verify user role allows visibility (staff/admin vs user)
- For shipping pools: check is_private and shared_with_emails

### Platform Admin Can't See Specific Tenant Data
- Platform admins bypass tenant filters
- They can see all data across all tenants
- This is by design - no query filter is applied for platform_admin role

## Future Enhancements

1. **Tenant-specific branding** - Load logo/theme from tenant settings
2. **Multi-language support** - Each tenant can have preferred language
3. **Notification preferences** - Per-tenant notification rules
4. **Audit logging** - Full audit trail with tenant context
5. **Usage analytics** - Per-tenant metrics and reporting
6. **Custom fee structures** - Per-tenant shipping/service fees
7. **Webhook integrations** - Tenant-scoped webhook endpoints