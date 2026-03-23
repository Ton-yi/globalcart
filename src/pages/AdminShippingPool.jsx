/**
 * AdminShippingPool - Admin view
 * Shows all shipping pools + transit location management
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { fetchShippingPools, tenantEntity, fetchTenantConfig } from "@/lib/tenantApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Plus, RefreshCw, Truck, MapPin, Edit2, Trash2, Check, X as XIcon } from "lucide-react";
import { getCountry } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import CountrySelect from "@/components/common/CountrySelect";
import ShippingPoolCard from "@/components/shippingpool/ShippingPoolCard";
import ShippingPoolDetailModal from "@/components/shippingpool/ShippingPoolDetailModal";
import CreateShippingPoolModal from "@/components/shippingpool/CreateShippingPoolModal";

const STATUS_FILTERS = [
  { v: "all", l: "全部状态" },
  { v: "pending", l: "待处理" },
  { v: "processing", l: "处理中" },
  { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已签收" },
];

const TABS = [
  { key: "pools", label: "发货申请" },
  { key: "locations", label: "中转地管理" },
];

export default function AdminShippingPool() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("pools");
  const [pools, setPools] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPool, setSelectedPool] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Location form
  const [showLocForm, setShowLocForm] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [locForm, setLocForm] = useState({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, disabled_transit_method_ids: [], disabled_addon_ids: [] });
  const [savingLoc, setSavingLoc] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [transitMethods, setTransitMethods] = useState([]);
  const [addonOptions, setAddonOptions] = useState([]);

  const fetchPools = async () => {
    setLoading(true);
    const data = await fetchShippingPools();
    setPools(data);
    setLoading(false);
  };

  const fetchLocations = async () => {
    const data = await tenantEntity.list('TransitLocation');
    setLocations(data);
  };

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      fetchPools();
      fetchLocations();
      const [users, config] = await Promise.all([
        base44.entities.User.list(),
        base44.functions.invoke('getTenantConfigData', {}).then(r => r.data || {}),
      ]);
      setAllUsers(users);
      setTransitMethods(config.transitMethods || []);
      setAddonOptions((config.addons || []).filter(a => a.addon_type === 'shipping' && a.is_active !== false));
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const filtered = pools.filter(p => statusFilter === "all" || p.status === statusFilter);

  // Location handlers
  const lf = (k, v) => setLocForm(p => ({ ...p, [k]: v }));

  const handleLocSave = async () => {
    setSavingLoc(true);
    if (editingLoc) {
      await tenantEntity.update('TransitLocation', editingLoc.id, locForm);
    } else {
      await tenantEntity.create('TransitLocation', locForm);
    }
    await fetchLocations();
    setShowLocForm(false);
    setEditingLoc(null);
    setLocForm({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, disabled_transit_method_ids: [], disabled_addon_ids: [] });
    setSavingLoc(false);
  };

  const handleLocEdit = (loc) => {
    setEditingLoc(loc);
    setLocForm({
      name: loc.name, code_prefix: loc.code_prefix || "", country: loc.country || "", province: loc.province || "",
      address: loc.address || "", handling_fee: loc.handling_fee || 0,
      handling_fee_currency: loc.handling_fee_currency || "JPY",
      manager_email: loc.manager_email || "", manager_contact: loc.manager_contact || "",
      allow_storage: loc.allow_storage || false,
      allow_pickup: loc.allow_pickup || false,
      disabled_transit_method_ids: loc.disabled_transit_method_ids || [],
      disabled_addon_ids: loc.disabled_addon_ids || [],
      description: loc.description || "", is_active: loc.is_active !== false,
    });
    setShowLocForm(true);
  };

  const handleLocDelete = async (id) => {
    if (!confirm("确认删除此中转地？")) return;
    await tenantEntity.delete('TransitLocation', id);
    fetchLocations();
  };

  const handleLocToggle = async (loc) => {
    await tenantEntity.update('TransitLocation', loc.id, { is_active: !loc.is_active });
    fetchLocations();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">发货池管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">管理所有发货申请与中转地配置</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "pools" && (
            <>
              <Button variant="outline" size="sm" onClick={fetchPools}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
              </Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />创建发货申请
              </Button>
            </>
          )}
          {activeTab === "locations" && (
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { setEditingLoc(null); setLocForm({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, disabled_transit_method_ids: [], disabled_addon_ids: [] }); setShowLocForm(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />添加中转地
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {tab.label}
            {tab.key === "pools" && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{pools.length}</span>}
            {tab.key === "locations" && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{locations.length}</span>}
          </button>
        ))}
      </div>

      {/* ---- POOLS TAB ---- */}
      {activeTab === "pools" && (
        <>
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <Truck className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">暂无发货申请</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(pool => (
                <ShippingPoolCard key={pool.id} pool={pool} onClick={setSelectedPool} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- LOCATIONS TAB ---- */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          {/* Location form */}
          {showLocForm && (
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">{editingLoc ? "编辑中转地" : "添加中转地"}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">中转地名称 *</Label>
                  <Input className="mt-1 h-8 text-sm" value={locForm.name} onChange={e => lf("name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">代号前缀（3位大写字母）</Label>
                  <Input
                    className="mt-1 h-8 text-sm font-mono uppercase tracking-widest"
                    maxLength={3}
                    placeholder="TYO"
                    value={locForm.code_prefix}
                    onChange={e => lf("code_prefix", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
                  />
                </div>
              </div>
              <div>
                  <Label className="text-xs text-gray-500">负责人（仅限管理员用户）</Label>
                  <Select value={locForm.manager_email} onValueChange={v => lf("manager_email", v)}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="选择管理员用户..." /></SelectTrigger>
                    <SelectContent>
                      {allUsers.filter(u => u.role === "admin").map(u => (
                        <SelectItem key={u.id} value={u.email}>
                          {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">负责人联系方式（微信/Line/WhatsApp等）</Label>
                <Input className="mt-1 h-8 text-sm" placeholder="如：微信号 abc123" value={locForm.manager_contact} onChange={e => lf("manager_contact", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">国家</Label>
                  <CountrySelect value={locForm.country} onChange={v => lf("country", v)} placeholder="选择国家" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">省/州</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="如：广东省" value={locForm.province} onChange={e => lf("province", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">详细地址</Label>
                <Input className="mt-1 h-8 text-sm" placeholder="街道、门牌号等" value={locForm.address} onChange={e => lf("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">中转手续费</Label>
                  <Input type="number" step="0.01" className="mt-1 h-8 text-sm" placeholder="0" value={locForm.handling_fee} onChange={e => lf("handling_fee", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">手续费货币</Label>
                  <Select value={locForm.handling_fee_currency} onValueChange={v => lf("handling_fee_currency", v)}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["JPY","CNY","USD","TWD","HKD","EUR","SGD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">描述/备注</Label>
                <Textarea rows={2} className="mt-1 text-sm" value={locForm.description} onChange={e => lf("description", e.target.value)} />
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={locForm.allow_storage} onCheckedChange={v => lf("allow_storage", v)} />
                  <span className="text-xs text-gray-600">允许货品暂存</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={locForm.allow_pickup} onCheckedChange={v => lf("allow_pickup", v)} />
                  <span className="text-xs text-gray-600">允许自取</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={locForm.is_active} onCheckedChange={v => lf("is_active", v)} />
                  <span className="text-xs text-gray-600">启用</span>
                </label>
              </div>

              {/* Disable transit methods for this location */}
              {transitMethods.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500">禁用的中转运输方式（勾选 = 在此中转地隐藏）</Label>
                  <div className="mt-1.5 space-y-1 border border-gray-200 rounded-lg p-2 bg-white max-h-36 overflow-y-auto">
                    {transitMethods.map(m => {
                      const disabled = (locForm.disabled_transit_method_ids || []).includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                          <input type="checkbox" checked={disabled}
                            onChange={() => lf("disabled_transit_method_ids", disabled
                              ? (locForm.disabled_transit_method_ids || []).filter(id => id !== m.id)
                              : [...(locForm.disabled_transit_method_ids || []), m.id]
                            )}
                            className="accent-red-600" />
                          <span className="text-xs text-gray-700">{m.name}</span>
                          {!m.is_active && <span className="text-xs text-gray-400">（已全局禁用）</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Disable addons for this location */}
              {addonOptions.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500">禁用的发货增值服务（勾选 = 在此中转地隐藏）</Label>
                  <div className="mt-1.5 space-y-1 border border-gray-200 rounded-lg p-2 bg-white max-h-36 overflow-y-auto">
                    {addonOptions.map(a => {
                      const disabled = (locForm.disabled_addon_ids || []).includes(a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                          <input type="checkbox" checked={disabled}
                            onChange={() => lf("disabled_addon_ids", disabled
                              ? (locForm.disabled_addon_ids || []).filter(id => id !== a.id)
                              : [...(locForm.disabled_addon_ids || []), a.id]
                            )}
                            className="accent-red-600" />
                          <span className="text-xs text-gray-700">{a.name}</span>
                          {a.fee > 0 && <span className="text-xs text-gray-400">+{a.fee_currency} {a.fee}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowLocForm(false); setEditingLoc(null); }}>取消</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleLocSave} disabled={savingLoc || !locForm.name}>
                  {savingLoc ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          )}

          {/* Location list */}
          {locations.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无中转地，点击右上角"添加中转地"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-start gap-3 border border-gray-200 rounded-xl p-4 bg-white">
                  <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${loc.is_active ? "text-red-500" : "text-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{loc.name}</span>
                      {loc.code_prefix && (
                        <Badge className="text-xs bg-purple-100 text-purple-700 font-mono">{loc.code_prefix}</Badge>
                      )}
                      {(loc.country || loc.province) && (
                        <Badge variant="outline" className="text-xs">
                          {[getCountry(loc.country)?.name || loc.country, loc.province].filter(Boolean).join(" · ")}
                        </Badge>
                      )}
                      {loc.allow_storage && <Badge className="text-xs bg-blue-100 text-blue-600">可暂存</Badge>}
                      {loc.allow_pickup && <Badge className="text-xs bg-teal-100 text-teal-600">可自取</Badge>}
                      <Badge className={`text-xs ${loc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {loc.is_active ? "启用" : "停用"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {loc.address && <p className="text-xs text-gray-500">{loc.address}</p>}
                      {loc.handling_fee > 0 && <p className="text-xs text-orange-500">手续费 {loc.handling_fee_currency || "JPY"} {loc.handling_fee}</p>}
                      {loc.manager_email && <p className="text-xs text-gray-400">负责人：{allUsers.find(u => u.email === loc.manager_email)?.full_name || loc.manager_email}{loc.manager_contact ? ` · ${loc.manager_contact}` : ""}</p>}
                    </div>
                    {loc.description && <p className="text-xs text-gray-400 mt-0.5">{loc.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleLocToggle(loc)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      {loc.is_active ? <XIcon className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleLocEdit(loc)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleLocDelete(loc.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateShippingPoolModal
          isAdmin={true}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchPools();
          }}
        />
      )}

      {selectedPool && user && (
        <ShippingPoolDetailModal
          pool={selectedPool}
          isAdmin={true}
          currentUser={user}
          onClose={() => setSelectedPool(null)}
          onUpdated={() => {
            setSelectedPool(null);
            fetchPools();
          }}
        />
      )}
    </div>
  );
}