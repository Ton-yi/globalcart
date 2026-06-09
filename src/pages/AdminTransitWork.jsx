/**
 * AdminTransitWork - Admin overview of all transit location work panels
 * Shows all transit locations with their pending work (pools) without filtering by location
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  MapPin, Package, CheckCircle, Truck, Loader2, ChevronRight, AlertCircle, Edit2, Trash2, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TransitPoolCard from "@/components/transit/TransitPoolCard";

export default function AdminTransitWork() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [poolsByLocation, setPoolsByLocation] = useState({});
  const [showLocForm, setShowLocForm] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, is_default_official_pool: false, disabled_transit_method_ids: [], disabled_addon_ids: [], editingId: null });
  const [savingLoc, setSavingLoc] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [transitMethods, setTransitMethods] = useState([]);
  const [addonOptions, setAddonOptions] = useState([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const r = await base44.functions.invoke('getAllTransitWorkData', {});
        const data = r.data || {};
        setLocations(data.locations || []);
        setPoolsByLocation(data.poolsByLocation || {});
        setAllUsers(data.users || []);
        setTransitMethods(data.transitMethods || []);
        setAddonOptions(data.addonOptions || []);
      } catch (err) {
        console.error('AdminTransitWork fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const getPoolsByStatus = (pools) => ({
    arrived: pools.filter(p => p.transit_arrival_confirmed_at && !p.transit_shipped_date),
    in_transit: pools.filter(p => p.status === "shipped" && !p.transit_arrival_confirmed_at && p.tracking_number),
    forwarded: pools.filter(p => p.transit_shipped_date),
  });

  const lf = (k, v) => setLocForm(p => ({ ...p, [k]: v }));

  const handleLocSave = async () => {
    setSavingLoc(true);
    if (locForm.is_default_official_pool) {
      const others = locations.filter(l => l.is_default_official_pool && l.id !== locForm.editingId);
      await Promise.all(others.map(l => base44.asServiceRole.entities.TransitLocation.update(l.id, { is_default_official_pool: false })));
    }
    const { editingId, ...data } = locForm;
    if (editingId) {
      await base44.asServiceRole.entities.TransitLocation.update(editingId, data);
    } else {
      await base44.asServiceRole.entities.TransitLocation.create(data);
    }
    const r = await base44.functions.invoke('getAllTransitWorkData', {});
    setLocations(r.data?.locations || []);
    setShowLocForm(false);
    setLocForm({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, is_default_official_pool: false, disabled_transit_method_ids: [], disabled_addon_ids: [], editingId: null });
    setSavingLoc(false);
  };

  const handleLocEdit = (loc) => {
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
      is_default_official_pool: loc.is_default_official_pool || false,
      editingId: loc.id,
    });
    setShowLocForm(true);
  };

  const handleLocDelete = async (id) => {
    if (!confirm("确认删除此中转地？")) return;
    await base44.asServiceRole.entities.TransitLocation.delete(id);
    const r = await base44.functions.invoke('getAllTransitWorkData', {});
    setLocations(r.data?.locations || []);
  };

  const handleLocToggle = async (loc) => {
    await base44.asServiceRole.entities.TransitLocation.update(loc.id, { is_active: !loc.is_active });
    const r = await base44.functions.invoke('getAllTransitWorkData', {});
    setLocations(r.data?.locations || []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeLocations = locations.filter(loc => loc.is_active !== false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">中转地工作面板（总览）</h1>
          <p className="text-sm text-gray-400 mt-0.5">所有中转地的待处理包裹，点击包裹卡片可进入操作</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowLocForm(true)}>
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            添加中转地
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/AdminShippingPool?tab=locations")}>
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            中转地管理
          </Button>
        </div>
      </div>

      {showLocForm && (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{locForm.editingId ? "编辑中转地" : "添加中转地"}</h3>
            <button onClick={() => { setShowLocForm(false); setLocForm({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, is_default_official_pool: false, disabled_transit_method_ids: [], disabled_addon_ids: [], editingId: null }); }} className="p-1 hover:bg-gray-200 rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">中转地名称 *</label>
              <input className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.name} onChange={e => lf("name", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">代号前缀</label>
              <input className="mt-1 h-8 w-full border rounded px-2 text-sm font-mono uppercase" maxLength={3} value={locForm.code_prefix} onChange={e => lf("code_prefix", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">负责人邮箱</label>
            <select className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.manager_email} onChange={e => lf("manager_email", e.target.value)}>
              <option value="">选择管理员...</option>
              {allUsers.filter(u => u.role === "admin").map(u => (
                <option key={u.id} value={u.email}>{u.full_name ? `${u.full_name} (${u.email})` : u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">负责人联系方式</label>
            <input className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.manager_contact} onChange={e => lf("manager_contact", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">国家</label>
              <input className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.country} onChange={e => lf("country", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">省/州</label>
              <input className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.province} onChange={e => lf("province", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">详细地址</label>
            <input className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.address} onChange={e => lf("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">中转手续费</label>
              <input type="number" step="0.01" className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.handling_fee} onChange={e => lf("handling_fee", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">手续费货币</label>
              <select className="mt-1 h-8 w-full border rounded px-2 text-sm" value={locForm.handling_fee_currency} onChange={e => lf("handling_fee_currency", e.target.value)}>
                {["JPY","CNY","USD","TWD","HKD","EUR","SGD"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">描述/备注</label>
            <textarea className="mt-1 w-full border rounded px-2 text-sm" rows={2} value={locForm.description} onChange={e => lf("description", e.target.value)} />
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={locForm.allow_storage} onChange={e => lf("allow_storage", e.target.checked)} />
              <span className="text-xs text-gray-600">允许货品暂存</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={locForm.allow_pickup} onChange={e => lf("allow_pickup", e.target.checked)} />
              <span className="text-xs text-gray-600">允许自取</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={locForm.is_active} onChange={e => lf("is_active", e.target.checked)} />
              <span className="text-xs text-gray-600">启用</span>
            </label>
          </div>
          <div className="flex items-center justify-between border border-orange-200 rounded-lg px-3 py-2 bg-orange-50">
            <div>
              <p className="text-xs font-medium text-orange-700">设为默认官方拼邮中转地</p>
              <p className="text-xs text-orange-500 mt-0.5">开启后，创建官方拼邮需求时将自动选取此中转地（全租户唯一）</p>
            </div>
            <input type="checkbox" checked={locForm.is_default_official_pool} onChange={e => lf("is_default_official_pool", e.target.checked)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowLocForm(false); setLocForm({ name: "", code_prefix: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", manager_contact: "", allow_storage: false, allow_pickup: false, description: "", is_active: true, is_default_official_pool: false, disabled_transit_method_ids: [], disabled_addon_ids: [], editingId: null }); }}>取消</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleLocSave} disabled={savingLoc || !locForm.name}>
              {savingLoc ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      {activeLocations.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <MapPin className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">暂无启用的中转地</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeLocations.map(loc => {
            const pools = poolsByLocation[loc.id] || [];
            const byStatus = getPoolsByStatus(pools);
            const pendingCount = byStatus.arrived.length + byStatus.in_transit.length;

            return (
              <div key={loc.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 text-sm">{loc.name}</span>
                    {loc.code_prefix && (
                      <Badge className="text-xs bg-purple-100 text-purple-700 font-mono">{loc.code_prefix}</Badge>
                    )}
                    {loc.manager_email && (
                      <span className="text-xs text-gray-400">负责人：{loc.manager_email}</span>
                    )}
                    {!loc.manager_email && (
                      <Badge className="text-xs bg-orange-100 text-orange-700">
                        <AlertCircle className="w-2.5 h-2.5 mr-1 inline" />未分配负责人
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {pendingCount > 0 && (
                      <Badge className="bg-red-100 text-red-700 text-xs mr-2">{pendingCount} 待处理</Badge>
                    )}
                    <button onClick={() => window.open(`${window.location.origin}/TransitLocationWork/${loc.id}`, '_blank')} title="工作面板" className="p-1.5 rounded hover:bg-red-50 text-red-600"><MapPin className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleLocEdit(loc)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleLocToggle(loc)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">{loc.is_active ? <X className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}</button>
                    <button onClick={() => handleLocDelete(loc.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {byStatus.in_transit.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Truck className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-blue-700">在途 ({byStatus.in_transit.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {byStatus.in_transit.map(pool => (
                          <TransitPoolCard key={pool.id} pool={pool} transitStatus="in_transit" onClick={() => navigate(`/TransitPoolWork/${pool.id}`)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {byStatus.arrived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs font-medium text-green-700">已收货待转发 ({byStatus.arrived.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {byStatus.arrived.map(pool => (
                          <TransitPoolCard key={pool.id} pool={pool} transitStatus="arrived" onClick={() => navigate(`/TransitPoolWork/${pool.id}`)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {byStatus.forwarded.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-500">已转发 ({byStatus.forwarded.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {byStatus.forwarded.map(pool => (
                          <TransitPoolCard key={pool.id} pool={pool} transitStatus="forwarded" onClick={() => {}} />
                        ))}
                      </div>
                    </div>
                  )}
                  {pools.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">暂无包裹</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}