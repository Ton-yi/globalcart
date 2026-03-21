/**
 * ShippingPoolDetailModal
 * Shows full detail of a shipping pool entry.
 * Admin can edit tracking number, actual fee.
 */
import { useState, useEffect } from "react";
import { X, Package, Send, Image, Truck, Edit2, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ShippingEditModal from "@/components/shippingpool/ShippingEditModal";

const STATUS_CONFIG = {
  pending:    { label: "待处理", color: "bg-gray-100 text-gray-600" },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700" },
  shipped:    { label: "已发货", color: "bg-green-100 text-green-700" },
  delivered:  { label: "已签收", color: "bg-emerald-100 text-emerald-700" },
  cancelled:  { label: "已取消", color: "bg-red-100 text-red-600" },
};

const METHOD_LABELS = {
  EMS: "EMS", DHL: "DHL", FedEx: "FedEx", SAL: "SAL",
  surface: "海运", small_packet_air: "小包空运", other: "其他",
};

export default function ShippingPoolDetailModal({ pool: initialPool, isAdmin, currentUser, onClose, onUpdated }) {
  const [pool, setPool] = useState(initialPool);
  const [orders, setOrders] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null); // order being edited
  const [editingOrderData, setEditingOrderData] = useState(null); // inline admin order edit
  const [savingOrder, setSavingOrder] = useState(false);

  // Admin edit fields
  const [trackingNumber, setTrackingNumber] = useState(pool.tracking_number || "");
  const [actualFee, setActualFee] = useState(pool.actual_fee?.toString() || "");
  const [adminNote, setAdminNote] = useState(pool.admin_note || "");
  const [editMode, setEditMode] = useState(true); // Always expanded for admin

  useEffect(() => {
    if (pool.order_ids?.length > 0) {
      Promise.all(pool.order_ids.map(id => base44.entities.Order.filter({ id })))
        .then(results => setOrders(results.flat().filter(Boolean)))
        .catch(() => {});
    }
  }, []);

  const messages = pool.messages || [];

  const handleSendMessage = async () => {
    if (!messageText.trim() && !imageFile) return;
    setSendingMsg(true);

    let image_url = "";
    if (imageFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      image_url = file_url;
    }

    const newMsg = {
      id: Date.now().toString(),
      from: currentUser.full_name || currentUser.email,
      role: isAdmin ? "admin" : "user",
      content: messageText.trim(),
      image_url,
      timestamp: new Date().toISOString(),
    };

    const updated = await base44.entities.ShippingPool.update(pool.id, {
      messages: [...messages, newMsg],
    });
    setPool(p => ({ ...p, messages: [...messages, newMsg] }));
    setMessageText("");
    setImageFile(null);
    setSendingMsg(false);
  };

  const handleAdminSave = async () => {
    if (!trackingNumber && !actualFee && !adminNote) return;
    setSaving(true);

    const updateData = {
      admin_note: adminNote,
    };
    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
      updateData.status = "shipped";
      updateData.shipped_date = new Date().toISOString().split("T")[0];
    }
    if (actualFee) {
      updateData.actual_fee = parseFloat(actualFee);
    }

    await base44.entities.ShippingPool.update(pool.id, updateData);

    // If tracking number saved, update all related orders to "shipped"
    if (trackingNumber) {
      await Promise.all(
        (pool.order_ids || []).map(id =>
          base44.entities.Order.update(id, {
            order_status: "shipped",
            tracking_number: trackingNumber,
            shipped_date: new Date().toISOString().split("T")[0],
          })
        )
      );
    }

    setPool(p => ({ ...p, ...updateData }));
    setEditMode(false);
    setSaving(false);
    onUpdated?.();
  };

  const handleAdminOrderSave = async () => {
    if (!editingOrderData) return;
    setSavingOrder(true);
    await base44.entities.Order.update(editingOrderData.id, {
      product_name: editingOrderData.product_name,
      weight_g: parseFloat(editingOrderData.weight_g) || 0,
      order_number: editingOrderData.order_number,
      admin_note: editingOrderData.admin_note,
    });
    setOrders(prev => prev.map(o => o.id === editingOrderData.id ? { ...o, ...editingOrderData } : o));
    setEditingOrderData(null);
    setSavingOrder(false);
  };

  // Get unique users from orders (with email for avatar lookup)
  const participantUsers = [...new Map(orders.map(o => [o.user_email || o.user_name, { name: o.user_name || o.user_email, email: o.user_email }])).values()].filter(u => u.name);

  const status = STATUS_CONFIG[pool.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              {pool.tracking_number && (
                <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{pool.tracking_number}</span>
              )}
            </div>
            <h2 className="font-semibold text-gray-900 mt-1">
              {pool.title || (pool.pool_code ? `发货申请 ${pool.pool_code}` : `发货申请 #${pool.id.slice(-6).toUpperCase()}`)}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {pool.pool_code && <span className="font-mono mr-2 text-gray-500">{pool.pool_code}</span>}
              创建于 {new Date(pool.created_date).toLocaleDateString("zh-CN")}
              {pool.is_private && <span className="ml-2">🔒 不公开</span>}
            </p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {pool.scheduled_ship_date && (
              <InfoBlock label="计划发货日" value={pool.scheduled_ship_date} />
            )}
            {pool.destination_country && (
              <InfoBlock label="目的国家" value={pool.destination_country} />
            )}
            {pool.shipping_method && (
              <InfoBlock label="运输方式" value={METHOD_LABELS[pool.shipping_method] || pool.shipping_method} />
            )}
            {pool.total_weight_g > 0 && (
              <InfoBlock label="总重量" value={`${pool.total_weight_g}g`} />
            )}
            {pool.actual_fee && (
              <InfoBlock label="实际运费" value={`${pool.fee_currency || "CNY"} ${pool.actual_fee}`} highlight />
            )}
            {pool.transit_location_name && (
              <InfoBlock label="中转地" value={pool.transit_location_name} />
            )}
          </div>

          {/* Items list */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">包裹清单 ({(pool.order_ids || []).length} 件)</h3>
            {orders.length > 0 ? (
              <div className="space-y-1.5">
                {orders.map(o => (
                  <div key={o.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{o.product_name}</p>
                    <p className="text-xs text-gray-400">{o.order_number} · {o.weight_g || 0}g{o.user_name ? ` · ${o.user_name}` : ""}</p>
                  </div>
                  {/* User can edit their own orders */}
                  {!isAdmin && o.user_email === currentUser?.email && pool.status !== "shipped" && pool.status !== "delivered" && (
                    <button
                      onClick={() => setEditingOrder(o)}
                      className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                      title="编辑发货参数">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">加载中...</p>
            )}
          </div>

          {/* Participants */}
          {participantUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">参与用户</h3>
              <div className="flex flex-wrap gap-1.5">
                {participantUsers.map(u => (
                  <Badge key={u} variant="outline" className="text-xs">{u}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {pool.user_note && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-yellow-600 font-medium mb-0.5">用户备注</p>
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">{pool.user_note}</p>
            </div>
          )}
          {pool.admin_note && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-blue-600 font-medium mb-0.5">管理员备注</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{pool.admin_note}</p>
            </div>
          )}

          {/* Admin edit panel - always expanded */}
          {isAdmin && (
            <div className="border border-red-100 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-2.5 border-b border-red-100">
                <span className="text-sm font-medium text-red-700">管理员操作</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">运单号</Label>
                    <Input className="mt-1 h-8 text-sm font-mono" placeholder="填写后状态变为已发货"
                      value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">实际运费（日元 JPY）</Label>
                    <Input className="mt-1 h-8 text-sm" type="number" placeholder="0"
                      value={actualFee} onChange={e => setActualFee(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">管理员备注</Label>
                  <Textarea rows={2} className="mt-1 text-sm"
                    value={adminNote} onChange={e => setAdminNote(e.target.value)} />
                </div>
                {trackingNumber && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-700">
                    ⚠️ 填写运单号后，发货申请状态将变为"已发货"，且关联的所有订单也将同步更新为"已发货"。
                  </div>
                )}
                <Button size="sm" className="bg-red-600 hover:bg-red-700 w-full"
                  onClick={handleAdminSave} disabled={saving}>
                  <Truck className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          )}

          {/* Message thread */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">留言沟通</h3>
            {messages.length > 0 ? (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "admin" ? "flex-row-reverse" : ""}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${msg.role === "admin" ? "bg-red-50 text-red-900 rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                      <p className="text-xs text-gray-400 mb-0.5">{msg.from}</p>
                      {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                      {msg.image_url && <img src={msg.image_url} alt="" className="mt-1.5 max-w-full rounded-lg max-h-40 object-contain" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">暂无留言</p>
            )}

            {/* Compose */}
            <div className="space-y-2">
              <Textarea
                rows={2}
                placeholder="输入留言..."
                className="text-sm"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  <Image className="w-3.5 h-3.5" />
                  {imageFile ? imageFile.name : "附加图片"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files[0])} />
                </label>
                <Button size="sm" className="h-7 text-xs bg-gray-800 hover:bg-gray-900"
                  onClick={handleSendMessage} disabled={sendingMsg || (!messageText.trim() && !imageFile)}>
                  <Send className="w-3 h-3 mr-1" />{sendingMsg ? "发送中..." : "发送"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {editingOrder && (
          <ShippingEditModal
            order={editingOrder}
            currentPool={pool}
            currentUser={currentUser}
            onClose={() => setEditingOrder(null)}
            onSuccess={() => { setEditingOrder(null); onUpdated?.(); }}
          />
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, value, highlight }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-green-50 border border-green-100" : "bg-gray-50"}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight ? "text-green-700" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}