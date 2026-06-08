/**
 * OfficialPoolOrderDetailModal
 * Todoist-style sub-task detail for a single order within an official pool.
 * Shows order info, lets user:
 *   - Edit note + images
 *   - Change addons
 *   - Override final address (or use group address)
 *   - Send message
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi } from "@/lib/tenantApi";
import { EMPTY_ADDRESS_FORM, serializeAddressToText } from "@/components/common/AddressForm";
import AddressForm from "@/components/common/AddressForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Package, MapPin, Image as ImageIcon, Loader2, Link as LinkIcon, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ORDER_STATUS_LABELS = {
  in_warehouse: "已入库", pending_purchase: "待购买", purchased: "已购买",
  shipped: "已发货", delivered: "已签收",
};

export default function OfficialPoolOrderDetailModal({ pool, group, orderEntry, order, shippingAddons = [], savedAddresses = [], onClose, onSuccess }) {
  const [note, setNote] = useState(orderEntry.note || "");
  const [imageUrls, setImageUrls] = useState(orderEntry.image_urls || []);
  const [selectedAddonIds, setSelectedAddonIds] = useState(orderEntry.selected_addon_ids || []);
  const [useGroupAddress, setUseGroupAddress] = useState(orderEntry.use_group_address !== false);
  const [overrideAddress, setOverrideAddress] = useState(orderEntry.override_final_address || { ...EMPTY_ADDRESS_FORM });
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrls(prev => [...prev, file_url]);
    setUploadingImage(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const selectedAddons = shippingAddons.filter(a => selectedAddonIds.includes(a.id))
      .map(a => ({ id: a.id, name: a.name, fee: a.fee, fee_currency: a.fee_currency }));

    const updatedEntry = {
      ...orderEntry,
      note,
      image_urls: imageUrls,
      selected_addon_ids: selectedAddonIds,
      selected_addons: selectedAddons,
      use_group_address: useGroupAddress,
      override_final_address: useGroupAddress ? null : overrideAddress,
    };

    const newGroups = (pool.per_user_groups || []).map(g => {
      if (g.user_email !== group.user_email) return g;
      return {
        ...g,
        order_entries: (g.order_entries || []).map(e =>
          e.order_id === orderEntry.order_id ? updatedEntry : e
        ),
      };
    });

    await shippingPoolApi.update(pool.id, { per_user_groups: newGroups });
    setSaving(false);
    onSuccess?.();
  };

  const handleSavedAddressSelect = (id) => {
    if (id === "__new__") {
      setSelectedSavedId("");
      setOverrideAddress({ ...EMPTY_ADDRESS_FORM });
    } else {
      const addr = savedAddresses.find(a => a.id === id);
      if (addr) {
        setOverrideAddress({ ...EMPTY_ADDRESS_FORM, ...addr });
        setSelectedSavedId(id);
      }
    }
  };

  const groupAddress = group.group_final_address;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 text-sm truncate">{order?.product_name || "订单详情"}</h2>
              <p className="text-xs text-gray-400">{order?.order_number || orderEntry.order_id.slice(-8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Order info */}
          {order && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">状态</span>
                <Badge className="bg-blue-100 text-blue-700 text-xs">{ORDER_STATUS_LABELS[order.order_status] || order.order_status}</Badge>
              </div>
              {order.weight_g > 0 && (
                <div className="flex items-center justify-between"><span className="text-gray-500">重量</span><span className="font-medium">{order.weight_g}g</span></div>
              )}
              {order.estimated_jpy > 0 && (
                <div className="flex items-center justify-between"><span className="text-gray-500">估价</span><span className="font-medium">¥{order.estimated_jpy?.toLocaleString()}</span></div>
              )}
              {order.product_url && (
                <a href={order.product_url.split("\n")[0]} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline">
                  <LinkIcon className="w-3 h-3" />商品链接
                </a>
              )}
            </div>
          )}

          {/* Addons */}
          {shippingAddons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">此订单的增值服务</p>
              <div className="space-y-1.5">
                {shippingAddons.map(a => (
                  <label key={a.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedAddonIds.includes(a.id) ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedAddonIds.includes(a.id)} onCheckedChange={v => setSelectedAddonIds(prev => v ? [...prev, a.id] : prev.filter(id => id !== a.id))} />
                      <span className="text-sm font-medium text-gray-800">{a.name}</span>
                    </div>
                    <span className="text-xs text-yellow-700">+{a.fee_currency || "JPY"} {Number(a.fee || 0).toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">订单备注</p>
            <Textarea rows={2} className="text-sm" placeholder="此订单的特殊要求..." value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* Images */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">图片备注</p>
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
            </p>

            {/* Toggle: use group address */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${useGroupAddress ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" checked={useGroupAddress} onChange={() => setUseGroupAddress(true)} className="mt-0.5 accent-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">使用任务组地址</p>
                {groupAddress && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                    {groupAddress.recipient_name}{groupAddress.state ? ` · ${groupAddress.state}` : ""}
                  </p>
                )}
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!useGroupAddress ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" checked={!useGroupAddress} onChange={() => setUseGroupAddress(false)} className="mt-0.5 accent-blue-600" />
              <span className="text-sm font-medium text-gray-800">为此订单指定独立地址</span>
            </label>

            {!useGroupAddress && (
              <div className="space-y-3 ml-2">
                {savedAddresses.length > 0 && (
                  <Select value={selectedSavedId || "__new__"} onValueChange={handleSavedAddressSelect}>
                    <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="从地址簿选择" /></SelectTrigger>
                    <SelectContent>
                      {savedAddresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                      <SelectItem value="__new__"><span className="flex items-center gap-1.5 text-blue-600"><PlusCircle className="w-3.5 h-3.5" />手动填写</span></SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <AddressForm value={overrideAddress} onChange={v => setOverrideAddress(p => ({ ...p, ...v }))} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={handleSave}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />保存中...</> : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}