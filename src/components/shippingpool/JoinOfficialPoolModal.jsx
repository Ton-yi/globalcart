/**
 * JoinOfficialPoolModal
 * Todoist-style: user picks in-warehouse orders to add to an official pool,
 * sets addons, note, image, and default final address.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity, fetchTenantConfig } from "@/lib/tenantApi";
import { EMPTY_ADDRESS_FORM, isAddressFormValid, serializeAddressToText } from "@/components/common/AddressForm";
import AddressForm from "@/components/common/AddressForm";
import { shippingPoolApi } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Package, MapPin, PlusCircle, Image as ImageIcon, Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";

export default function JoinOfficialPoolModal({ pool, currentUser, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1=select orders, 2=details+address
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [shippingAddons, setShippingAddons] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [note, setNote] = useState("");
  const [imageUrls, setImageUrls] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Address
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "", ...EMPTY_ADDRESS_FORM });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, configData, prefs] = await Promise.all([
      base44.functions.invoke('getTenantOrders', {}).then(r => (r.data?.orders || []).filter(o => o.order_status === "in_warehouse")),
      fetchTenantConfig(),
      tenantEntity.list('UserPreference', { user_email: currentUser.email }).catch(() => []),
    ]);

    // Filter out orders already in this pool
    const alreadyInPool = new Set(pool.order_ids || []);
    setAvailableOrders(ordersRes.filter(o => !alreadyInPool.has(o.id)));
    setShippingAddons((configData.addons || []).filter(a => a.addon_type === "shipping" && a.is_active !== false));

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
    }
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrls(prev => [...prev, file_url]);
    setUploadingImage(false);
  };

  const getEffectiveAddress = () => {
    if (useNewAddress) return newAddress;
    return savedAddresses.find(a => a.id === selectedAddressId) || null;
  };

  const handleSubmit = async () => {
    if (selectedOrderIds.length === 0) return;
    setSubmitting(true);

    const effectiveAddr = getEffectiveAddress();
    const selectedAddons = shippingAddons.filter(a => selectedAddonIds.includes(a.id))
      .map(a => ({ id: a.id, name: a.name, fee: a.fee, fee_currency: a.fee_currency }));

    // Build order entries (sub-tasks)
    const orderEntries = selectedOrderIds.map(order_id => ({
      order_id,
      note: "",
      image_urls: [],
      selected_addon_ids: selectedAddonIds,
      selected_addons: selectedAddons,
      use_group_address: true,
      override_final_address: null,
    }));

    // Merge into existing per_user_groups
    const existingGroups = pool.per_user_groups || [];
    const existingGroupIdx = existingGroups.findIndex(g => g.user_email === currentUser.email);

    let newGroups;
    if (existingGroupIdx >= 0) {
      // Merge: append new order entries to existing group
      newGroups = existingGroups.map((g, i) => {
        if (i !== existingGroupIdx) return g;
        const existingOrderIds = new Set((g.order_entries || []).map(e => e.order_id));
        const newEntries = orderEntries.filter(e => !existingOrderIds.has(e.order_id));
        return {
          ...g,
          order_entries: [...(g.order_entries || []), ...newEntries],
        };
      });
    } else {
      // Create new group
      const newGroup = {
        user_email: currentUser.email,
        user_name: currentUser.full_name || currentUser.email,
        group_label: currentUser.full_name || currentUser.email,
        note,
        image_urls: imageUrls,
        selected_addon_ids: selectedAddonIds,
        selected_addons: selectedAddons,
        group_final_address: effectiveAddr ? { ...effectiveAddr } : null,
        order_entries: orderEntries,
      };
      newGroups = [...existingGroups, newGroup];
    }

    // Update pool: add orders to order_ids + update per_user_groups
    const newOrderIds = [...new Set([...(pool.order_ids || []), ...selectedOrderIds])];
    const addedOrders = availableOrders.filter(o => selectedOrderIds.includes(o.id));
    const addedWeight = addedOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
    const newOrderNames = [...(pool.order_names || []), ...addedOrders.map(o => o.product_name).filter(Boolean)];

    await shippingPoolApi.update(pool.id, {
      order_ids: newOrderIds,
      order_names: newOrderNames,
      total_weight_g: (pool.total_weight_g || 0) + addedWeight,
      per_user_groups: newGroups,
    });

    setSubmitting(false);
    onSuccess?.();
  };

  const totalWeight = availableOrders.filter(o => selectedOrderIds.includes(o.id)).reduce((s, o) => s + (o.weight_g || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">加入官方拼邮</h2>
            <p className="text-xs text-gray-400 mt-0.5">{pool.title || pool.pool_code}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Steps indicator */}
        <div className="px-5 py-2.5 border-b border-gray-50 flex items-center gap-3">
          {[{ n: 1, label: "选择包裹" }, { n: 2, label: "备注 & 地址" }].map(s => (
            <div key={s.n} className={`flex items-center gap-1.5 text-xs font-medium ${step === s.n ? "text-blue-700" : step > s.n ? "text-green-600" : "text-gray-400"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === s.n ? "bg-blue-600 text-white" : step > s.n ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                {step > s.n ? <Check className="w-3 h-3" /> : s.n}
              </div>
              {s.label}
              {s.n < 2 && <ChevronRight className="w-3 h-3 text-gray-300 ml-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : step === 1 ? (
            <div className="space-y-3">
              {availableOrders.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">暂无已入库的订单可加入</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500">选择要加入此拼邮的已入库包裹：</p>
                  <div className="space-y-2">
                    {availableOrders.map(o => (
                      <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedOrderIds.includes(o.id) ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                        <Checkbox checked={selectedOrderIds.includes(o.id)} onCheckedChange={() => setSelectedOrderIds(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{o.product_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{o.order_number || o.id.slice(0, 8)} · {o.weight_g || 0}g</p>
                        </div>
                        {selectedOrderIds.includes(o.id) && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                      </label>
                    ))}
                  </div>
                  {selectedOrderIds.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
                      <span className="text-blue-700 font-medium">已选 {selectedOrderIds.length} 件</span>
                      <span className="text-blue-600">总重量：{totalWeight}g</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Addons */}
              {shippingAddons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">发货增值服务（可选）</p>
                  <div className="space-y-1.5">
                    {shippingAddons.map(a => (
                      <label key={a.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedAddonIds.includes(a.id) ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"}`}>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={selectedAddonIds.includes(a.id)} onCheckedChange={v => setSelectedAddonIds(prev => v ? [...prev, a.id] : prev.filter(id => id !== a.id))} />
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
                <p className="text-xs font-medium text-gray-500 mb-1.5">备注（可选）</p>
                <Textarea rows={2} className="text-sm" placeholder="特殊要求、包装说明等..." value={note} onChange={e => setNote(e.target.value)} />
              </div>

              {/* Images */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">图片备注（可选）</p>
                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ImageIcon className="w-4 h-4 text-gray-400" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              </div>

              {/* Final address */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />最终收货地址
                  <span className="text-gray-400 font-normal">（中转地发出后送达此处）</span>
                </p>
                {savedAddresses.length > 0 && (
                  <Select value={useNewAddress ? "__new__" : (selectedAddressId || "")} onValueChange={v => {
                    if (v === "__new__") { setSelectedAddressId(""); setUseNewAddress(true); }
                    else { setSelectedAddressId(v); setUseNewAddress(false); }
                  }}>
                    <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="选择收货地址" /></SelectTrigger>
                    <SelectContent>
                      {savedAddresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                      <SelectItem value="__new__"><span className="flex items-center gap-1.5 text-blue-600"><PlusCircle className="w-3.5 h-3.5" />输入新地址</span></SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {!useNewAddress && selectedAddressId && (() => {
                  const addr = savedAddresses.find(a => a.id === selectedAddressId);
                  return addr ? <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap">{addr.full_text || serializeAddressToText(addr)}</div> : null;
                })()}
                {(useNewAddress || savedAddresses.length === 0) && (
                  <AddressForm value={newAddress} onChange={v => setNewAddress(p => ({ ...p, ...v }))} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
          {step === 1 ? (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                disabled={selectedOrderIds.length === 0}
                onClick={() => setStep(2)}>
                下一步 <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />上一步
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
                onClick={handleSubmit}>
                {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />提交中...</> : "确认加入"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}