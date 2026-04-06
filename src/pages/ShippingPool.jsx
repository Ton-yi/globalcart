/**
 * ShippingPool - 合并"发货申请"和"拼邮池"的用户页面
 * 创建表单为页面内嵌展开，不弹窗
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { fetchShippingPools, tenantEntity, fetchTenantConfig } from "@/lib/tenantApi";
import { timePage } from "@/lib/timing";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Plus, RefreshCw, Truck, X, Package, MapPin, ChevronRight, ChevronLeft, Check, Scale, Calendar, Info, Layers, Lock, Users, Search, PlusCircle } from "lucide-react";
import { getCountry } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import AddressForm, { EMPTY_ADDRESS_FORM, serializeAddressToText, isAddressFormValid } from "@/components/common/AddressForm";
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
  { v: "all",              l: "全部" },
  { v: "pending",          l: "待处理" },
  { v: "awaiting_payment", l: "待付款" },
  { v: "ready_to_ship",    l: "待发货" },
  { v: "shipped",          l: "已发货" },
  { v: "delivered",        l: "已签收" },
];

const TABS = [
  { key: "pools", label: "发货申请" },
  { key: "consolidation", label: "拼邮池" },
];

const METHOD_LABELS = {
  EMS: "EMS", surface: "海运", small_packet_air: "小型包装物空运",
};

export default function ShippingPool() {
  const { user } = useCurrentUser();
  const [pools, setPools] = useState([]);
  const [consolidationOrders, setConsolidationOrders] = useState([]);
  const [pendingEditRequests, setPendingEditRequests] = useState([]);
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
  const [newAddress, setNewAddress] = useState({ label: "", ...EMPTY_ADDRESS_FORM });
  const [transitLocations, setTransitLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    shipping_method: "", scheduled_ship_date: "", transit_location_id: "", user_note: "",
  });
  // consolidation type: "" = none, "transit" = to transit location, "other" = to saved address
  const [consType, setConsType] = useState("");
  // Final address for transit consolidation (new address mode)
  const [transitFinalAddressId, setTransitFinalAddressId] = useState("");
  const [transitUseNewAddress, setTransitUseNewAddress] = useState(false);
  const [transitNewAddress, setTransitNewAddress] = useState({ label: "", ...EMPTY_ADDRESS_FORM });
  const [transitSaveAddress, setTransitSaveAddress] = useState(false);
  // Privacy
  const [isPrivate, setIsPrivate] = useState(false);
  const [sharedWithEmails, setSharedWithEmails] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [shippingAddons, setShippingAddons] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [userProfileMap, setUserProfileMap] = useState({});

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchData = async (_u) => {
    setLoading(true);
    const t = timePage('ShippingPool');
    const [allPools, myOrders, editReqs, usersRes] = await Promise.all([
      t.timeCall('getTenantShippingPools', () => fetchShippingPools()),
      t.timeCall('getTenantOrders', () => base44.functions.invoke('getTenantOrders', {}).then(r => r.data?.orders || [])),
      base44.functions.invoke('getMyShippingEditRequests', {}).then(r => r.data?.requests || []).catch(() => []),
      base44.functions.invoke('getTenantUsers', {}).then(r => r.data?.users || []).catch(() => []),
    ]);
    // Build userProfileMap from users list
    const profileMap = {};
    (usersRes || []).forEach(u => { profileMap[u.email] = u; });
    setUserProfileMap(profileMap);
    setPools(allPools);
    setPendingEditRequests(editReqs.filter(r => r.status === 'pending'));

    const consPools = allPools.filter(p => p.consolidation_type && p.consolidation_type !== "");
    const consOrderIds = new Set(consPools.flatMap(p => p.order_ids || []));
    setConsolidationOrders(myOrders.filter(o => o.order_status === "notified_shipment" && consOrderIds.has(o.id)));
    setLoading(false);
    t.done('data ready');
  };

  useEffect(() => {
    if (user) fetchData(user);
  }, [user]);

  // Open inline create form
  const handleOpenCreate = async () => {
    setShowCreate(true);
    setCreateStep(1);
    setSelectedOrderIds([]);
    setForm({ shipping_method: "", scheduled_ship_date: "", transit_location_id: "", user_note: "" });
    setConsType("");
    setNewAddress({ label: "", ...EMPTY_ADDRESS_FORM });
    setSaveAddress(false);
    setTransitFinalAddressId("");
    setTransitUseNewAddress(false);
    setTransitNewAddress({ label: "", ...EMPTY_ADDRESS_FORM });
    setTransitSaveAddress(false);
    setIsPrivate(false);
    setSharedWithEmails([]);
    setUserSearchQuery("");
    setShippingAddons([]);
    setSelectedAddonIds([]);
    setFormLoading(true);
    const [configData, prefs, usersRes, inWarehouseOrders] = await Promise.all([
      fetchTenantConfig(),
      tenantEntity.list('UserPreference', { user_email: user.email }).catch(() => []),
      base44.functions.invoke("listTenantUsers", {}).catch(() => ({ data: { users: [] } })),
      base44.functions.invoke('getTenantOrders', {})
        .then(r => (r.data?.orders || []).filter(o => o.order_status === "in_warehouse"))
        .catch(() => []),
    ]);
    setAvailableOrders(inWarehouseOrders);
    setTransitLocations((configData.transitLocations || []).filter(l => l.is_active !== false));
    setShippingAddons((configData.addons || []).filter(a => a.addon_type === "shipping" && a.is_active !== false));
    setAllUsers(usersRes?.data?.users || []);
    const pref = prefs[0];
    const addrs = (pref?.saved_addresses || []).map(a => ({ ...EMPTY_ADDRESS_FORM, ...a }));
    setSavedAddresses(addrs);
    const defaultId = pref?.default_address_id || "";
    const defaultAddr = addrs.find(a => a.id === defaultId) || addrs[0];
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
      setUseNewAddress(false);
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

  const handleAddressSelect = (id) => {
    if (id === "__new__") {
      setSelectedAddressId("");
      setUseNewAddress(true);
      setNewAddress({ label: "", ...EMPTY_ADDRESS_FORM });
      setSaveAddress(false);
    } else {
      setSelectedAddressId(id);
      setUseNewAddress(false);
      setNewAddress({ label: "", ...EMPTY_ADDRESS_FORM });
      setSaveAddress(false);
    }
  };

  const toggleOrder = (id) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedOrders = availableOrders.filter(o => selectedOrderIds.includes(o.id));
  const totalWeight = selectedOrders.reduce((s, o) => s + (o.weight_g || 0), 0);

  const handleSubmit = async () => {
    if (selectedOrderIds.length === 0) return;
    setSubmitting(true);

    // Determine effective address fields
    const getAddrForSave = (addrObj) => {
      const { label, ...fields } = addrObj;
      return { label: label || "新地址", full_text: serializeAddressToText(fields), ...fields };
    };

    const needSaveDirect = useNewAddress && saveAddress && isAddressFormValid(newAddress);
    const needSaveTransit = consType === "transit" && transitUseNewAddress && transitSaveAddress && isAddressFormValid(transitNewAddress);

    if (needSaveDirect || needSaveTransit) {
      const existingPrefs = await tenantEntity.list('UserPreference', { user_email: user.email });
      const existingAddrs = existingPrefs[0]?.saved_addresses || [];
      const newEntries = [];
      if (needSaveDirect) newEntries.push({ id: Date.now().toString(), ...getAddrForSave(newAddress) });
      if (needSaveTransit) newEntries.push({ id: (Date.now() + 1).toString(), ...getAddrForSave(transitNewAddress) });
      if (existingPrefs.length > 0) {
        await tenantEntity.update('UserPreference', existingPrefs[0].id, { saved_addresses: [...existingAddrs, ...newEntries] });
      } else {
        await tenantEntity.create('UserPreference', { user_email: user.email, saved_addresses: newEntries });
      }
    }

    const transitLoc = transitLocations.find(l => l.id === form.transit_location_id);
    const isAsap = form.scheduled_ship_date === "__asap__";

    // Determine destination_country
    let destinationCountry = "";
    if (useNewAddress) {
      destinationCountry = newAddress.country || "";
    } else {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      destinationCountry = addr?.country || "";
    }

    const prefix = consType === "transit" && transitLoc?.code_prefix
      ? transitLoc.code_prefix.toUpperCase()
      : "AAA";
    const allPools = await fetchShippingPools();
    const prefixPools = allPools.filter(p => p.pool_code && p.pool_code.startsWith(prefix));
    const nextSeq = (prefixPools.length + 1).toString().padStart(5, "0");
    const pool_code = `${prefix}${nextSeq}`;

    // Build address fields for pool record
    const directAddr = useNewAddress ? newAddress : (savedAddresses.find(a => a.id === selectedAddressId) || {});
    const finalAddr = transitUseNewAddress ? transitNewAddress : (savedAddresses.find(a => a.id === transitFinalAddressId) || {});

    await tenantEntity.create('ShippingPool', {
      pool_code,
      shipping_method: form.shipping_method,
      scheduled_ship_date: isAsap ? "" : form.scheduled_ship_date,
      asap: isAsap,
      transit_location_id: form.transit_location_id || "",
      user_note: form.user_note || "",
      consolidation_type: consType || "",
      order_ids: selectedOrderIds,
      creator_email: user.email,
      creator_name: user.full_name || user.email,
      is_admin_created: false,
      total_weight_g: totalWeight,
      status: "pending",
      destination_country: destinationCountry,
      transit_location_name: transitLoc?.name || "",
      final_address_id: consType === "transit" ? (transitUseNewAddress ? "" : transitFinalAddressId) : "",
      recipient_name: consType === "transit" ? (finalAddr.recipient_name || "") : (directAddr.recipient_name || ""),
      address_line1: consType === "transit" ? (finalAddr.addr1 || "") : (directAddr.addr1 || ""),
      address_line2: consType === "transit" ? (finalAddr.addr2 || "") : (directAddr.addr2 || ""),
      city: consType === "transit" ? (finalAddr.addr3 || "") : (directAddr.addr3 || ""),
      state: consType === "transit" ? (finalAddr.state || "") : (directAddr.state || ""),
      messages: [],
      is_private: isPrivate,
      shared_with_emails: isPrivate ? sharedWithEmails : [],
      selected_addon_ids: selectedAddonIds,
      selected_addons: shippingAddons
        .filter(a => selectedAddonIds.includes(a.id))
        .map(a => ({ id: a.id, name: a.name, fee: a.fee, fee_currency: a.fee_currency })),
    });

    await Promise.all(selectedOrderIds.map(id =>
      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: "notified_shipment" })
    ));

    setSubmitting(false);
    handleCloseCreate();
    fetchData(user);
  };

  const filtered = pools.filter(p => statusFilter === "all" || p.status === statusFilter);
  const consTotalWeight = consolidationOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
  const consGroups = consolidationOrders.reduce((acc, o) => {
    const key = o.consolidation_pool_id || o.shipping_method || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

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
                  {/* Consolidation type selection */}
                  <div>
                    <Label className="text-xs text-gray-500 font-medium mb-2 block">发货方式</Label>
                    <div className="space-y-2">
                      {[
                        { key: "", label: "直接发货（单独发往收货地址）", desc: "" },
                        { key: "transit", label: "申请拼邮到中转地", desc: "与其他包裹合并，发往中转地" },
                        { key: "other", label: "申请拼邮到其它地址", desc: "与其他包裹合并，发往自选地址" },
                      ].map(opt => (
                        <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${consType === opt.key ? "border-red-300 bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}>
                          <input type="radio" checked={consType === opt.key} onChange={() => setConsType(opt.key)} className="mt-0.5 accent-red-600" />
                          <div>
                            <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                            {opt.desc && <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Transit location selector (only for consType="transit") */}
                  {consType === "transit" && (
                    <div className="space-y-3">
                      <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/40 space-y-3">
                        <Label className="text-xs text-blue-700 font-medium">选择中转地 *</Label>
                        {transitLocations.length === 0 ? (
                          <p className="text-xs text-gray-400">暂无可用中转地，请联系管理员添加</p>
                        ) : (
                          <div className="space-y-2">
                            {transitLocations.map(l => (
                              <label key={l.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.transit_location_id === l.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                                <input type="radio" checked={form.transit_location_id === l.id} onChange={() => f("transit_location_id", l.id)} className="mt-0.5 accent-blue-600" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800">{l.name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {[getCountry(l.country)?.name || l.country, l.province].filter(Boolean).join(" · ")}
                                    {l.handling_fee > 0 && ` · 手续费 ${l.handling_fee_currency || "JPY"} ${l.handling_fee}`}
                                    {l.allow_storage && " · 支持暂存"}
                                  </p>
                                  {l.manager_contact && (
                                    <p className="text-xs text-gray-400">联系：{l.manager_contact}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Final delivery address after transit */}
                      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60 space-y-3">
                        <Label className="text-xs text-gray-600 font-medium flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          最终收货地址（货品从中转地发往此处）
                        </Label>
                        {savedAddresses.length > 0 && (
                          <Select value={transitUseNewAddress ? "__new__" : (transitFinalAddressId || "")} onValueChange={v => {
                            if (v === "__new__") {
                              setTransitFinalAddressId("");
                              setTransitUseNewAddress(true);
                            } else {
                              setTransitFinalAddressId(v);
                              setTransitUseNewAddress(false);
                              setTransitNewAddress({ label: "", ...EMPTY_ADDRESS_FORM });
                              setTransitSaveAddress(false);
                            }
                          }}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="选择地址簿中的收货地址" /></SelectTrigger>
                            <SelectContent>
                              {savedAddresses.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                              ))}
                              <SelectItem value="__new__">
                                <span className="flex items-center gap-1.5 text-blue-600"><PlusCircle className="w-3.5 h-3.5" />输入新地址</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {!transitUseNewAddress && transitFinalAddressId && (() => {
                          const addr = savedAddresses.find(a => a.id === transitFinalAddressId);
                          return addr ? (
                            <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap">{addr.full_text || serializeAddressToText(addr)}</div>
                          ) : null;
                        })()}
                        {(transitUseNewAddress || savedAddresses.length === 0) && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-500 font-medium block mb-1">地址标签</label>
                              <Input className="h-8 text-sm bg-white" placeholder="如：家、公司"
                                value={transitNewAddress.label}
                                onChange={e => setTransitNewAddress(p => ({ ...p, label: e.target.value }))} />
                            </div>
                            <AddressForm
                              value={transitNewAddress}
                              onChange={v => setTransitNewAddress(p => ({ ...p, ...v }))}
                            />
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox checked={transitSaveAddress} onCheckedChange={v => setTransitSaveAddress(!!v)} />
                              <span className="text-xs text-gray-600">保存此地址到地址簿</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Address section (for direct or consType="other") */}
                  {(consType === "" || consType === "other") && (
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60 space-y-3">
                      <Label className="text-xs text-gray-600 font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {consType === "other" ? "拼邮目标地址" : "收货地址"}
                      </Label>
                      {savedAddresses.length > 0 && (
                        <Select value={useNewAddress ? "__new__" : (selectedAddressId || "")} onValueChange={handleAddressSelect}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="选择地址簿中的地址" /></SelectTrigger>
                          <SelectContent>
                            {savedAddresses.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                            ))}
                            <SelectItem value="__new__">
                              <span className="flex items-center gap-1.5 text-blue-600">
                                <PlusCircle className="w-3.5 h-3.5" />输入新地址
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {!useNewAddress && selectedAddressId && (() => {
                        const addr = savedAddresses.find(a => a.id === selectedAddressId);
                        return addr ? (
                          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap">{addr.full_text || serializeAddressToText(addr)}</div>
                        ) : null;
                      })()}
                      {(useNewAddress || savedAddresses.length === 0) && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">地址标签</label>
                            <Input className="h-8 text-sm bg-white" placeholder="如：家、公司"
                              value={newAddress.label}
                              onChange={e => setNewAddress(p => ({ ...p, label: e.target.value }))} />
                          </div>
                          <AddressForm
                            value={newAddress}
                            onChange={v => setNewAddress(p => ({ ...p, ...v }))}
                          />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={saveAddress} onCheckedChange={v => setSaveAddress(!!v)} />
                            <span className="text-xs text-gray-600">保存此地址到地址簿</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shipping method */}
                  <div>
                    <Label className="text-xs text-gray-500">运输方式</Label>
                    <Select value={form.shipping_method} onValueChange={v => f("shipping_method", v)}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="选择..." /></SelectTrigger>
                      <SelectContent>
                        {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scheduled date with ASAP option */}
                  <div>
                    <Label className="text-xs text-gray-500">计划发货日期</Label>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => f("scheduled_ship_date", "__asap__")}
                        className={`flex items-center gap-1.5 px-3 h-8 rounded-md border text-sm transition-colors ${form.scheduled_ship_date === "__asap__" ? "border-orange-400 bg-orange-50 text-orange-600 font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                      >
                        ⚡ 尽快
                      </button>
                      <Input
                        type="date"
                        className="h-8 text-sm flex-1"
                        value={form.scheduled_ship_date === "__asap__" ? "" : form.scheduled_ship_date}
                        onChange={e => f("scheduled_ship_date", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Consolidation strategy - collapsible (only for consolidation types) */}
                  {consType !== "" && (
                    <div className="border border-blue-100 rounded-xl overflow-hidden">
                      <button type="button"
                        onClick={() => setStrategyOpen(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100/60 transition-colors">
                        <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">拼邮策略</p>
                        <span className="text-xs text-blue-400">{strategyOpen ? "收起 ▲" : "展开 ▼"}</span>
                      </button>
                      {strategyOpen && (
                        <div className="bg-blue-50 px-4 pb-4 text-xs text-gray-500 pt-2">
                          <p>拼邮策略配置（截止日期、凑满重量、超时处理等）可在通知发货时设置。</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Privacy setting (only when consolidation type selected) */}
                  {consType !== "" && (
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <label className={`flex items-center gap-3 cursor-pointer rounded-lg p-2 -m-2 transition-colors ${isPrivate ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                        <Checkbox checked={isPrivate} onCheckedChange={v => { setIsPrivate(!!v); if (!v) setSharedWithEmails([]); }} />
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">不公开</span>
                          <span className="text-xs text-gray-400">（仅管理员和指定用户可见）</span>
                        </div>
                      </label>
                      {isPrivate && (
                        <div className="ml-2 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Users className="w-3.5 h-3.5" />
                            <span>选择可查看此拼邮需求的用户（管理员始终可见）</span>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input placeholder="搜索用户..." className="pl-8 h-7 text-xs"
                              value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
                          </div>
                          {allUsers.length === 0 ? (
                            <p className="text-xs text-gray-400">暂无其他用户</p>
                          ) : (
                            <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                              {allUsers.filter(u => {
                                if (!userSearchQuery) return true;
                                const q = userSearchQuery.toLowerCase();
                                return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                              }).map(u => (
                                <label key={u.email} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                                  <Checkbox
                                    checked={sharedWithEmails.includes(u.email)}
                                    onCheckedChange={() => setSharedWithEmails(prev => prev.includes(u.email) ? prev.filter(e => e !== u.email) : [...prev, u.email])}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-gray-700">{u.full_name || u.email}</span>
                                    {u.full_name && <span className="text-xs text-gray-400 ml-1.5">{u.email}</span>}
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                          {sharedWithEmails.length > 0 && (
                            <p className="text-xs text-gray-500">已与 {sharedWithEmails.length} 位用户分享</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shipping Addons */}
                  {shippingAddons.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-500 font-medium block mb-2">发货增值服务（可选）</Label>
                      <div className="space-y-1.5">
                        {shippingAddons.map(a => (
                          <label key={a.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedAddonIds.includes(a.id) ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"}`}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedAddonIds.includes(a.id)}
                                onCheckedChange={v => setSelectedAddonIds(prev => v ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-800">{a.name}</span>
                                {a.description && <span className="text-xs text-gray-400 ml-2">{a.description}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-medium text-yellow-700 flex-shrink-0">+{a.fee_currency || "JPY"} {Number(a.fee || 0).toLocaleString()}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  <div>
                    <Label className="text-xs text-gray-500">备注（可选）</Label>
                    <Textarea rows={2} className="mt-1 text-sm" placeholder="特殊要求..." value={form.user_note} onChange={e => f("user_note", e.target.value)} />
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{selectedOrders.length} 件包裹 · {totalWeight}g</span>
                    {form.shipping_method && <span>{SHIPPING_METHODS.find(m => m.value === form.shipping_method)?.label}</span>}
                    {form.scheduled_ship_date === "__asap__" && <span className="text-orange-500">⚡ 尽快发出</span>}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button variant="outline" size="sm" onClick={() => setCreateStep(1)}>
                      <ChevronLeft className="w-3.5 h-3.5 mr-1" />上一步
                    </Button>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700"
                      disabled={submitting || (consType === "transit" && !form.transit_location_id)}
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
            {tab.key === "consolidation" && <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{pools.filter(p => p.consolidation_type && p.consolidation_type !== "").length}</span>}
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
                <ShippingPoolCard
                  key={pool.id}
                  pool={pool}
                  onClick={setSelectedPool}
                  pendingEditCount={pendingEditRequests.filter(r => r.pool_id === pool.id).length}
                  userProfileMap={userProfileMap}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- TAB: CONSOLIDATION POOL ---- */}
      {activeTab === "consolidation" && (
        <>
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
              {pools.filter(p => p.consolidation_type && p.consolidation_type !== "").map(pool => {
                const poolOrders = (pool.order_ids || [])
                  .map(id => consolidationOrders.find(o => o.id === id))
                  .filter(Boolean);
                if (poolOrders.length === 0) return null;
                const groupWeight = poolOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
                const minWeight = Math.max(...poolOrders.map(o => o.consolidation_min_weight_g || 0).filter(Boolean));
                const deadline = poolOrders.map(o => o.consolidation_deadline).filter(Boolean).sort()[0];
                const groupLabel = pool.consolidation_type === "transit"
                  ? (pool.transit_location_name || "中转地")
                  : "自选地址拼邮";
                const progressPct = minWeight > 0 ? Math.min(100, (groupWeight / minWeight) * 100) : 0;
                const isReady = minWeight > 0 && groupWeight >= minWeight;
                return (
                  <div key={pool.id}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md hover:border-gray-300 cursor-pointer transition-all"
                    onClick={() => setSelectedPool(pool)}
                  >
                    <div className={`px-4 py-3 border-b ${pool.consolidation_type === "transit" ? "bg-blue-50 border-blue-100" : "bg-purple-50 border-purple-100"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <Layers className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          <span className="font-semibold text-gray-800 text-sm truncate">{groupLabel}</span>
                          {pool.pool_code && (
                            <span className="text-xs font-mono bg-white/70 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">{pool.pool_code}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                          <Badge variant="outline" className="text-xs">{poolOrders.length} 件</Badge>
                          {isReady && <Badge className="text-xs bg-green-100 text-green-700 border-green-200">可发货</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        {pool.shipping_method && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{METHOD_LABELS[pool.shipping_method] || pool.shipping_method}</span>}
                        <span className="flex items-center gap-1"><Scale className="w-3 h-3" />{groupWeight}g</span>
                        {deadline && <span className="flex items-center gap-1 text-orange-500"><Calendar className="w-3 h-3" />截止 {deadline}</span>}
                      </div>
                    </div>

                    {minWeight > 0 && (
                      <div className="px-4 py-2.5 border-b bg-white">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-500">凑单进度</span>
                          <span className={isReady ? "text-green-600 font-medium" : "text-gray-500"}>{groupWeight}g / {minWeight}g</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isReady ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${progressPct}%` }} />
                        </div>
                        {!isReady && <p className="text-xs text-gray-400 mt-1">还差 {minWeight - groupWeight}g 可发货</p>}
                      </div>
                    )}

                    <div className="divide-y divide-gray-50">
                      {poolOrders.slice(0, 3).map(o => (
                        <div key={o.id} className="px-4 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800 truncate">{o.product_name}</p>
                            <p className="text-xs text-gray-400">{o.order_number} · {o.weight_g || 100}g</p>
                          </div>
                          {o.consolidation_deadline && (
                            <span className="text-xs text-orange-500 flex-shrink-0">截止 {o.consolidation_deadline}</span>
                          )}
                        </div>
                      ))}
                      {poolOrders.length > 3 && (
                        <div className="px-4 py-2 text-xs text-gray-400 text-center">还有 {poolOrders.length - 3} 件...</div>
                      )}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          )}
        </>
      )}

      {selectedPool && user && (
        <ShippingPoolDetailModal
          pool={selectedPool}
          isAdmin={false}
          currentUser={user}
          pendingEditRequests={pendingEditRequests.filter(r => r.pool_id === selectedPool.id)}
          onClose={() => setSelectedPool(null)}
          onUpdated={() => { setSelectedPool(null); fetchData(user); }}
        />
      )}
    </div>
  );
}