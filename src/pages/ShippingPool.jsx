/**
 * ShippingPool - 合并"发货申请"和"拼邮池"的用户页面
 * 创建表单为页面内嵌展开，不弹窗
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, Truck, X, Package, MapPin, ChevronRight, ChevronLeft, Check, Scale, Calendar, Info, Layers } from "lucide-react";
import CountrySelect from "@/components/common/CountrySelect";
import { getCountry } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ShippingPoolCard from "@/components/shippingpool/ShippingPoolCard";
import ShippingPoolDetailModal from "@/components/shippingpool/ShippingPoolDetailModal";

const SHIPPING_METHODS = [
  { value: "EMS", label: "EMS空运" },
  { value: "surface", label: "海运" },
  { value: "small_packet_air", label: "小型包装物空运" },
];

const STATUS_FILTERS = [
  { v: "all", l: "全部" },
  { v: "pending", l: "待处理" },
  { v: "processing", l: "处理中" },
  { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已签收" },
];

const TABS = [
  { key: "pools", label: "发货申请" },
  { key: "consolidation", label: "拼邮池" },
];

const TIMEOUT_LABELS = {
  ship_individually: "超时单独发货",
  next_consolidation: "加入下次拼邮",
  return_to_storage: "退回暂存",
};

const METHOD_LABELS = {
  EMS: "EMS", surface: "海运", small_packet_air: "小型包装物空运",
};

export default function ShippingPool() {
  const [user, setUser] = useState(null);
  const [pools, setPools] = useState([]);
  const [consolidationOrders, setConsolidationOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pools");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPool, setSelectedPool] = useState(null);

  // Inline create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [transitLocations, setTransitLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    recipient_name: "", recipient_phone: "", address_line1: "", address_line2: "",
    city: "", state: "", postal_code: "", destination_country: "",
    shipping_method: "", scheduled_ship_date: "", transit_location_id: "", user_note: "",
  });
  // consolidation type: "" = none, "transit" = to transit location, "other" = to saved address
  const [consType, setConsType] = useState("");

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchData = async (u) => {
    setLoading(true);
    const [pools, consOrders] = await Promise.all([
      base44.entities.ShippingPool.filter({ creator_email: u.email }, "-created_date", 100),
      base44.entities.Order.filter({ user_email: u.email, consolidation_requested: true, order_status: "notified_shipment" }, "-updated_date", 100),
    ]);
    setPools(pools);
    setConsolidationOrders(consOrders);
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchData(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  // Open inline create form
  const handleOpenCreate = async () => {
    setShowCreate(true);
    setCreateStep(1);
    setSelectedOrderIds([]);
    setForm({ recipient_name: "", recipient_phone: "", address_line1: "", address_line2: "", city: "", state: "", postal_code: "", destination_country: "", shipping_method: "", scheduled_ship_date: "", transit_location_id: "", user_note: "" });
    setConsType("");
    setFormLoading(true);
    const [orders, locs, prefs] = await Promise.all([
      base44.entities.Order.filter({ user_email: user.email, order_status: "in_warehouse" }, "-updated_date", 100),
      base44.entities.TransitLocation.filter({ is_active: true }),
      base44.entities.UserPreference.filter({ user_email: user.email }),
    ]);
    setAvailableOrders(orders);
    setTransitLocations(locs);
    const pref = prefs[0];
    const addrs = (pref?.saved_addresses || []).map(a => ({ country: "", ...a }));
    setSavedAddresses(addrs);
    // Auto-select default address
    const defaultId = pref?.default_address_id || "";
    const defaultAddr = addrs.find(a => a.id === defaultId) || addrs[0];
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
      setUseNewAddress(false);
      applyAddress(defaultAddr);
      // Also set destination_country from the address
      if (defaultAddr.country) {
        setForm(p => ({ ...p, destination_country: defaultAddr.country }));
      }
    } else {
      setUseNewAddress(true);
      setSelectedAddressId("");
    }
    setFormLoading(false);
  };

  const handleCloseCreate = () => {
    setShowCreate(false);
    setCreateStep(1);
  };

  const applyAddress = (addr) => {
    if (!addr) return;
    const lines = (addr.full_text || "").split("\n");
    setForm(p => ({ ...p, recipient_name: lines[0] || "", address_line1: lines[1] || "", address_line2: lines[2] || "", city: lines[3] || "" }));
  };

  const handleAddressSelect = (id) => {
    setSelectedAddressId(id);
    if (id === "__new__") {
      setUseNewAddress(true);
      setForm(p => ({ ...p, recipient_name: "", recipient_phone: "", address_line1: "", address_line2: "", city: "", state: "", postal_code: "", destination_country: "" }));
    } else {
      setUseNewAddress(false);
      const addr = savedAddresses.find(a => a.id === id);
      if (addr) {
        applyAddress(addr);
        if (addr.country) setForm(p => ({ ...p, destination_country: addr.country }));
      }
    }
  };

  const toggleOrder = (id) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedOrders = availableOrders.filter(o => selectedOrderIds.includes(o.id));
  const totalWeight = selectedOrders.reduce((s, o) => s + (o.weight_g || 0), 0);

  const handleSubmit = async () => {
    if (selectedOrderIds.length === 0 || !form.destination_country) return;
    setSubmitting(true);

    if (useNewAddress && saveAddress && newAddressLabel.trim()) {
      const prefs = await base44.entities.UserPreference.filter({ user_email: user.email });
      const addrEntry = { id: Date.now().toString(), label: newAddressLabel.trim(), full_text: [form.recipient_name, form.address_line1, form.address_line2, form.city].filter(Boolean).join("\n") };
      const existing = prefs[0]?.saved_addresses || [];
      if (prefs.length > 0) await base44.entities.UserPreference.update(prefs[0].id, { saved_addresses: [...existing, addrEntry] });
      else await base44.entities.UserPreference.create({ user_email: user.email, saved_addresses: [addrEntry] });
    }

    const transitLoc = transitLocations.find(l => l.id === form.transit_location_id);
    await base44.entities.ShippingPool.create({
      ...form,
      order_ids: selectedOrderIds,
      creator_email: user.email,
      creator_name: user.full_name || user.email,
      is_admin_created: false,
      total_weight_g: totalWeight,
      status: "pending",
      transit_location_name: transitLoc?.name || "",
      messages: [],
    });

    await Promise.all(selectedOrderIds.map(id => base44.entities.Order.update(id, { order_status: "notified_shipment" })));

    setSubmitting(false);
    handleCloseCreate();
    fetchData(user);
  };

  const filtered = pools.filter(p => statusFilter === "all" || p.status === statusFilter);

  // Consolidation groups
  const consGroups = consolidationOrders.reduce((acc, o) => {
    const key = o.shipping_method || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});
  const consTotalWeight = consolidationOrders.reduce((s, o) => s + (o.weight_g || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">发货 & 拼邮</h1>
          <p className="text-sm text-gray-400 mt-0.5">管理您的发货申请与拼邮包裹</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => user && fetchData(user)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
          </Button>
          {!showCreate && (
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />新增发货申请
            </Button>
          )}
        </div>
      </div>

      {/* ---- INLINE CREATE FORM ---- */}
      {showCreate && (
        <div className="border-2 border-red-100 rounded-2xl overflow-hidden bg-white shadow-sm">
          {/* Form header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-3">
              {[1, 2].map(s => (
                <div key={s} className={`flex items-center gap-1.5 text-xs font-medium ${s === createStep ? "text-red-700" : s < createStep ? "text-green-600" : "text-gray-400"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${s === createStep ? "bg-red-600 text-white" : s < createStep ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                    {s < createStep ? <Check className="w-3 h-3" /> : s}
                  </div>
                  {s === 1 ? "选择包裹" : "收货信息"}
                  {s < 2 && <ChevronRight className="w-3 h-3 text-gray-300 ml-1" />}
                </div>
              ))}
            </div>
            <button onClick={handleCloseCreate} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {formLoading ? (
            <div className="py-10 text-center text-gray-400 text-sm">加载中...</div>
          ) : (
            <div className="px-5 py-5">
              {/* STEP 1: SELECT ORDERS */}
              {createStep === 1 && (
                <div className="space-y-3">
                  {availableOrders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">暂无"已入库"状态的订单</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">选择要发货的包裹（可多选）：</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableOrders.map(o => (
                          <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedOrderIds.includes(o.id) ? "border-red-300 bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}>
                            <Checkbox checked={selectedOrderIds.includes(o.id)} onCheckedChange={() => toggleOrder(o.id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{o.product_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{o.order_number || o.id.slice(0, 8)} · {o.weight_g || 0}g</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {selectedOrderIds.length > 0 && (
                    <div className="bg-teal-50 border border-teal-100 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
                      <span className="text-teal-700 font-medium">已选 {selectedOrderIds.length} 件</span>
                      <span className="text-teal-600">总重量：{totalWeight}g</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700"
                      disabled={selectedOrderIds.length === 0}
                      onClick={() => setCreateStep(2)}>
                      下一步 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: ADDRESS + DETAILS */}
              {createStep === 2 && (
                <div className="space-y-4">
                  {/* Address picker */}
                  {savedAddresses.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5" />收货地址
                      </Label>
                      <Select value={selectedAddressId} onValueChange={handleAddressSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择地址..." />
                        </SelectTrigger>
                        <SelectContent>
                          {savedAddresses.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                          ))}
                          <SelectItem value="__new__">
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <Plus className="w-3.5 h-3.5" />输入新地址
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Saved address preview */}
                  {!useNewAddress && savedAddresses.length > 0 && (() => {
                    const addr = savedAddresses.find(a => a.id === selectedAddressId);
                    return addr ? (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{addr.full_text}</div>
                    ) : null;
                  })()}

                  {/* New address form */}
                  {(useNewAddress || savedAddresses.length === 0) && (
                    <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">收件人姓名 *</Label>
                          <Input className="mt-1 h-8 text-sm" value={form.recipient_name} onChange={e => f("recipient_name", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">联系电话</Label>
                          <Input className="mt-1 h-8 text-sm" value={form.recipient_phone} onChange={e => f("recipient_phone", e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">地址行1</Label>
                        <Input className="mt-1 h-8 text-sm" placeholder="街道、门牌号" value={form.address_line1} onChange={e => f("address_line1", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">地址行2（可选）</Label>
                        <Input className="mt-1 h-8 text-sm" placeholder="单元、楼层" value={form.address_line2} onChange={e => f("address_line2", e.target.value)} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-gray-500">城市</Label>
                          <Input className="mt-1 h-8 text-sm" value={form.city} onChange={e => f("city", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">州/省</Label>
                          <Input className="mt-1 h-8 text-sm" value={form.state} onChange={e => f("state", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">邮编</Label>
                          <Input className="mt-1 h-8 text-sm" value={form.postal_code} onChange={e => f("postal_code", e.target.value)} />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={saveAddress} onCheckedChange={setSaveAddress} />
                        <span className="text-xs text-gray-600">保存此地址到地址簿</span>
                      </label>
                      {saveAddress && (
                        <Input className="h-8 text-sm" placeholder="地址标签（如：家、公司）" value={newAddressLabel} onChange={e => setNewAddressLabel(e.target.value)} />
                      )}
                    </div>
                  )}

                  {/* Country + method */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">目的国家 *</Label>
                      <CountrySelect
                        value={form.destination_country}
                        onChange={v => f("destination_country", v)}
                        placeholder="选择国家"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">运输方式</Label>
                      <Select value={form.shipping_method} onValueChange={v => f("shipping_method", v)}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="选择..." /></SelectTrigger>
                        <SelectContent>
                          {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Transit + date */}
                  <div className="grid grid-cols-2 gap-3">
                    {transitLocations.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-500">中转地（可选）</Label>
                        <Select value={form.transit_location_id} onValueChange={v => f("transit_location_id", v)}>
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="选择..." /></SelectTrigger>
                          <SelectContent>
                            {transitLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-gray-500">计划发货日期</Label>
                      <Input type="date" className="mt-1 h-8 text-sm" value={form.scheduled_ship_date} onChange={e => f("scheduled_ship_date", e.target.value)} />
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <Label className="text-xs text-gray-500">备注（可选）</Label>
                    <Textarea rows={2} className="mt-1 text-sm" placeholder="特殊要求..." value={form.user_note} onChange={e => f("user_note", e.target.value)} />
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{selectedOrders.length} 件包裹 · {totalWeight}g</span>
                    {form.destination_country && <span>→ {getCountry(form.destination_country)?.name || form.destination_country}</span>}
                    {form.shipping_method && <span>{SHIPPING_METHODS.find(m => m.value === form.shipping_method)?.label}</span>}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button variant="outline" size="sm" onClick={() => setCreateStep(1)}>
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />上一步
                    </Button>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700"
                      disabled={submitting || !form.destination_country}
                      onClick={handleSubmit}>
                      {submitting ? "提交中..." : "确认创建发货申请"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {tab.label}
            {tab.key === "pools" && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{pools.length}</span>}
            {tab.key === "consolidation" && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{consolidationOrders.length}</span>}
          </button>
        ))}
      </div>

      {/* ---- TAB: SHIPPING POOLS ---- */}
      {activeTab === "pools" && (
        <>
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
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
              <p className="text-xs mt-1">点击右上角"新增发货申请"开始</p>
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

      {/* ---- TAB: CONSOLIDATION POOL ---- */}
      {activeTab === "consolidation" && (
        <>
          {/* Summary */}
          {consolidationOrders.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{consolidationOrders.length}</div>
                <div className="text-xs text-blue-500 mt-0.5">等待拼邮的包裹</div>
              </div>
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-teal-700">{consTotalWeight}g</div>
                <div className="text-xs text-teal-500 mt-0.5">当前总重量</div>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{Object.keys(consGroups).length}</div>
                <div className="text-xs text-purple-500 mt-0.5">发货方式分组</div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>拼邮池显示所有申请拼邮且等待凑单的包裹。通知发货时选择"申请拼邮"即可加入。</p>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : consolidationOrders.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <Layers className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">暂无等待拼邮的包裹</p>
              <p className="text-xs mt-1">通知发货时选择"申请拼邮"即可加入拼邮池</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(consGroups).map(([method, groupOrders]) => {
                const groupWeight = groupOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
                const minWeight = Math.max(...groupOrders.map(o => o.consolidation_min_weight_g || 0).filter(Boolean));
                const deadline = groupOrders.map(o => o.consolidation_deadline).filter(Boolean).sort()[0];
                return (
                  <div key={method} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-800 text-sm">{METHOD_LABELS[method] || method}</span>
                        <Badge variant="outline" className="text-xs">{groupOrders.length} 件</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Scale className="w-3 h-3" />{groupWeight}g</span>
                        {deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{deadline}</span>}
                      </div>
                    </div>
                    {minWeight > 0 && (
                      <div className="px-4 py-2 border-b bg-white">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>凑单进度</span><span>{groupWeight}g / {minWeight}g</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (groupWeight / minWeight) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="divide-y divide-gray-50">
                      {groupOrders.map(o => (
                        <div key={o.id} className="px-4 py-2.5 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{o.product_name}</p>
                            <p className="text-xs text-gray-400">{o.order_number} · {o.weight_g || 100}g</p>
                          </div>
                          <div className="ml-2 flex-shrink-0 text-right text-xs">
                            {o.consolidation_timeout_action && <span className="text-gray-400">{TIMEOUT_LABELS[o.consolidation_timeout_action]}</span>}
                            {o.consolidation_deadline && <p className="text-orange-500 mt-0.5">截止 {o.consolidation_deadline}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedPool && user && (
        <ShippingPoolDetailModal
          pool={selectedPool}
          isAdmin={false}
          currentUser={user}
          onClose={() => setSelectedPool(null)}
          onUpdated={() => { setSelectedPool(null); fetchData(user); }}
        />
      )}
    </div>
  );
}