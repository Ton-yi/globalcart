/**
 * manageLocalShipping — 本地运输公司 & 运输方式管理
 * 运输方式存储在 SiteSettings（key = local_shipping_methods_config），tenant-safe
 * 运输公司存储在 ShippingCompany 实体，tenant-safe
 *
 * actions:
 *   listAll         — 返回 { companies: [...], methods: [...] }
 *   saveCompany     — 创建或更新运输公司 { company: {...} }
 *   deleteCompany   — 删除运输公司 { companyId }
 *   saveMethods     — 保存完整的运输方式数组（覆盖写入 SiteSettings）{ methods: [...] }
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const METHODS_KEY = "local_shipping_methods_config";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "tenant_admin", "platform_admin"].includes(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ── helper: resolve tenant_id ──────────────────────────────
    const tenantSettings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: user.tenant_id,
      key: "tenant_id_marker"
    });
    // Use user.tenant_id (derived from session, never from client)
    const tenantId = user.tenant_id;

    // ── listAll ───────────────────────────────────────────────
    if (action === "listAll") {
      const [companiesRaw, settingsRaw] = await Promise.all([
        base44.asServiceRole.entities.ShippingCompany.filter({ tenant_id: tenantId }),
        base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId, key: METHODS_KEY })
      ]);

      const companies = companiesRaw.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      let methods = [];
      if (settingsRaw.length > 0) {
        try { methods = JSON.parse(settingsRaw[0].value); } catch { methods = []; }
      }

      return Response.json({ companies, methods, settingId: settingsRaw[0]?.id || null });
    }

    // ── saveCompany ───────────────────────────────────────────
    if (action === "saveCompany") {
      const { company } = body;
      if (!company?.name?.trim()) return Response.json({ error: "名称不能为空" }, { status: 400 });

      let result;
      if (company.id) {
        // Update — verify ownership first
        const existing = await base44.asServiceRole.entities.ShippingCompany.filter({ id: company.id, tenant_id: tenantId });
        if (!existing.length) return Response.json({ error: "Not found" }, { status: 404 });
        const { id, ...data } = company;
        result = await base44.asServiceRole.entities.ShippingCompany.update(id, { ...data, tenant_id: tenantId });
      } else {
        result = await base44.asServiceRole.entities.ShippingCompany.create({ ...company, tenant_id: tenantId });
      }
      return Response.json({ company: result });
    }

    // ── deleteCompany ─────────────────────────────────────────
    if (action === "deleteCompany") {
      const { companyId } = body;
      const existing = await base44.asServiceRole.entities.ShippingCompany.filter({ id: companyId, tenant_id: tenantId });
      if (!existing.length) return Response.json({ error: "Not found" }, { status: 404 });
      await base44.asServiceRole.entities.ShippingCompany.delete(companyId);
      return Response.json({ ok: true });
    }

    // ── saveMethods ───────────────────────────────────────────
    if (action === "saveMethods") {
      const { methods, settingId } = body;
      const value = JSON.stringify(methods);

      let savedId = settingId;
      if (settingId) {
        // Verify ownership
        const existing = await base44.asServiceRole.entities.SiteSettings.filter({ id: settingId, tenant_id: tenantId });
        if (!existing.length) return Response.json({ error: "Not found" }, { status: 404 });
        await base44.asServiceRole.entities.SiteSettings.update(settingId, { value });
      } else {
        const created = await base44.asServiceRole.entities.SiteSettings.create({
          key: METHODS_KEY,
          value,
          description: "日本本地运输方式配置（JSON）",
          category: "shipping",
          tenant_id: tenantId
        });
        savedId = created.id;
      }
      return Response.json({ ok: true, settingId: savedId });
    }

    // ── listPickupLocations ───────────────────────────────────
    if (action === "listPickupLocations") {
      const locations = await base44.asServiceRole.entities.PickupLocation.filter({ tenant_id: tenantId });
      return Response.json({ locations: locations.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) });
    }

    // ── savePickupLocation ────────────────────────────────────
    if (action === "savePickupLocation") {
      const { location } = body;
      if (!location?.name?.trim()) return Response.json({ error: "名称不能为空" }, { status: 400 });
      let result;
      if (location.id) {
        const existing = await base44.asServiceRole.entities.PickupLocation.filter({ id: location.id, tenant_id: tenantId });
        if (!existing.length) return Response.json({ error: "Not found" }, { status: 404 });
        const { id, ...data } = location;
        result = await base44.asServiceRole.entities.PickupLocation.update(id, { ...data, tenant_id: tenantId });
      } else {
        result = await base44.asServiceRole.entities.PickupLocation.create({ ...location, tenant_id: tenantId });
      }
      return Response.json({ location: result });
    }

    // ── deletePickupLocation ──────────────────────────────────
    if (action === "deletePickupLocation") {
      const { locationId } = body;
      const existing = await base44.asServiceRole.entities.PickupLocation.filter({ id: locationId, tenant_id: tenantId });
      if (!existing.length) return Response.json({ error: "Not found" }, { status: 404 });
      await base44.asServiceRole.entities.PickupLocation.delete(locationId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});