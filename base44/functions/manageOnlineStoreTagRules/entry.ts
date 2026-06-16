import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, rules } = await req.json();

        if (action === 'save') {
            // Validate user has admin or staff role
            if (!['admin', 'tenant_admin', 'staff', 'platform_admin'].includes(user.role)) {
                return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
            }

            // Get tenant context
            const tenantContext = await base44.functions.invoke('getTenantContext', { user_id: user.id });
            const tenantId = tenantContext.data?.tenant_id;

            if (!tenantId) {
                return Response.json({ error: 'Tenant not found' }, { status: 404 });
            }

            // Validate and normalize rules
            const validatedRules = (rules || []).map((r, idx) => ({
                tenant_id: tenantId,
                keyword: r.keyword || '',
                tag_label: r.tag_label || '其它',
                tag_color: r.tag_color || 'bg-gray-100 text-gray-700',
                is_active: r.is_active !== false,
                priority: typeof r.priority === 'number' ? r.priority : idx,
            }));

            // Save rules using mutateTenantEntity
            const saveResult = await base44.functions.invoke('mutateTenantEntity', {
                entity_name: 'OnlineStoreTagRule',
                action: 'bulk_upsert',
                records: validatedRules,
                key_field: 'keyword'
            });

            return Response.json({ 
                success: true, 
                rules: validatedRules,
                saved_count: validatedRules.length 
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});