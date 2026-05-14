import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Save, Building2, Users, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PlatformAdminSettings() {
  const { user } = useCurrentUser();
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState(null);
  const [assigning, setAssigning] = useState({});
  const [assignTarget, setAssignTarget] = useState({});

  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", code: "", branding_name: "", timezone: "Asia/Tokyo", login_title: "", login_subtitle: "", logo_url: "", favicon_url: "", theme_color: "#dc2626", contact_info: "" });
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [tenantMsg, setTenantMsg] = useState(null);
  const [assigningAll, setAssigningAll] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editTenantFields, setEditTenantFields] = useState({});
  const [savingTenant, setSavingTenant] = useState(false);

  const [platformBaseDomain, setPlatformBaseDomain] = useState("");
  const [editingDomain, setEditingDomain] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainMsg, setDomainMsg] = useState(null);

  const isPlatformAdmin = user?.role === 'platform_admin';

  // Redirect non-platform admins
  if (user && !isPlatformAdmin) {
    return <div className="text-center py-8 text-red-600">仅平台管理员可访问此页面</div>;
  }

  useEffect(() => {
    loadTenants();
  }, []);

  const runDiagnose = async () => {
    setDiagLoading(true);
    setDiagError(null);
    const r = await base44.functions.invoke('adminAssignTenant', { action: 'diagnose' });
    if (r.data?.error) setDiagError(r.data.error);
    else setDiagData(r.data);
    setDiagLoading(false);
  };

  const handleAssign = async (email) => {
    const tid = assignTarget[email];
    if (!tid) return;
    setAssigning(a => ({ ...a, [email]: true }));
    await base44.functions.invoke('adminAssignTenant', { action: 'assign', target_email: email, tenant_id: tid });
    setAssigning(a => ({ ...a, [email]: false }));
    await runDiagnose();
  };

  const loadTenants = async () => {
    setTenantsLoading(true);
    const [tenantsRes, domainRes] = await Promise.all([
      base44.functions.invoke('manageTenants', { action: 'list' }),
      base44.functions.invoke('manageTenants', { action: 'get_platform_domain' }),
    ]);
    setTenants(tenantsRes.data?.tenants || []);
    const domain = domainRes.data?.platform_base_domain || "";
    setPlatformBaseDomain(domain);
    setEditingDomain(domain);
    setTenantsLoading(false);
  };

  const handleSaveDomain = async () => {
    setSavingDomain(true);
    setDomainMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'set_platform_domain', platform_base_domain: editingDomain });
    if (r.data?.error) {
      setDomainMsg({ type: 'error', text: r.data.error });
    } else {
      setPlatformBaseDomain(r.data.platform_base_domain);
      setDomainMsg({ type: 'success', text: '平台域名已保存' });
      setTimeout(() => setDomainMsg(null), 3000);
    }
    setSavingDomain(false);
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.code) return;
    setCreatingTenant(true);
    setTenantMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'create', ...newTenant });
    if (r.data?.error) {
      setTenantMsg({ type: 'error', text: r.data.error });
    } else {
      setTenantMsg({ type: 'success', text: `租户 "${r.data.tenant.name}" 创建成功！` });
      setNewTenant({ name: "", code: "", branding_name: "", timezone: "Asia/Tokyo", login_title: "", login_subtitle: "", logo_url: "", favicon_url: "", theme_color: "#dc2626", contact_info: "" });
      await loadTenants();
    }
    setCreatingTenant(false);
  };

  const handleAssignAll = async (tenantId) => {
    setAssigningAll(true);
    setTenantMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'assign_all', tenant_id: tenantId });
    if (r.data?.error) {
      setTenantMsg({ type: 'error', text: r.data.error });
    } else {
      setTenantMsg({ type: 'success', text: `已将 ${r.data.assigned} 名用户分配到此租户。` });
    }
    setAssigningAll(false);
  };

  const handleToggleTenant = async (t) => {
    await base44.functions.invoke('manageTenants', { action: 'update', id: t.id, is_active: !t.is_active });
    await loadTenants();
  };

  const handleEditTenant = (t) => {
    setEditingTenant(t.id);
    setEditTenantFields({
      branding_name: t.branding_name || "",
      code: t.code || "",
      logo_url: t.logo_url || "",
      favicon_url: t.favicon_url || "",
      theme_color: t.theme_color || "#dc2626",
      login_title: t.login_title || "",
      login_subtitle: t.login_subtitle || "",
      contact_info: t.contact_info || "",
      subdomain: t.subdomain || (t.code || "").toLowerCase(),
    });
    setTenantMsg(null);
  };

  const handleSaveTenant = async (tenantId) => {
    setSavingTenant(true);
    setTenantMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'update', id: tenantId, ...editTenantFields });
    if (r.data?.error) {
      setTenantMsg({ type: 'error', text: r.data.error });
    } else {
      setTenantMsg({ type: 'success', text: '保存成功' });
      setEditingTenant(null);
      await loadTenants();
    }
    setSavingTenant(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">平台管理员设置</h1>
      </div>

      {/* Tenant Assignment Diagnostics */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800"
          onClick={() => { setDiagOpen(o => !o); if (!diagOpen && !diagData) runDiagnose(); }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            租户分配诊断
          </span>
          {diagOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {diagOpen && (
          <div className="border-t border-amber-200 px-4 py-4 space-y-3 bg-white">
            {diagLoading ? (
              <p className="text-sm text-gray-400">诊断中...</p>
            ) : diagError ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">⚠️ {diagError}</p>
            ) : diagData ? (
              <>
                <p className="text-xs text-gray-500">
                  共 {diagData.total_users} 名用户，
                  <span className={`font-semibold ${diagData.missing_tenant_users?.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {diagData.missing_tenant_users?.length} 名未分配租户
                  </span>
                </p>
                {diagData.missing_tenant_users?.length === 0 ? (
                  <p className="text-xs text-green-600">✓ 所有用户均已分配租户</p>
                ) : (
                  <div className="space-y-2">
                    {diagData.missing_tenant_users.map(u => (
                      <div key={u.email} className="flex items-center gap-2 flex-wrap py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800 font-medium">{u.email}</span>
                          <span className="text-xs text-gray-400 ml-2">{u.role}</span>
                        </div>
                        <Select value={assignTarget[u.email] || ""} onValueChange={v => setAssignTarget(a => ({ ...a, [u.email]: v }))}>
                          <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="选择租户" /></SelectTrigger>
                          <SelectContent>
                            {(diagData.tenants || []).map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                          disabled={!assignTarget[u.email] || assigning[u.email]}
                          onClick={() => handleAssign(u.email)}>
                          {assigning[u.email] ? "分配中..." : "分配"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={runDiagnose}>刷新诊断</Button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Platform base domain */}
      <Card className="border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />平台二级域名
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            设置后，租户的三级域名格式为：<span className="font-mono">{"<slug>."}{platformBaseDomain || "yourdomain.com"}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">二级域名（不含 http://，不含末尾斜杠）</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                className="h-8 text-sm font-mono flex-1"
                placeholder="例：app.yourcompany.com"
                value={editingDomain}
                onChange={e => setEditingDomain(e.target.value)}
              />
              <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700" onClick={handleSaveDomain} disabled={savingDomain}>
                <Save className="w-3.5 h-3.5 mr-1" />{savingDomain ? "保存中..." : "保存"}
              </Button>
            </div>
            {platformBaseDomain && (
              <p className="text-xs text-purple-600 mt-1.5">
                ✓ 当前：租户访问地址格式 = <span className="font-mono font-medium">{"<slug>."}{platformBaseDomain}</span>
              </p>
            )}
            {domainMsg && (
              <p className={`text-xs mt-1.5 px-2 py-1 rounded ${domainMsg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                {domainMsg.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create tenant */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />新建租户
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">租户名称 *</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="例：同一物流" value={newTenant.name}
                onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">代码/子域名 (唯一) *</Label>
              <Input className="mt-0.5 h-8 text-sm font-mono" placeholder="例：tongyi" value={newTenant.code}
                onChange={e => setNewTenant(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
              <p className="text-xs text-gray-400 mt-0.5">访问地址：{newTenant.code || "slug"}.{platformBaseDomain || "yourdomain.com"}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">品牌显示名</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="同上则留空" value={newTenant.branding_name}
                onChange={e => setNewTenant(p => ({ ...p, branding_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">登录页标题</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="留空则使用品牌名" value={newTenant.login_title}
                onChange={e => setNewTenant(p => ({ ...p, login_title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">主题色</Label>
              <div className="flex items-center gap-2 mt-0.5">
                <input type="color" value={newTenant.theme_color} onChange={e => setNewTenant(p => ({ ...p, theme_color: e.target.value }))}
                  className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                <Input className="h-8 text-sm flex-1 font-mono" value={newTenant.theme_color}
                  onChange={e => setNewTenant(p => ({ ...p, theme_color: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">时区</Label>
              <Input className="mt-0.5 h-8 text-sm" value={newTenant.timezone}
                onChange={e => setNewTenant(p => ({ ...p, timezone: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">联系方式</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="微信/WhatsApp/邮箱等" value={newTenant.contact_info}
                onChange={e => setNewTenant(p => ({ ...p, contact_info: e.target.value }))} />
            </div>
          </div>
          {tenantMsg && !editingTenant && (
            <p className={`text-xs px-3 py-2 rounded border ${tenantMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {tenantMsg.type === 'success' ? '✓ ' : '⚠ '}{tenantMsg.text}
            </p>
          )}
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateTenant}
            disabled={creatingTenant || !newTenant.name || !newTenant.code}>
            <Plus className="w-3.5 h-3.5 mr-1" />{creatingTenant ? "创建中..." : "创建租户"}
          </Button>
        </CardContent>
      </Card>

      {/* Tenant list */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />现有租户
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsLoading ? (
            <p className="text-xs text-gray-400">加载中...</p>
          ) : tenants.length === 0 ? (
            <p className="text-xs text-gray-400">暂无租户，请在上方创建第一个租户。</p>
          ) : (
            <div className="space-y-3">
              {tenants.map(t => (
                <div key={t.id} className={`rounded-lg border ${t.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-center gap-3 p-3">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt={t.branding_name} className="h-7 w-auto object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: t.theme_color || '#dc2626' }}>
                        <span className="text-white text-xs font-bold">{(t.branding_name || t.name || '?').slice(0, 2)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{t.branding_name || t.name}</span>
                        <Badge className="text-xs font-mono bg-gray-100 text-gray-600">{t.code}</Badge>
                        {t.subdomain && t.subdomain !== (t.code || '').toLowerCase() && (
                          <Badge className="text-xs font-mono bg-blue-100 text-blue-700">{t.subdomain}.*</Badge>
                        )}
                        {!t.is_active && <Badge className="text-xs bg-red-100 text-red-600">停用</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="font-mono">{t.subdomain || (t.code || '').toLowerCase()}.{platformBaseDomain || "yourdomain.com"}</span>
                        {t.contact_info && <span className="ml-2 text-gray-300">·</span>}
                        {t.contact_info && <span className="ml-2">{t.contact_info}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => editingTenant === t.id ? setEditingTenant(null) : handleEditTenant(t)}>
                        {editingTenant === t.id ? "收起" : "编辑品牌"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => handleAssignAll(t.id)} disabled={assigningAll}>
                        <Users className="w-3 h-3" />{assigningAll ? "分配中..." : "批量分配"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => handleToggleTenant(t)}>
                        {t.is_active ? "停用" : "启用"}
                      </Button>
                    </div>
                  </div>

                  {editingTenant === t.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">品牌显示名</Label>
                          <Input className="mt-0.5 h-8 text-sm" value={editTenantFields.branding_name}
                            onChange={e => setEditTenantFields(p => ({ ...p, branding_name: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">租户代码</Label>
                          <Input className="mt-0.5 h-8 text-sm font-mono uppercase" value={editTenantFields.code}
                            onChange={e => setEditTenantFields(p => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))} />
                          <p className="text-xs text-gray-400 mt-0.5">用于系统识别租户（唯一）</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">三级域名 Slug</Label>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Input className="h-8 text-sm font-mono flex-1" value={editTenantFields.subdomain}
                              onChange={e => setEditTenantFields(p => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
                            {platformBaseDomain && (
                              <span className="text-xs text-gray-400 whitespace-nowrap">.{platformBaseDomain}</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">登录页标题</Label>
                          <Input className="mt-0.5 h-8 text-sm" value={editTenantFields.login_title}
                            onChange={e => setEditTenantFields(p => ({ ...p, login_title: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">登录页副标题</Label>
                          <Input className="mt-0.5 h-8 text-sm" value={editTenantFields.login_subtitle}
                            onChange={e => setEditTenantFields(p => ({ ...p, login_subtitle: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">主题色</Label>
                          <div className="flex items-center gap-2 mt-0.5">
                            <input type="color" value={editTenantFields.theme_color || '#dc2626'}
                              onChange={e => setEditTenantFields(p => ({ ...p, theme_color: e.target.value }))}
                              className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                            <Input className="h-8 text-sm flex-1 font-mono" value={editTenantFields.theme_color}
                              onChange={e => setEditTenantFields(p => ({ ...p, theme_color: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">联系方式</Label>
                          <Input className="mt-0.5 h-8 text-sm" placeholder="微信/WhatsApp/邮箱" value={editTenantFields.contact_info}
                            onChange={e => setEditTenantFields(p => ({ ...p, contact_info: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-gray-500">Logo URL</Label>
                          <Input className="mt-0.5 h-8 text-sm" placeholder="https://..." value={editTenantFields.logo_url}
                            onChange={e => setEditTenantFields(p => ({ ...p, logo_url: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-gray-500">Favicon URL</Label>
                          <Input className="mt-0.5 h-8 text-sm" placeholder="https://..." value={editTenantFields.favicon_url}
                            onChange={e => setEditTenantFields(p => ({ ...p, favicon_url: e.target.value }))} />
                        </div>
                      </div>
                      {tenantMsg && editingTenant === t.id && (
                        <p className={`text-xs px-3 py-2 rounded border ${tenantMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {tenantMsg.type === 'success' ? '✓ ' : '⚠ '}{tenantMsg.text}
                        </p>
                      )}
                      <Button size="sm" className="bg-gray-900 hover:bg-gray-800"
                        onClick={() => handleSaveTenant(t.id)} disabled={savingTenant}>
                        <Save className="w-3.5 h-3.5 mr-1" />{savingTenant ? "保存中..." : "保存品牌设置"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}