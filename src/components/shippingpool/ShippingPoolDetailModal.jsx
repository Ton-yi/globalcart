/**
 * ShippingPoolDetailModal
 * Shows full detail of a shipping pool entry.
 * Admin can edit tracking number, actual fee.
 */
import { useState, useEffect, useRef } from "react";
import { X, Package, Send, Image, Edit2, Save, MoreVertical, ArrowRight, RotateCcw, Loader2, Search, Trash2, AlertCircle, CheckCircle, XCircle, CreditCard, ExternalLink, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { updateOrder, tenantEntity, shippingPoolApi } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShippingEditModal from "@/components/shippingpool/ShippingEditModal";
import AdminShippingInfoPanel from "@/components/shippingpool/AdminShippingInfoPanel";
import ShippingFeeBreakdown from "@/components/shippingpool/ShippingFeeBreakdown";
import { ImageWithViewer } from "@/components/common/ImageViewer";

const STATUS_CONFIG = {
  pending:                       { label: "待处理",    color: "bg-amber-100 text-amber-700" },
  awaiting_payment:              { label: "待付款",    color: "bg-orange-100 text-orange-700" },
  awaiting_payment_confirmation: { label: "待确认付款", color: "bg-blue-100 text-blue-700" },
  ready_to_ship:                 { label: "待发货",    color: "bg-lime-100 text-lime-700" },
  shipped:                       { label: "已发货",    color: "bg-green-100 text-green-700" },
  delivered:                     { label: "已签收",    color: "bg-emerald-100 text-emerald-700" },
  cancelled:                     { label: "已取消",    color: "bg-red-100 text-red-600" },
  processing:                    { label: "处理中",    color: "bg-blue-100 text-blue-700" },
};

const METHOD_LABELS = {
  EMS: "EMS", DHL: "DHL", FedEx: "FedEx", SAL: "SAL",
  surface: "海运", small_packet_air: "小包空运", other: "其他"
};

export default function ShippingPoolDetailModal({ pool: initialPool, isAdmin, currentUser, pendingEditRequests: initialPendingEdits = [], boxTemplates = [], shippingMethods = [], defaultPackingFeeSingle = 0, defaultPackingFeeConsolidation = 0, transitLocations = [], transitShippingMethods = [], onClose, onUpdated }) {
  const [pool, setPool] = useState(initialPool);
  const [orders, setOrders] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null); // order being edited
  const [editingOrderData, setEditingOrderData] = useState(null); // inline admin order edit
  const [savingOrder, setSavingOrder] = useState(false);
  const [adminEditingOrder, setAdminEditingOrder] = useState(null); // order for move/return ops
  const [showOrderActions, setShowOrderActions] = useState(null); // which order's actions are open
  const [otherPools, setOtherPools] = useState([]); // other pools for moving orders
  const [targetPoolId, setTargetPoolId] = useState("");
  const [actionMode, setActionMode] = useState(null); // 'move' or 'return'
  const [editingPool, setEditingPool] = useState(false); // editing pool details
  const [editingPoolData, setEditingPoolData] = useState(null);
  const [savingPool, setSavingPool] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingEdits, setPendingEdits] = useState(initialPendingEdits);
  const [processingEditId, setProcessingEditId] = useState(null);
  const [composeDragOver, setComposeDragOver] = useState(false);

  // User payment state
  const [paymentMethod, setPaymentMethod] = useState("");
  const [generatingAlipay, setGeneratingAlipay] = useState(false);
  const [alipayUrl, setAlipayUrl] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const [tenantUserMap, setTenantUserMap] = useState({});
  const [allPoolsMap, setAllPoolsMap] = useState({}); // id -> pool_code for target pool display

  useEffect(() => {
    const fetches = [];
    if (pool.order_ids?.length > 0) {
      fetches.push(
        base44.functions.invoke('getTenantOrders', { all: true }).
        then((r) => {
          const allOrders = r.data?.orders || [];
          setOrders(allOrders.filter((o) => pool.order_ids.includes(o.id)));
        }).
        catch(() => {})
      );
    }
    fetches.push(
      base44.functions.invoke('getTenantUsers', {}).
      then((r) => {
        const map = {};
        (r.data?.users || []).forEach((u) => {map[u.email] = u;});
        setTenantUserMap(map);
      }).
      catch(() => {})
    );
    fetches.push(
      base44.functions.invoke('getTenantShippingPools', {}).
      then((r) => {
        const map = {};
        (r.data?.pools || []).forEach((p) => {map[p.id] = p;});
        setAllPoolsMap(map);
        // Refresh current pool with latest data (ensures supplement_amount_per_user etc. are up to date)
        const freshPool = map[initialPool.id];
        if (freshPool) {
          setPool(p => ({ ...p, ...freshPool }));
        }
      }).
      catch(() => {})
    );
    Promise.all(fetches);

    // Mark as read on open
    const myRole = isAdmin ? "admin" : "user";
    if ((pool.unread_roles || []).includes(myRole)) {
      const newRoles = (pool.unread_roles || []).filter((r) => r !== myRole);
      shippingPoolApi.update(pool.id, { unread_roles: newRoles }).catch(() => {});
      setPool((p) => ({ ...p, unread_roles: newRoles }));
    }
  }, []);

  // Fetch other pools for moving orders
  const loadOtherPools = async (order) => {
    setAdminEditingOrder(order);
    setActionMode(null);
    setTargetPoolId("");
    base44.functions.invoke('getTenantShippingPools', {}).
    then((r) => {
      const pools = (r.data?.pools || []).filter((p) =>
      p.id !== pool.id && (p.status === "pending" || p.status === "processing")
      );
      setOtherPools(pools);
    }).
    catch(() => setOtherPools([]));
  };

  const messages = pool.messages || [];

  const handleSendMessage = async () => {
    if (!messageText.trim() && !imageFile) return;
    setSendingMsg(true);

    let image_url = "";
    if (imageFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      image_url = file_url;
    }

    const userData = tenantUserMap[currentUser.email] || {};
    const displayName = userData.display_name || userData.full_name || currentUser.full_name || currentUser.email;
    const newMsg = {
      id: Date.now().toString(),
      from: displayName,
      from_email: currentUser.email,
      avatar_url: userData.avatar_url || '',
      role: isAdmin ? "admin" : "user",
      content: messageText.trim(),
      image_url,
      timestamp: new Date().toISOString()
    };

    const otherRole = isAdmin ? "user" : "admin";
    const updatedUnread = [...new Set([...(pool.unread_roles || []), otherRole])];
    await shippingPoolApi.update(pool.id, { messages: [...messages, newMsg], unread_roles: updatedUnread });
    setPool((p) => ({ ...p, messages: [...messages, newMsg], unread_roles: updatedUnread }));
    setMessageText("");
    setImageFile(null);
    setSendingMsg(false);

    // Auto scroll to message section
    setTimeout(() => {
      const msgSection = document.querySelector('[data-message-section]');
      if (msgSection) {
        msgSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  // Admin panel update callback
  const handleAdminPoolUpdated = (updatedPool) => {
    setPool(updatedPool);
    onUpdated?.();
  };

  // User: generate Alipay payment link for shipping fee
  const handleGenerateAlipay = async () => {
    setGeneratingAlipay(true);
    const res = await base44.functions.invoke("generateAlipayShippingPoolPayment", {
      poolId: pool.id
    });
    const url = res.data?.paymentUrl;
    setAlipayUrl(url);
    setGeneratingAlipay(false);
    if (url) {
      window.open(url, "_blank");
      await Promise.all([
        shippingPoolApi.update(pool.id, {
          payment_status: "awaiting_confirmation",
          payment_method: "alipay",
          status: "awaiting_payment_confirmation",
        }),
        ...(pool.order_ids || []).map(id =>
          updateOrder(id, { order_status: "notified_shipment_fee_paid" })
        ),
      ]);
      setPool((p) => ({ ...p, payment_status: "awaiting_confirmation", payment_method: "alipay", status: "awaiting_payment_confirmation" }));
    }
  };

  // User: upload payment proof (non-alipay)
  const handleUploadProof = async (file) => {
    setUploadingProof(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await Promise.all([
      shippingPoolApi.update(pool.id, {
        payment_status: "awaiting_confirmation",
        payment_method: paymentMethod,
        payment_proof_url: file_url,
        status: "awaiting_payment_confirmation",
      }),
      ...(pool.order_ids || []).map(id =>
        updateOrder(id, { order_status: "notified_shipment_fee_paid" })
      ),
    ]);
    setPool((p) => ({ ...p, payment_status: "awaiting_confirmation", payment_method: paymentMethod, payment_proof_url: file_url, status: "awaiting_payment_confirmation" }));
    setUploadingProof(false);
  };

  const handlePoolEditSave = async () => {
    if (!editingPoolData) return;
    setSavingPool(true);

    const updateData = {
      user_note: editingPoolData.user_note || "",
      title: editingPoolData.title || "",
      scheduled_ship_date: editingPoolData.scheduled_ship_date || ""
    };
    if (isAdmin) updateData.admin_note = editingPoolData.admin_note || "";

    await shippingPoolApi.update(pool.id, updateData);
    setPool((p) => ({ ...p, ...updateData }));
    setEditingPool(false);
    setSavingPool(false);
  };

  const handleDeletePool = async () => {
    setDeleting(true);
    await Promise.all([
      // Return all orders to warehouse
      ...(pool.order_ids || []).map((id) =>
        updateOrder(id, { order_status: "in_warehouse", consolidation_pool_id: "" })
      ),
      // Auto-resolve all pending edit requests for this pool so they don't linger
      ...pendingEdits
        .filter((r) => r.status === "pending")
        .map((r) => tenantEntity.update("ShippingEditRequest", r.id, { status: "auto_applied" })),
    ]);
    await shippingPoolApi.delete(pool.id);
    setDeleting(false);
    onClose?.();
    onUpdated?.();
  };

  const handleAdminOrderSave = async () => {
    if (!editingOrderData) return;
    setSavingOrder(true);
    await updateOrder(editingOrderData.id, {
      product_name: editingOrderData.product_name,
      weight_g: parseFloat(editingOrderData.weight_g) || 0,
      order_number: editingOrderData.order_number,
      admin_note: editingOrderData.admin_note
    });
    setOrders((prev) => prev.map((o) => o.id === editingOrderData.id ? { ...o, ...editingOrderData } : o));
    setEditingOrderData(null);
    setSavingOrder(false);
  };

  // Move order to another pool
  const handleMoveOrder = async () => {
    if (!adminEditingOrder || !targetPoolId) return;
    setSavingOrder(true);
    const targetPool = otherPools.find((p) => p.id === targetPoolId);
    if (!targetPool) {setSavingOrder(false);return;}

    const updatedOrderIds = pool.order_ids.filter((id) => id !== adminEditingOrder.id);
    const updatedWeight = Math.max(0, (pool.total_weight_g || 0) - (adminEditingOrder.weight_g || 0));

    await Promise.all([
    shippingPoolApi.update(pool.id, { order_ids: updatedOrderIds, total_weight_g: updatedWeight }),
    shippingPoolApi.update(targetPoolId, {
      order_ids: [...(targetPool.order_ids || []), adminEditingOrder.id],
      total_weight_g: (targetPool.total_weight_g || 0) + (adminEditingOrder.weight_g || 0)
    }),
    updateOrder(adminEditingOrder.id, { consolidation_pool_id: targetPoolId })]
    );

    setPool((p) => ({ ...p, order_ids: updatedOrderIds, total_weight_g: updatedWeight }));
    setOrders((prev) => prev.filter((o) => o.id !== adminEditingOrder.id));
    setAdminEditingOrder(null);
    setActionMode(null);
    setSavingOrder(false);
  };

  // Return order to warehouse
  const handleReturnOrder = async () => {
    if (!adminEditingOrder) return;
    setSavingOrder(true);
    const updatedOrderIds = pool.order_ids.filter((id) => id !== adminEditingOrder.id);
    const updatedWeight = Math.max(0, (pool.total_weight_g || 0) - (adminEditingOrder.weight_g || 0));

    await Promise.all([
    shippingPoolApi.update(pool.id, { order_ids: updatedOrderIds, total_weight_g: updatedWeight }),
    updateOrder(adminEditingOrder.id, { order_status: "in_warehouse", consolidation_pool_id: "" })]
    );

    setPool((p) => ({ ...p, order_ids: updatedOrderIds, total_weight_g: updatedWeight }));
    setOrders((prev) => prev.filter((o) => o.id !== adminEditingOrder.id));
    setAdminEditingOrder(null);
    setActionMode(null);
    setSavingOrder(false);
  };

  // Approve or reject a pending ShippingEditRequest
  const handleEditRequest = async (req, action) => {
    setProcessingEditId(req.id);
    if (action === 'approve') {
      const targetOrderId = req.order_id;
      const w = orders.find((o) => o.id === targetOrderId)?.weight_g || 0;
      if (req.edit_type === 'cancel_shipment') {
        const updatedIds = (pool.order_ids || []).filter((id) => id !== targetOrderId);
        await Promise.all([
        shippingPoolApi.update(pool.id, {
          order_ids: updatedIds,
          total_weight_g: Math.max(0, (pool.total_weight_g || 0) - w)
        }),
        updateOrder(targetOrderId, { order_status: 'in_warehouse', consolidation_pool_id: '' })]
        );
        setPool((p) => ({ ...p, order_ids: updatedIds, total_weight_g: Math.max(0, (p.total_weight_g || 0) - w) }));
        setOrders((prev) => prev.filter((o) => o.id !== targetOrderId));
      } else if (req.edit_type === 'move_pool' && req.target_pool_id) {
        const allPoolsRes = await base44.functions.invoke('getTenantShippingPools', {});
        const targetPool = (allPoolsRes.data?.pools || []).find((p) => p.id === req.target_pool_id);
        if (targetPool) {
          const updatedIds = (pool.order_ids || []).filter((id) => id !== targetOrderId);
          await Promise.all([
          shippingPoolApi.update(pool.id, {
            order_ids: updatedIds,
            total_weight_g: Math.max(0, (pool.total_weight_g || 0) - w)
          }),
          shippingPoolApi.update(req.target_pool_id, {
            order_ids: [...new Set([...(targetPool.order_ids || []), targetOrderId])],
            total_weight_g: (targetPool.total_weight_g || 0) + w
          }),
          updateOrder(targetOrderId, { consolidation_pool_id: req.target_pool_id })]
          );
          setPool((p) => ({ ...p, order_ids: updatedIds, total_weight_g: Math.max(0, (p.total_weight_g || 0) - w) }));
          setOrders((prev) => prev.filter((o) => o.id !== targetOrderId));
        }
      }
      await tenantEntity.update('ShippingEditRequest', req.id, { status: 'approved' });
    } else {
      await tenantEntity.update('ShippingEditRequest', req.id, { status: 'rejected' });
    }
    setPendingEdits((prev) => prev.filter((r) => r.id !== req.id));
    setProcessingEditId(null);
    onUpdated?.();
  };

  // Get unique users from orders — prefer display_name from UserPreference, fall back to order's user_name
  const participantUsers = [...new Map(orders.map((o) => [o.user_email || o.user_name, {
    email: o.user_email,
    name: o.user_name || o.user_email
  }])).values()].filter((u) => u.name);

  const status = STATUS_CONFIG[pool.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => {if (e.target === e.currentTarget) onClose();}}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              {pool.tracking_number &&
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{pool.tracking_number}</span>
              }
              {(initialPool.unread_roles || []).includes(isAdmin ? "admin" : "user") &&
              <Badge className="text-xs bg-red-100 text-red-600 animate-pulse">有新留言</Badge>
              }
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
          <div className="flex items-center gap-2">
            {(isAdmin || currentUser?.email === pool.creator_email) && pool.status !== "shipped" && pool.status !== "delivered" &&
              <button
                onClick={() => {setEditingPool(true);setEditingPoolData(pool);}}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="编辑发货申请">
                <Edit2 className="w-4 h-4" />
              </button>
            }
            {isAdmin && pool.status !== "shipped" && pool.status !== "delivered" &&
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                title="删除发货申请">
                <Trash2 className="w-4 h-4" />
              </button>
            }
            <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Info grid */}
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
             {pool.scheduled_ship_date &&
            <InfoBlock label="计划发货日" value={pool.scheduled_ship_date} />
            }
             {pool.destination_country &&
            <InfoBlock label="目的国家" value={pool.destination_country} />
            }
             {pool.shipping_method &&
            <InfoBlock label="运输方式" value={METHOD_LABELS[pool.shipping_method] || pool.shipping_method} />
            }
             {pool.total_weight_g > 0 &&
            <InfoBlock label="总重量" value={`${pool.total_weight_g}g`} />
            }
             {pool.actual_fee &&
            <InfoBlock label="实际运费" value={`${pool.fee_currency || "JPY"} ${Math.round(pool.actual_fee).toLocaleString()}`} highlight />
            }
             {pool.transit_location_name &&
            <InfoBlock label="中转地" value={pool.transit_location_name} />
            }
           </div>

           {/* Destination address */}
           {(pool.recipient_name || pool.address_line1 || pool.city || pool.country) &&
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 hidden">
               <p className="text-xs text-blue-600 font-medium mb-1">发货目的地</p>
               <div className="text-sm text-blue-800 space-y-0.5">
                 {pool.recipient_name && <p className="font-medium">{pool.recipient_name}</p>}
                 {pool.recipient_phone && <p className="text-xs">{pool.recipient_phone}</p>}
                 <p className="whitespace-pre-wrap">
                   {pool.address_line1}{pool.address_line2 ? ` ${pool.address_line2}` : ""}<br />
                   {pool.city && `${pool.city} `}
                   {pool.state && `${pool.state} `}
                   {pool.postal_code && `${pool.postal_code}`}<br />
                   {pool.country}
                 </p>
               </div>
             </div>
          }

          {/* Selected shipping addons */}
          {((pool.selected_addons || []).length > 0 || (pool.selected_addon_ids || []).length > 0) &&
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-yellow-700 font-medium mb-1.5">发货增值服务</p>
              <div className="space-y-1">
                {(pool.selected_addons || []).length > 0 ?
              pool.selected_addons.map((a, i) =>
              <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{a.name || a.id}</span>
                        {parseFloat(a.fee) > 0 &&
                <span className="font-medium text-yellow-700">+{a.fee_currency || "JPY"} {Math.round(parseFloat(a.fee))}</span>
                }
                      </div>
              ) :
              (pool.selected_addon_ids || []).map((id, i) =>
              <div key={i} className="text-xs text-gray-500 font-mono">{id}</div>
              )
              }
              </div>
            </div>
          }

          {/* Items list */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">包裹清单 ({(pool.order_ids || []).length} 件)</h3>
            {orders.length > 0 ?
            <div className="space-y-1.5">
                {orders.map((o) => {
                const isEditingThis = editingOrderData?.id === o.id;
                return (
                  <div key={o.id} className={`rounded-lg border transition-colors ${isEditingThis ? "border-blue-200 bg-blue-50" : "border-transparent bg-gray-50"}`}>
                      {isEditingThis ?
                    <div className="px-3 py-2.5 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">订单名称</Label>
                              <Input className="h-7 text-xs mt-0.5" value={editingOrderData.product_name}
                          onChange={(e) => setEditingOrderData((d) => ({ ...d, product_name: e.target.value }))} />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">重量 (g)</Label>
                              <Input className="h-7 text-xs mt-0.5" type="number" value={editingOrderData.weight_g}
                          onChange={(e) => setEditingOrderData((d) => ({ ...d, weight_g: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">管理员备注</Label>
                            <Input className="h-7 text-xs mt-0.5" value={editingOrderData.admin_note || ""}
                        onChange={(e) => setEditingOrderData((d) => ({ ...d, admin_note: e.target.value }))} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingOrderData(null)}>取消</Button>
                            <Button size="sm" className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700" onClick={handleAdminOrderSave} disabled={savingOrder}>
                              <Save className="w-3 h-3 mr-1" />{savingOrder ? "保存中..." : "保存"}
                            </Button>
                          </div>
                        </div> :

                    <div className="space-y-2 px-3 py-2">
                          <div className="flex items-start gap-3">
                            <div className="flex gap-2 flex-shrink-0">
                              {o.product_image_url &&
                          <ImageWithViewer src={o.product_image_url} alt="产品图片">
                                  <img src={o.product_image_url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                                </ImageWithViewer>
                          }
                              {o.arrival_photo_url &&
                          <ImageWithViewer src={o.arrival_photo_url} alt="入库图片">
                                  <img src={o.arrival_photo_url} alt="" className="w-12 h-12 rounded object-cover border border-blue-200 cursor-pointer hover:opacity-80 transition-opacity" title="入库图片" />
                                </ImageWithViewer>
                          }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 truncate">{o.product_name}</p>
                              <p className="text-xs text-gray-400">{o.order_number} · {o.weight_g || 0}g{o.user_email ? ` · ${tenantUserMap[o.user_email]?.display_name || tenantUserMap[o.user_email]?.full_name || o.user_name || ""}` : ""}</p>
                              

                          
                              

                          
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Admin can edit any order */}
                              {isAdmin && pool.status !== "shipped" && pool.status !== "delivered" &&
                          <div className="flex items-center gap-1">
                                  <button
                              onClick={() => setEditingOrderData({ ...o })}
                              className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                              title="编辑包裹信息">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                              onClick={() => {setShowOrderActions(showOrderActions === o.id ? null : o.id);if (showOrderActions !== o.id) loadOtherPools(o);}}
                              className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                              title="更多操作">
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                          }
                              {/* User can edit their own orders */}
                              {!isAdmin && o.user_email === currentUser?.email && pool.status !== "shipped" && pool.status !== "delivered" &&
                          <button
                            onClick={() => setEditingOrder(o)}
                            className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                            title="编辑发货参数">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                          }
                            </div>
                          </div>
                        </div>
                    }
                      {/* Admin actions panel */}
                      {isAdmin && showOrderActions === o.id &&
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5 space-y-2">
                          {actionMode === null ?
                      <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 h-6 text-xs gap-1"
                        onClick={() => {loadOtherPools(o);setActionMode('move');}}>
                                <ArrowRight className="w-3 h-3" />移动到其他发货申请
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-6 text-xs gap-1"
                        onClick={() => {setAdminEditingOrder(o);setActionMode('return');}}>
                                <RotateCcw className="w-3 h-3" />重新入库
                              </Button>
                            </div> :
                      actionMode === 'move' ?
                      <div className="space-y-2">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <Input placeholder="搜索发货申请..." className="pl-8 h-7 text-xs" />
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {otherPools.length === 0 ?
                          <p className="text-xs text-gray-400 text-center py-2">无可用的发货申请</p> :

                          otherPools.map((p) =>
                          <button
                            key={p.id}
                            onClick={() => {setTargetPoolId(p.id);handleMoveOrder();}}
                            disabled={savingOrder}
                            className="w-full text-left px-2 py-1.5 rounded text-xs border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50">
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono text-gray-600">{p.pool_code}</span>
                                        {savingOrder && targetPoolId === p.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                      </div>
                                    </button>
                          )
                          }
                              </div>
                              <Button size="sm" variant="outline" className="w-full h-6 text-xs"
                        onClick={() => setActionMode(null)}>取消</Button>
                            </div> :
                      actionMode === 'return' ?
                      <div className="space-y-2 bg-orange-50 border border-orange-100 rounded px-2 py-2">
                              <p className="text-xs text-orange-700">确认重新入库此订单？订单状态将变为"已入库"。</p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 h-6 text-xs"
                          onClick={() => setActionMode(null)}>取消</Button>
                                <Button size="sm" className="flex-1 h-6 text-xs bg-orange-600 hover:bg-orange-700"
                          onClick={handleReturnOrder} disabled={savingOrder}>
                                  {savingOrder ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                                  确认入库
                                </Button>
                              </div>
                            </div> :
                      null}
                        </div>
                    }
                    </div>);

              })}
              </div> :

            <p className="text-xs text-gray-400">加载中...</p>
            }
          </div>

          {/* Pending Edit Requests - Admin view */}
          {isAdmin && pendingEdits.length > 0 &&
          <div className="border border-orange-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 bg-orange-50 px-4 py-2.5 border-b border-orange-200">
                <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-sm font-medium text-orange-700">待审批的更改申请 ({pendingEdits.length})</span>
              </div>
              <div className="divide-y divide-orange-50">
                {pendingEdits.map((req) =>
              <div key={req.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-gray-700">{req.user_email}</span>
                          <Badge className={`text-xs ${req.edit_type === 'cancel_shipment' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {req.edit_type === 'cancel_shipment' ? '申请重新入库' : '申请移至其他发货申请'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          订单：{orders.find((o) => o.id === req.order_id)?.product_name || req.order_id}
                        </p>
                        {req.edit_type === 'move_pool' && req.target_pool_id &&
                    <p className="text-xs text-gray-400 mt-0.5">
                            目标：<span className="font-mono text-gray-600">{allPoolsMap[req.target_pool_id]?.pool_code || req.target_pool_id.slice(-6).toUpperCase()}</span>
                          </p>
                    }
                        {req.user_note &&
                    <p className="text-xs text-gray-500 mt-0.5 italic">"{req.user_note}"</p>
                    }
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 px-2"
                      disabled={processingEditId === req.id}
                      onClick={() => handleEditRequest(req, 'approve')}>
                          {processingEditId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          批准
                        </Button>
                        <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-red-200 text-red-600 hover:bg-red-50"
                      disabled={processingEditId === req.id}
                      onClick={() => handleEditRequest(req, 'reject')}>
                          <XCircle className="w-3 h-3 mr-1" />拒绝
                        </Button>
                      </div>
                    </div>
                  </div>
              )}
              </div>
            </div>
          }

          {/* Pending Edit Requests - User view (read-only) */}
          {!isAdmin && pendingEdits.length > 0 &&
          <div className="border border-orange-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 bg-orange-50 px-4 py-2.5 border-b border-orange-200">
                <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-sm font-medium text-orange-700">更改申请处理中</span>
              </div>
              <div className="divide-y divide-orange-50">
                {pendingEdits.map((req) =>
              <div key={req.id} className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className="text-xs bg-orange-100 text-orange-700">待管理员审批</Badge>
                      <Badge className={`text-xs ${req.edit_type === 'cancel_shipment' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {req.edit_type === 'cancel_shipment' ? '重新入库' : '移至其他发货申请'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      包裹：{orders.find((o) => o.id === req.order_id)?.product_name || req.order_id}
                    </p>
                    {req.user_note && <p className="text-xs text-gray-400 mt-0.5">备注：{req.user_note}</p>}
                  </div>
              )}
              </div>
            </div>
          }

          {/* Participants */}
          {participantUsers.length > 0 &&
          <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">参与用户</h3>
              <div className="flex flex-wrap gap-2">
                {participantUsers.map((u) => {
                const userData = tenantUserMap[u.email] || {};
                // Show contact if admin, or if user set contact_public=true (default true)
                const contactVisible = isAdmin || userData.contact_public !== false;
                const displayName = userData.display_name || userData.full_name || u.name;
                return (
                  <ParticipantChip
                    key={u.email || u.name}
                    user={{ ...u, name: displayName }}
                    avatarUrl={userData.avatar_url || ''}
                    contactInfo={contactVisible ? userData.contact_info || '' : ''} />);


              })}
              </div>
            </div>
          }

          {/* Notes */}
          {pool.user_note &&
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-yellow-600 font-medium mb-0.5">用户备注</p>
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">{pool.user_note}</p>
            </div>
          }
          {pool.admin_note &&
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-blue-600 font-medium mb-0.5">管理员备注</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{pool.admin_note}</p>
            </div>
          }

          {/* Admin panel — step-based (extracted component) */}
          {isAdmin &&
          <AdminShippingInfoPanel
            pool={pool}
            orders={orders}
            boxTemplates={boxTemplates}
            shippingMethods={shippingMethods}
            defaultPackingFeeSingle={defaultPackingFeeSingle}
            defaultPackingFeeConsolidation={defaultPackingFeeConsolidation}
            transitLocations={transitLocations}
            transitShippingMethods={transitShippingMethods}
            onPoolUpdated={handleAdminPoolUpdated} />

          }

          {/* User payment panel — shown when pool is awaiting_payment */}
          {!isAdmin && (pool.status === "awaiting_payment" || pool.status === "awaiting_payment_confirmation") &&
          <div className="border border-orange-200 rounded-xl overflow-hidden">
              <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-200 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">运费待付款</span>
              </div>
              <div className="p-4 space-y-3">
                {/* Shipping info filled by admin */}
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2.5 text-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">发货信息</p>
                  <div className="grid grid-cols-2 gap-2">
                    {pool.final_weight_g > 0 &&
                  <div>
                        <p className="text-xs text-gray-400">最终总重量</p>
                        <p className="font-medium text-gray-800">{pool.final_weight_g}g</p>
                      </div>
                  }
                    {pool.box_template_name &&
                  <div>
                        <p className="text-xs text-gray-400">外箱</p>
                        <p className="font-medium text-gray-800">{pool.box_template_name}</p>
                      </div>
                  }
                    {pool.shipping_method &&
                  <div>
                        <p className="text-xs text-gray-400">运输方式</p>
                        <p className="font-medium text-gray-800">{METHOD_LABELS[pool.shipping_method] || pool.shipping_method}</p>
                      </div>
                  }
                    {pool.transit_location_name &&
                  <div>
                        <p className="text-xs text-gray-400">中转地</p>
                        <p className="font-medium text-gray-800">{pool.transit_location_name}</p>
                      </div>
                  }
                  </div>
                  {pool.admin_packing_note &&
                <p className="text-xs text-gray-600 bg-white border border-gray-100 rounded px-2 py-1.5 whitespace-pre-wrap">{pool.admin_packing_note}</p>
                }
                  {/* Packing images */}
                  {(pool.packing_image_urls || []).length > 0 &&
                <div>
                      <p className="text-xs text-gray-400 mb-1.5">捆包图片</p>
                      <div className="flex flex-wrap gap-2">
                        {pool.packing_image_urls.map((url, i) =>
                    <ImageWithViewer key={i} src={url} alt="捆包图片">
                            <img src={url} alt="" className="w-16 h-16 rounded object-cover border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer" />
                          </ImageWithViewer>
                    )}
                      </div>
                    </div>
                }
                  {/* Label images */}
                  {(pool.label_image_urls || []).length > 0 &&
                <div>
                      <p className="text-xs text-gray-400 mb-1.5">发货面单</p>
                      <div className="flex flex-wrap gap-2">
                        {pool.label_image_urls.map((url, i) =>
                    <ImageWithViewer key={i} src={url} alt="发货面单">
                            <img src={url} alt="" className="w-16 h-16 rounded object-cover border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer" />
                          </ImageWithViewer>
                    )}
                      </div>
                    </div>
                }
                </div>

                {(pool.payment_status === "awaiting_confirmation" || pool.status === "awaiting_payment_confirmation") ?
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-sm text-blue-700">
                    ✅ 付款信息已提交，等待管理员确认中。
                  </div> :

              <>
                    {/* Fee display for current user */}
                    {(() => {
                      // Check if this is a supplement (top-up) request
                      const supplements = pool.supplement_amount_per_user || [];
                      const mySupplement = supplements.length > 0
                        ? supplements.find(s => s.user_email === currentUser?.email)
                        : null;

                      if (mySupplement) {
                        const prevTotal = mySupplement.previous_total_jpy ?? null;
                        const newTotal = mySupplement.new_total_jpy ?? null;
                        const supplementJpy = Math.round(mySupplement.supplement_jpy || 0);
                        return (
                          <div className="space-y-2">
                            {/* Summary box: show both new total and supplement clearly */}
                            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-3 space-y-2">
                              <p className="text-xs text-orange-600 font-semibold">⚠️ 管理员已更新运费，需补交差额</p>
                              {prevTotal !== null && newTotal !== null && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>原金额 <span className="font-medium text-gray-700">¥{prevTotal.toLocaleString()}</span></span>
                                  <span>→</span>
                                  <span>新金额 <span className="font-semibold text-orange-700">¥{newTotal.toLocaleString()}</span></span>
                                  <span className="text-orange-400">(JPY)</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between border-t border-orange-200 pt-2 mt-1">
                                <span className="text-sm font-semibold text-orange-700">本次需补交</span>
                                <span className="text-2xl font-bold text-orange-600">¥{supplementJpy.toLocaleString()} <span className="text-sm font-normal">JPY</span></span>
                              </div>
                            </div>
                            {/* Full breakdown expandable */}
                            {(pool.fee_breakdown_per_user || []).length > 0 && (
                              <details className="text-xs">
                                <summary className="text-gray-400 cursor-pointer hover:text-gray-600 py-1 select-none">查看完整费用明细（更新后）</summary>
                                <div className="mt-1">
                                  <ShippingFeeBreakdown
                                    breakdowns={pool.fee_breakdown_per_user}
                                    isConsolidation={pool.consolidation_type === "transit" || pool.consolidation_type === "other"}
                                    currentUserEmail={currentUser?.email} />
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      }

                      if ((pool.fee_breakdown_per_user || []).length > 0) {
                        return (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">费用明细</p>
                            <ShippingFeeBreakdown
                              breakdowns={pool.fee_breakdown_per_user}
                              isConsolidation={pool.consolidation_type === "transit" || pool.consolidation_type === "other"}
                              currentUserEmail={currentUser?.email} />
                          </div>
                        );
                      }

                      return (
                        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5">
                          <p className="text-sm font-medium text-yellow-800">
                            运费：<span className="text-lg font-bold text-orange-600">¥{Math.round(pool.shipping_fee_jpy || 0).toLocaleString()}</span>
                            <span className="text-xs text-yellow-600 ml-1">(JPY)</span>
                          </p>
                        </div>
                      );
                    })()}
                    <div>
                      <Label className="text-xs text-gray-500 font-medium mb-2 block">选择支付方式</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                    { value: "alipay", label: "支付宝" },
                    { value: "wechatpay", label: "微信支付" },
                    { value: "bank_transfer", label: "银行转账" },
                    { value: "other", label: "其他" }].
                    map((m) =>
                    <button key={m.value} type="button"
                    onClick={() => {setPaymentMethod(m.value);setAlipayUrl(null);}}
                    className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === m.value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                            {m.label}
                          </button>
                    )}
                      </div>
                    </div>

                    {paymentMethod === "alipay" &&
                <div className="space-y-2">
                        {alipayUrl &&
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />付款链接已生成，请在新标签完成付款后刷新页面。
                          </div>
                  }
                        <div className="flex gap-2">
                          <Button className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={handleGenerateAlipay} disabled={generatingAlipay}>
                            {generatingAlipay ?
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成中...</> :
                      <><ExternalLink className="w-4 h-4 mr-2" />{alipayUrl ? "重新生成链接" : "生成支付宝付款链接"}</>}
                          </Button>
                          {alipayUrl &&
                    <a href={alipayUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap">
                              <ExternalLink className="w-4 h-4" />打开付款页
                            </a>
                    }
                        </div>
                      </div>
                }

                    {paymentMethod && paymentMethod !== "alipay" &&
                <div className="space-y-2">
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                          请联系客服获取收款账号，完成付款后上传凭证
                        </div>
                        <label className="cursor-pointer block">
                          <div className={`flex flex-col items-center gap-1.5 px-3 py-5 border-2 border-dashed rounded-lg text-sm transition-colors ${uploadingProof ? "border-blue-200 bg-blue-50 text-blue-500" : "border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500"}`}>
                            {uploadingProof ?
                      <><Loader2 className="w-5 h-5 animate-spin" /><span>上传中...</span></> :
                      <><Upload className="w-5 h-5" /><span>点击上传付款凭证</span></>}
                          </div>
                          <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => {const f = e.target.files[0];if (f) handleUploadProof(f);}}
                    disabled={uploadingProof} />
                        </label>
                        <input
                          type="text"
                          placeholder="点击此处后粘贴截图（Ctrl+V / ⌘V）"
                          className="w-full h-9 px-3 text-xs border border-gray-300 rounded-md bg-white text-gray-500 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 transition-colors"
                          onPaste={(e) => {
                            const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                            if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) handleUploadProof(f); }
                          }}
                          onChange={() => {}}
                        />
                      </div>
                }
                  </>
              }
              </div>
            </div>
          }

          {/* Message thread */}
          <div data-message-section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">留言沟通</h3>
            {messages.length > 0 ?
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {messages.map((msg) => {
                // Prefer data stored on the message itself (set at send time)
                const senderAvatar = msg.avatar_url || (msg.from_email ? tenantUserMap[msg.from_email]?.avatar_url : '') || '';
                const senderDisplayName = msg.from || (msg.from_email ? (tenantUserMap[msg.from_email]?.display_name || tenantUserMap[msg.from_email]?.full_name) : null) || msg.from_email || "?";
                const senderInitial = senderDisplayName[0].toUpperCase();
                return (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "admin" ? "flex-row-reverse" : ""}`}>
                      {senderAvatar ?
                    <img src={senderAvatar} alt={senderDisplayName} className="w-6 h-6 rounded-full object-cover flex-shrink-0 self-start mt-0.5" /> :

                    <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0 self-start mt-0.5">
                          {senderInitial}
                        </div>
                    }
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${msg.role === "admin" ? "bg-red-50 text-red-900 rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                        <p className="text-xs text-gray-400 mb-0.5 font-medium">{senderDisplayName}</p>
                        {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                        {msg.image_url &&
                      <ImageWithViewer src={msg.image_url} alt="留言图片">
                            <img src={msg.image_url} alt="" className="mt-1.5 max-w-full rounded-lg max-h-40 object-contain cursor-pointer hover:opacity-80 transition-opacity" />
                          </ImageWithViewer>
                      }
                      </div>
                    </div>);

              })}
              </div> :

            <p className="text-xs text-gray-400 mb-3">暂无留言</p>
            }

            {/* Compose */}
            <div className="space-y-2">
              <div
                className={`relative rounded-md border transition-colors ${composeDragOver ? "border-blue-400 bg-blue-50" : "border-input"}`}
                onDragOver={(e) => {e.preventDefault();setComposeDragOver(true);}}
                onDragLeave={() => setComposeDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setComposeDragOver(false);
                  const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
                  if (file) setImageFile(file);
                }}>
                
                <Textarea
                  rows={2}
                  placeholder="输入留言… Enter 发送，Shift+Enter 换行，可拖拽或粘贴图片"
                  className={`text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent resize-none ${composeDragOver ? "opacity-40 pointer-events-none" : ""}`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
                    if (item) {const file = item.getAsFile();if (file) setImageFile(file);}
                  }} />
                
                {composeDragOver &&
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-xs text-blue-500 font-medium">放开以附加图片</p>
                  </div>
                }
              </div>
              {imageFile &&
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                  <img src={URL.createObjectURL(imageFile)} alt="预览" className="w-8 h-8 rounded object-cover border border-gray-200" />
                  <span className="text-xs text-gray-600 flex-1 truncate">{imageFile.name}</span>
                  <button type="button" onClick={() => setImageFile(null)} className="text-gray-400 hover:text-red-500 text-xs">×</button>
                </div>
              }
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  <Image className="w-3.5 h-3.5" />
                  {imageFile ? "更换图片" : "附加图片"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files[0])} />
                </label>
                <Button size="sm" className="h-7 text-xs bg-gray-800 hover:bg-gray-900"
                onClick={handleSendMessage} disabled={sendingMsg || !messageText.trim() && !imageFile}>
                  <Send className="w-3 h-3 mr-1" />{sendingMsg ? "发送中..." : "发送"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {editingOrder &&
        <ShippingEditModal
          order={editingOrder}
          currentPool={pool}
          currentUser={currentUser}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {setEditingOrder(null);onUpdated?.();}} />

        }

        {editingPool && editingPoolData &&
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4"
        onClick={(e) => {if (e.target === e.currentTarget) setEditingPool(false);}}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-semibold text-gray-900">编辑发货申请</h3>
                <button onClick={() => setEditingPool(false)}><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500">发货申请标题</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="给此发货申请取个名字"
                value={editingPoolData.title || ""} onChange={(e) => setEditingPoolData((d) => ({ ...d, title: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">计划发货日期</Label>
                  <Input className="mt-1 h-8 text-sm" type="date"
                value={editingPoolData.scheduled_ship_date || ""} onChange={(e) => setEditingPoolData((d) => ({ ...d, scheduled_ship_date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">{isAdmin ? "用户备注" : "备注"}</Label>
                  <Textarea rows={3} className="mt-1 text-sm"
                value={editingPoolData.user_note || ""} onChange={(e) => setEditingPoolData((d) => ({ ...d, user_note: e.target.value }))} />
                </div>
                {isAdmin &&
              <div>
                    <Label className="text-xs text-gray-500">管理员备注</Label>
                    <Textarea rows={2} className="mt-1 text-sm"
                value={editingPoolData.admin_note || ""} onChange={(e) => setEditingPoolData((d) => ({ ...d, admin_note: e.target.value }))} />
                  </div>
              }
              </div>
              <div className="px-5 py-3 border-t flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingPool(false)}>取消</Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
              onClick={handlePoolEditSave} disabled={savingPool}>
                  {savingPool ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </div>
        }

        {confirmDelete &&
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">删除发货申请？</h3>
                  <p className="text-sm text-gray-500 mt-1">此操作不可撤销。所有订单将重新入库。</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>取消</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700"
              onClick={handleDeletePool} disabled={deleting}>
                  {deleting ? "删除中..." : "确认删除"}
                </Button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>);

}

function InfoBlock({ label, value, highlight }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-green-50 border border-green-100" : "bg-gray-50"}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight ? "text-green-700" : "text-gray-800"}`}>{value}</p>
    </div>);

}

function ParticipantChip({ user, avatarUrl, contactInfo }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const hideTimer = useRef(null);
  const initial = (user.name || "?")[0].toUpperCase();

  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setTooltipVisible(false), 150);
  };

  const handleCopyContact = () => {
    if (contactInfo) {
      navigator.clipboard.writeText(contactInfo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="relative flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2.5 py-0.5 cursor-default"
      onMouseEnter={() => {if (contactInfo) {cancelHide();setTooltipVisible(true);}}}
      onMouseLeave={scheduleHide}>
      
      {avatarUrl ?
      <img src={avatarUrl} alt={user.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" /> :

      <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0">
          {initial}
        </div>
      }
      <span className="text-xs text-gray-700">{user.name}</span>
      {contactInfo && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 cursor-pointer" title="点击查看联系方式" onClick={() => setTooltipVisible(!tooltipVisible)} />}
      {tooltipVisible && contactInfo &&
      <div
        className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2 whitespace-nowrap"
        style={{ width: `max(auto, ${Math.max(80, Math.min(contactInfo.length * 7 + 60, 300))}px)` }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}>
        
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">联系方式</p>
            <button
            onClick={handleCopyContact}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex-shrink-0"
            title="复制联系方式">
            
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <p className="text-sm font-medium text-gray-800 break-all select-all cursor-text">{contactInfo}</p>
        </div>
      }
    </div>);

}