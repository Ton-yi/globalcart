/**
 * AdminShippingPool - Admin view
 * Shows all shipping pools + transit location management
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, Truck, MapPin, Edit2, Trash2, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  const [locForm, setLocForm] = useState({ name: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", allow_storage: false, description: "", is_active: true });
  const [savingLoc, setSavingLoc] = useState(false);

  const fetchPools = async () => {
    setLoading(true);
    const data = await base44.entities.ShippingPool.list("-created_date", 200);
    setPools(data);
    setLoading(false);
  };

  const fetchLocations = async () => {
    const data = await base44.entities.TransitLocation.list("-created_date");
    setLocations(data);
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchPools();
      fetchLocations();
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const filtered = pools.filter(p => statusFilter === "all" || p.status === statusFilter);

  // Location handlers
  const lf = (k, v) => setLocForm(p => ({ ...p, [k]: v }));

  const handleLocSave = async () => {
    setSavingLoc(true);
    if (editingLoc) {
      await base44.entities.TransitLocation.update(editingLoc.id, locForm);
    } else {
      await base44.entities.TransitLocation.create(locForm);
    }
    await fetchLocations();
    setShowLocForm(false);
    setEditingLoc(null);
    setLocForm({ name: "", country: "", province: "", address: "", handling_fee: 0, handling_fee_currency: "JPY", manager_email: "", allow_storage: false, description: "", is_active: true });
    setSavingLoc(false);
  };

  const handleLocEdit = (loc) => {
    setEditingLoc(loc);
    setLocForm({
      name: loc.name, country: loc.country || "", province: loc.province || "",
      address: loc.address || "", handling_fee: loc.handling_fee || 0,
      handling_fee_currency: loc.handling_fee_currency || "JPY",
      manager_email: loc.manager_email || "", allow_storage: loc.allow_storage || false,
      description: loc.description || "", is_active: loc.is_active !== false,
    });
    setShowLocForm(true);
  };

  const handleLocDelete = async (id) => {
    if (!confirm("确认删除此中转地？")) return;
    await base44.entities.TransitLocation.delete(id);
    fetchLocations();
  };

  const handleLocToggle = async (loc) => {
    await base44.entities.TransitLocation.update(loc.id, { is_active: !loc.is_active });
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
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { setEditingLoc(null); setLocForm({ name: "", country: "", address: "", description: "", is_active: true }); setShowLocForm(true); }}>
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
              <h3 className="text-sm font-semibold text-gray-800">
                {editingLoc ? "编辑中转地" : "添加中转地"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">名称 *</Label>
                  <Input className="mt-1 h-8 text-sm" value={locForm.name} onChange={e => lf("name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">所在国家</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="如：日本" value={locForm.country} onChange={e => lf("country", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">地址</Label>
                <Input className="mt-1 h-8 text-sm" value={locForm.address} onChange={e => lf("address", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">描述/备注</Label>
                <Textarea rows={2} className="mt-1 text-sm" value={locForm.description} onChange={e => lf("description", e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={locForm.is_active} onCheckedChange={v => lf("is_active", v)} />
                <span className="text-xs text-gray-600">启用</span>
              </div>
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
                      {loc.country && <Badge variant="outline" className="text-xs">{loc.country}</Badge>}
                      <Badge className={`text-xs ${loc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {loc.is_active ? "启用" : "停用"}
                      </Badge>
                    </div>
                    {loc.address && <p className="text-xs text-gray-500 mt-0.5">{loc.address}</p>}
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