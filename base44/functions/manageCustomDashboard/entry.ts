import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Resolve user record for tenant_id and suspension check
        const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const userRecord = userRecords?.[0];
        if (!userRecord) return Response.json({ error: 'User not found' }, { status: 404 });
        if (userRecord.is_active === false) {
            return Response.json({ error: '账户已停用' }, { status: 403 });
        }

        const tenantId = userRecord.tenant_id || null;
        const isPlatformAdmin = user.role === 'platform_admin';
        const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
        const isStaff = user.role === 'staff';

        // Only admins and staff can access reports dashboards
        if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!tenantId && !isPlatformAdmin) {
            return Response.json({ error: 'Tenant not resolved' }, { status: 400 });
        }

        const body = await req.json();
        const { action, id, data } = body;

        if (action === 'list') {
            // 只使用 tenant_id 过滤，不检查 created_by（因为可能是服务账号创建的）
            const filter = {};
            if (tenantId) filter.tenant_id = tenantId;
            const allDashboards = await base44.asServiceRole.entities.CustomDashboard.filter(filter);
            // 前端过滤：只显示当前用户创建的，或平台/租户管理员创建的
            const dashboards = allDashboards.filter(d => 
                d.created_by === user.email || 
                isPlatformAdmin || 
                isTenantAdmin
            );
            return Response.json({ success: true, dashboards });
        }

        if (action === 'create') {
            if (!data?.name?.trim()) {
                return Response.json({ error: 'Name is required' }, { status: 400 });
            }
            const dashboard = await base44.asServiceRole.entities.CustomDashboard.create({
                tenant_id: tenantId,
                name: data.name.trim(),
                description: data.description || null,
                widgets: data.widgets || [],
                created_by: user.email,
                is_default: data.is_default || false,
            });
            return Response.json({ success: true, dashboard });
        }

        if (action === 'update') {
            if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
            const existing = await base44.asServiceRole.entities.CustomDashboard.filter({ id });
            const rec = existing?.[0];
            if (!rec) return Response.json({ error: 'Not found' }, { status: 404 });
            // Tenant isolation
            if (tenantId && rec.tenant_id && rec.tenant_id !== tenantId) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            // Ownership: only creator or admin can update
            if (rec.created_by !== user.email && !isPlatformAdmin && !isTenantAdmin) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            const updatePayload = {};
            if (data.name !== undefined)        updatePayload.name = data.name.trim();
            if (data.description !== undefined) updatePayload.description = data.description;
            if (data.widgets !== undefined)     updatePayload.widgets = data.widgets;
            if (data.is_default !== undefined)  updatePayload.is_default = data.is_default;
            const updated = await base44.asServiceRole.entities.CustomDashboard.update(id, updatePayload);
            return Response.json({ success: true, dashboard: updated });
        }

        if (action === 'delete') {
            if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
            const existing = await base44.asServiceRole.entities.CustomDashboard.filter({ id });
            const rec = existing?.[0];
            if (!rec) return Response.json({ error: 'Not found' }, { status: 404 });
            if (tenantId && rec.tenant_id && rec.tenant_id !== tenantId) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (rec.created_by !== user.email && !isPlatformAdmin && !isTenantAdmin) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            await base44.asServiceRole.entities.CustomDashboard.delete(id);
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Unknown action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});