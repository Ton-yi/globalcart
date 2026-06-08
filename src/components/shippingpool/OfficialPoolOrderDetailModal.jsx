/**
 * OfficialPoolOrderDetailModal
 * Todoist-style sub-task detail for a single order within an official pool.
 * Notes are stored as an array of message objects: { text, image_urls, created_at }
 * Legacy single `note` + `image_urls` fields are migrated on first open.
 */
import { useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi } from "@/lib/tenantApi";
import { EMPTY_ADDRESS_FORM } from "@/components/common/AddressForm";
import AddressForm from "@/components/common/AddressForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Package, MapPin, Loader2, Link as LinkIcon, PlusCircle, Upload, Send, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ORDER_STATUS_LABELS = {
  in_warehouse: "已入库", pending_purchase: "待购买", purchased: "已购买",
  shipped: "已发货", delivered: "已签收",
};

// Migrate legacy note/image_urls to notes array
function initNotes(entry) {
  if (Array.isArray(entry.notes) && entry.notes.length > 0) return entry.notes;
  if (entry.note || (entry.image_urls && entry.image_urls.length > 0)) {
    return [{ text: entry.note || "", image_urls: entry.image_urls || [], created_at: entry.updated_date || new Date().toISOString() }];
  }
  return [];
}

export default function OfficialPoolOrderDetailModal({ pool, group, orderEntry, order, shippingAddons = [], savedAddresses = [], onClose, onSuccess }) {
  const [notes, setNotes] = useState(() => initNotes(orderEntry));
  const [draftText, setDraftText] = useState("");
  const [draftImages, setDraftImages] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState(orderEntry.selected_addon_ids || []);
  const [useGroupAddress, setUseGroupAddress] = useState(orderEntry.use_group_address !== false);
  const [overrideAddress, setOverrideAddress] = useState(orderEntry.override_final_address || { ...EMPTY_ADDRESS_FORM });
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const fileInputRef = useRef(null);

  const uploadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDraftImages(prev => [...prev, file_url]);
    setUploadingImage(false);
  }, []);

  const handleFileInput = async (e) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = "";
  };

  const handleSendNote = async () => {
    if (!draftText.trim() && draftImages.length === 0) return;
    const newNote = { text: draftText.trim(), image_urls: draftImages, created_at: new Date().toISOString() };
    
    // Save to database immediately with the new note included
    const updatedNotes = [...notes, newNote];
    const updatedEntry = {
      ...orderEntry,
      notes: updatedNotes,
      note: updatedNotes[0]?.text || "",
      image_urls: updatedNotes[0]?.image_urls || [],
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

    // Optimistically update local state
    setNotes(updatedNotes);
    setDraftText("");
    setDraftImages([]);
    setSendingNote(true);

    try {
      await shippingPoolApi.update(pool.id, { per_user_groups: newGroups });
    } catch (error) {
      console.error('Failed to save note:', error);
      // Rollback on error
      setNotes(notes);
      setDraftText(draftText);
      setDraftImages(draftImages);
      alert('保存留言失败，请重试');
    } finally {
      setSendingNote(false);
    }
  };

  const handleDeleteNote = async (idx) => {
    const updatedNotes = notes.filter((_, i) => i !== idx);
    
    // Optimistically update local state
    setNotes(updatedNotes);
    
    // Save to database immediately
    const updatedEntry = {
      ...orderEntry,
      notes: updatedNotes,
      note: updatedNotes[0]?.text || "",
      image_urls: updatedNotes[0]?.image_urls || [],
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

    try {
      await shippingPoolApi.update(pool.id, { per_user_groups: newGroups });
    } catch (error) {
      console.error('Failed to delete note:', error);
      // Rollback on error
      setNotes(notes);
      alert('删除留言失败，请重试');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const selectedAddons = shippingAddons.filter(a => selectedAddonIds.includes(a.id))
      .map(a => ({ id: a.id, name: a.name, fee: a.fee, fee_currency: a.fee_currency }));

    // Derive legacy note/image_urls from first note for backward compat
    const firstNote = notes[0];
    const updatedEntry = {
      ...orderEntry,
      notes,
      note: firstNote?.text || "",
      image_urls: firstNote?.image_urls || [],
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
    <>
    {lightboxUrl && (
      <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setLightboxUrl(null)}>
        <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl object-contain" />
        <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"><X className="w-5 h-5" /></button>
      </div>
    )}
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
              {order.product_image_url && (
                <img src={order.product_image_url} alt={order.product_name} onClick={() => setLightboxUrl(order.product_image_url)} className="w-full h-32 object-contain rounded-lg border border-gray-200 bg-white mb-2 cursor-zoom-in" />
              )}
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
              {order.arrival_photo_url && (
                <div>
                  <p className="text-gray-500 mb-1">入库图片</p>
                  <img src={order.arrival_photo_url} alt="入库图片" onClick={() => setLightboxUrl(order.arrival_photo_url)} className="w-full h-28 object-contain rounded-lg border border-gray-200 bg-white cursor-zoom-in" />
                </div>
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

          {/* Final address */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />最终收货地址
            </p>

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

          {/* Notes / Messages */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />备注留言
            </p>

            {/* Existing notes list */}
            {notes.length > 0 && (
              <div className="space-y-2 mb-3">
                {notes.map((n, idx) => (
                  <div key={idx} className="group bg-gray-50 rounded-xl px-3 py-2.5 relative">
                    <button
                      onClick={() => handleDeleteNote(idx)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {n.text && <p className="text-sm text-gray-800 whitespace-pre-wrap pr-5">{n.text}</p>}
                    {n.image_urls?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {n.image_urls.map((url, i) => (
                          <img key={i} src={url} alt="" onClick={() => setLightboxUrl(url)} className="w-14 h-14 rounded-lg object-cover border border-gray-200 cursor-zoom-in" />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-300 mt-1.5">
                      {new Date(n.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Compose area */}
            <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-300 transition-colors">
              {/* Draft images */}
              {draftImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {draftImages.map((url, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setDraftImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea with drag/paste */}
              <div
                className="relative"
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                onDrop={async e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) await uploadFile(f); }}
              >
                <textarea
                  rows={3}
                  className={`w-full px-3 pt-2.5 pb-1 text-sm border-0 resize-none outline-none bg-transparent transition-colors placeholder:text-gray-300 ${dragOver ? "bg-blue-50" : ""}`}
                  placeholder="添加备注…（可粘贴或拖拽图片）"
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendNote(); }}
                  onPaste={async e => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (const item of items) {
                      if (item.type.startsWith("image/")) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (file) await uploadFile(file);
                        return;
                      }
                    }
                  }}
                />
                {dragOver && (
                  <div className="absolute inset-0 rounded flex items-center justify-center pointer-events-none">
                    <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full shadow">松开以上传图片</span>
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center pointer-events-none">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
                <label className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 cursor-pointer transition-colors px-1 py-0.5 rounded">
                  <Upload className="w-3.5 h-3.5" />图片
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} disabled={uploadingImage} />
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">⌘↵ 发送</span>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={handleSendNote}
                    disabled={!draftText.trim() && draftImages.length === 0}
                  >
                    <Send className="w-3 h-3 mr-1" />发送
                  </Button>
                </div>
              </div>
            </div>
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
    </>
  );
}