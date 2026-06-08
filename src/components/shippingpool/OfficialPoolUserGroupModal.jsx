/**
 * OfficialPoolUserGroupModal
 * Edit a user's task group within an official pool:
 * - Group label, note, images
 * - Group-level addons
 * - Group-level final address + "sync all" button
 * Todoist-style parent task editing.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi } from "@/lib/tenantApi";
import { EMPTY_ADDRESS_FORM, isAddressFormValid, serializeAddressToText } from "@/components/common/AddressForm";
import AddressForm from "@/components/common/AddressForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, MapPin, Users, Image as ImageIcon, Loader2, CopyCheck, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OfficialPoolUserGroupModal({ pool, group, shippingAddons = [], savedAddresses = [], onClose, onSuccess }) {
  const [groupLabel, setGroupLabel] = useState(group.group_label || group.user_name || "");
  const [note, setNote] = useState(group.note || "");
  const [imageUrls, setImageUrls] = useState(group.image_urls || []);
  const [selectedAddonIds, setSelectedAddonIds] = useState(group.selected_addon_ids || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Address state
  const [groupAddress, setGroupAddress] = useState(group.group_final_address || { ...EMPTY_ADDRESS_FORM });
  const [addressMode, setAddressMode] = useState(group.group_final_address ? "custom" : "saved");
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [syncConfirm, setSyncConfirm] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrls(prev => [...prev, file_url]);
    setUploadingImage(false);
  };

  const handleSave = async (syncAddressToAll = false) => {
    setSaving(true);
    const selectedAddons = shippingAddons.filter(a => selectedAddonIds.includes(a.id))
      .map(a => ({ id: a.id, name: a.name, fee: a.fee, fee_currency: a.fee_currency }));

    const updatedGroup = {
      ...group,
      group_label: groupLabel,
      note,
      image_urls: imageUrls,
      selected_addon_ids: selectedAddonIds,
      selected_addons: selectedAddons,
      group_final_address: groupAddress,
    };

    // If sync, update all order_entries to use_group_address: true
    if (syncAddressToAll) {
      updatedGroup.order_entries = (group.order_entries || []).map(e => ({
        ...e,
        use_group_address: true,
        override_final_address: null,
      }));
    }

    const newGroups = (pool.per_user_groups || []).map(g =>
      g.user_email === group.user_email ? updatedGroup : g
    );

    await shippingPoolApi.update(pool.id, { per_user_groups: newGroups });
    setSaving(false);
    onSuccess?.();
  };

  const handleAddressSave = (v) => setGroupAddress(p => ({ ...p, ...v }));

  const handleSavedAddressSelect = (id) => {
    if (id === "__custom__") {
      setAddressMode("custom");
      setSelectedSavedId("");
    } else {
      const addr = savedAddresses.find(a => a.id === id);
      if (addr) {
        setGroupAddress({ ...EMPTY_ADDRESS_FORM, ...addr });
        setSelectedSavedId(id);
        setAddressMode("saved");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-900 text-sm">编辑用户任务组</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Group label */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">任务组名称</p>
            <Input className="h-8 text-sm" value={groupLabel} onChange={e => setGroupLabel(e.target.value)} placeholder="默认为用户名" />
          </div>

          {/* Addons */}
          {shippingAddons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">发货增值服务（任务组默认）</p>
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
            <p className="text-xs font-medium text-gray-500 mb-1.5">任务组备注</p>
            <Textarea rows={2} className="text-sm" placeholder="整批货物的特殊要求..." value={note} onChange={e => setNote(e.target.value)} />
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />任务组最终收货地址
              </p>
              {(group.order_entries || []).length > 1 && (
                <button
                  onClick={() => setSyncConfirm(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                  <CopyCheck className="w-3.5 h-3.5" />统一任务组下的最终收货地址
                </button>
              )}
            </div>

            {syncConfirm && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-xs">
                <p className="text-orange-700 font-medium mb-2">确认将此地址同步到该任务组下所有订单？</p>
                <p className="text-orange-600 mb-2">所有子任务将使用此任务组地址，单独设置的地址将被覆盖。</p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-6 text-xs bg-orange-600 hover:bg-orange-700" onClick={() => { setSyncConfirm(false); handleSave(true); }}>确认同步</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setSyncConfirm(false)}>取消</Button>
                </div>
              </div>
            )}

            {savedAddresses.length > 0 && (
              <Select value={addressMode === "saved" ? (selectedSavedId || "") : "__custom__"} onValueChange={handleSavedAddressSelect}>
                <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="从地址簿选择" /></SelectTrigger>
                <SelectContent>
                  {savedAddresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  <SelectItem value="__custom__"><span className="flex items-center gap-1.5 text-blue-600"><PlusCircle className="w-3.5 h-3.5" />手动填写</span></SelectItem>
                </SelectContent>
              </Select>
            )}

            <AddressForm value={groupAddress} onChange={handleAddressSave} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={() => handleSave(false)}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />保存中...</> : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}