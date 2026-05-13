/**
 * AdminOrderEditModal (v2)
 * Full admin workflow panel for a single order.
 * Covers all status transitions per the new order flow.
 */
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";
import { updateOrder, tenantEntity } from "@/lib/tenantApi";
import { X, ExternalLink, Copy, Loader2, CheckCircle, Upload, AlertTriangle, MessageCircle, Package, Send, Layers, Scissors, GitBranch } from "lucide-react";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import OrderMessageThread from "@/components/orders/OrderMessageThread";

// All statuses admin can manually set (escape hatch)
const ALL_STATUSES = [
  { v: "pending_confirmation", l: "后付款待确认" },
  { v: "awaiting_reply", l: "用户已回复（待回复）" },
  { v: "admin_replied", l: "管理员已回复" },
  { v: "payment_pending", l: "待付款" },
  { v: "paid", l: "已付款/待下单" },
  { v: "purchased", l: "已下单" },
  { v: "in_warehouse", l: "已入库" },
  { v: "notified_shipment", l: "已通知出货/待出货" },
  { v: "shipping_fee_pending", l: "待付运费/已付运费" },
  { v: "shipped", l: "已发出" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

export default function AdminOrderEditModal({ order, initialItemSizeTemplates, onClose, onSaved, onOpenPool, shippingPools = [], currentUser = null, userProfileMap = {} }) {
  const [tab, setTab] = useState((order.unread_roles || []).includes("admin") ? "messages" : "actions"); // "actions" | "edit" | "messages"
  const [saving, setSaving] = useState(false);

  // Alipay link generation
  const [alipayUrl, setAlipayUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Form fields for "edit" tab
  const [form, setForm] = useState({
    order_status: order.order_status || "pending_confirmation",
    admin_note: order.admin_note || "",
    admin_confirmed_amount: order.admin_confirmed_amount || order.prepayment_amount || "",
    prepayment_amount: order.prepayment_amount || "",
    prepayment_currency: order.prepayment_currency || "JPY",
    prepayment_amount_jpy: order.prepayment_amount_jpy || "",
    payment_due_date: order.payment_due_date || "",
    estimated_jpy: order.estimated_jpy || "",
    balance_credit: order.balance_credit || 0,
    cancel_reason: order.cancel_reason || "",
  });

  // Upload state
  const [purchaseScreenshot, setPurchaseScreenshot] = useState(null);
  const [arrivalPhoto, setArrivalPhoto] = useState(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [uploadingArrival, setUploadingArrival] = useState(false);

  // Item size templates — use prefetched data when available, skip self-fetch
  const [itemSizeTemplates, setItemSizeTemplates] = useState(initialItemSizeTemplates || []);
  const [selectedSizeId, setSelectedSizeId] = useState(order.item_size_template_id || "");

  // In-warehouse edit state (weight + size, for already-warehoused orders)
  const [warehouseEditMode, setWarehouseEditMode] = useState(false);
  const [warehouseWeight, setWarehouseWeight] = useState(order.weight_g || "");
  const [warehouseSizeId, setWarehouseSizeId] = useState(order.item_size_template_id || "");
  const [savingWarehouseEdit, setSavingWarehouseEdit] = useState(false);

  // Shipping fee form
  const [shippingWeight, setShippingWeight] = useState(order.shipping_total_weight_g || "");
  const [shippingFee, setShippingFee] = useState(order.shipping_fee_amount || "");
  const [shippingCurrency, setShippingCurrency] = useState(order.shipping_fee_currency || "CNY");
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");

  // Split order state
  const [splitting, setSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState(null); // { child_count, children }
  // Child orders (fetched for -00 purchased orders)
  const [childOrders, setChildOrders] = useState(null);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const status = order.order_status;
  const cur = order.prepayment_currency || "CNY";

  // Only fetch item size templates if not provided by the parent (page-level prefetch)
  useEffect(() => {
    if (initialItemSizeTemplates && initialItemSizeTemplates.length > 0) return;
    tenantEntity.list('ItemSizeTemplate', { is_active: true })
      .then(templates => setItemSizeTemplates(templates || []))
      .catch(() => {});
  }, []);

  // Clear admin unread on open
  useEffect(() => {
    if ((order.unread_roles || []).includes("admin")) {
      const newRoles = (order.unread_roles || []).filter(r => r !== "admin");
      updateOrder(order.id, { unread_roles: newRoles }).catch(() => {});
    }
  }, [order.id]);

  // ── Alipay link generation ──
  const handleGenerateAlipay = async () => {
    setGenerating(true);
    setAlipayUrl(null);
    const res = await base44.functions.invoke("generateAlipayPaymentLink", {
      orderId: order.id,
      amount: parseFloat(form.prepayment_amount) || order.prepayment_amount,
      currency: cur,
      subject: `同一物流代购 - ${order.product_name}`,
    });
    setAlipayUrl(res.data?.paymentUrl);
    setGenerating(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(alipayUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // ── Upload helpers ──
  const uploadFile = async (file, setter, loadingSetter) => {
    loadingSetter(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setter(file_url);
    loadingSetter(false);
  };

  // Fetch child orders for purchased -00 parent orders
  useEffect(() => {
    if (order.split_index !== -1 || !order.has_split_marker) return;
    // If already purchased as a split order, load child orders
    if (order.order_status === 'purchased' && order.order_number?.includes(' - 00')) {
      tenantEntity.list('Order', { parent_order_id: order.id })
        .then(children => setChildOrders(children || []))
        .catch(() => {});
    }
  }, [order.id, order.order_status]);

  // ── Split order handler ──
  const handleSplitOrder = async () => {
    if (!window.confirm(`确认将此订单拆分为 ${(order.split_sections || []).length} 个子订单？此操作不可撤销。`)) return;
    setSplitting(true);
    const res = await base44.functions.invoke('splitTenantOrder', {
      orderId: order.id,
      purchaseScreenshotUrl: purchaseScreenshot || order.purchase_screenshot_url || null,
      adminNote: form.admin_note,
    });
    setSplitting(false);
    if (res.data?.success) {
      setSplitResult(res.data);
      onSaved();
    }
  };

  // ── Status-specific action handlers ──

  // pending_confirmation → payment_pending
  const handleConfirmOrder = async () => {
    setSaving(true);
    const rawAmt = parseFloat(form.prepayment_amount) || order.prepayment_amount || 0;
    // Round JPY amounts to integer
    const finalAmt = cur === "JPY" ? Math.round(rawAmt) : rawAmt;
    await updateOrder(order.id, {
      order_status: "payment_pending",
      prepayment_amount: finalAmt,
      payment_due_date: form.payment_due_date || null,
      admin_note: form.admin_note,
    });
    onSaved();
  };

  // → awaiting_reply
  const handleSendToReply = async () => {
    setSaving(true);
    await updateOrder(order.id, {
      order_status: "awaiting_reply",
      pre_reply_status: order.pre_reply_status || order.order_status,
      admin_note: form.admin_note,
    });
    onSaved();
  };

  // → cancelled
  const handleCancel = async () => {
    if (!form.cancel_reason) { alert("请填写取消理由"); return; }
    setSaving(true);
    await updateOrder(order.id, {
      order_status: "cancelled",
      cancel_reason: form.cancel_reason,
      admin_note: form.admin_note,
    });
    onSaved();
  };

  // paid → purchased
  const handleMarkPurchased = async () => {
    setSaving(true);
    const updates = {
      order_status: "purchased",
      purchased_date: new Date().toISOString().split("T")[0],
      admin_note: form.admin_note,
    };
    if (purchaseScreenshot) updates.purchase_screenshot_url = purchaseScreenshot;
    await updateOrder(order.id, updates);
    onSaved();
  };

  // purchased → in_warehouse
  const handleMarkInWarehouse = async () => {
    setSaving(true);
    const updates = {
      order_status: "in_warehouse",
      in_warehouse_date: new Date().toISOString().split("T")[0],
      admin_note: form.admin_note,
    };
    if (arrivalPhoto) updates.arrival_photo_url = arrivalPhoto;
    if (form.weight_g) updates.weight_g = parseFloat(form.weight_g);
    if (selectedSizeId) {
      const selectedTemplate = itemSizeTemplates.find(t => t.id === selectedSizeId);
      if (selectedTemplate) {
        updates.item_size_template_id = selectedTemplate.id;
        updates.item_size_title = selectedTemplate.title;
        updates.item_size_extra_fee = selectedTemplate.extra_fee;
        updates.item_size_fee_currency = selectedTemplate.fee_currency;
      }
    }
    await updateOrder(order.id, updates);
    onSaved();
  };

  // notified_shipment → shipping_fee_pending
  const handleSetShippingFee = async () => {
    setSaving(true);
    const finalFee = parseFloat(shippingFee) || 0;
    const credit = parseFloat(order.balance_credit || 0);
    const netFee = Math.max(0, finalFee - credit);
    await updateOrder(order.id, {
      order_status: "shipping_fee_pending",
      shipping_total_weight_g: parseFloat(shippingWeight) || 0,
      shipping_fee_amount: netFee,
      shipping_fee_currency: shippingCurrency,
      tracking_number: trackingNumber,
      admin_note: form.admin_note,
    });
    onSaved();
  };

  // shipping_fee_pending/ready_to_ship → shipped
  const handleMarkShipped = async () => {
    setSaving(true);
    await updateOrder(order.id, {
      order_status: "shipped",
      shipped_date: new Date().toISOString().split("T")[0],
      tracking_number: trackingNumber,
      admin_note: form.admin_note,
    });
    onSaved();
  };

  // Generic save (edit tab)
  const handleSave = async () => {
    setSaving(true);
    const newCur = form.prepayment_currency || "JPY";
    const newAmt = parseFloat(form.prepayment_amount) || 0;
    // When admin manually sets a non-JPY amount, also preserve JPY reference
    const jpyRef = newCur === "JPY"
      ? newAmt
      : parseFloat(form.prepayment_amount_jpy) || order.prepayment_amount_jpy || 0;
    await updateOrder(order.id, {
      order_status: form.order_status,
      admin_note: form.admin_note,
      admin_confirmed_amount: parseFloat(form.admin_confirmed_amount) || 0,
      prepayment_amount: newAmt,
      prepayment_currency: newCur,
      prepayment_amount_jpy: jpyRef,
      payment_due_date: form.payment_due_date || null,
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
      balance_credit: parseFloat(form.balance_credit) || 0,
      cancel_reason: form.cancel_reason,
    });
    onSaved();
  };

  const statusLabel = getStatusLabel(status, "admin");
  const statusColor = getStatusColor(status, "admin");

  // Pre-process product_url: wrap bare URLs as markdown links, ensure --- has blank lines
  const productUrlText = (() => {
    const raw = (order.product_url || "").trim();
    if (!raw) return "";
    return raw.split("\n").map(line => {
      const t = line.trim();
      if (t === "---") return "\n---\n";
      if (/^https?:\/\/\S+/.test(t)) return `[${t}](${t})`;
      return line;
    }).join("\n");
  })();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
              <span className="text-xs text-gray-400">{order.order_number}</span>
            </div>
            <h2 className="font-semibold text-gray-900 truncate mt-0.5">{order.product_name}</h2>
            <p className="text-xs text-gray-400">{order.user_name} · {order.user_email}</p>
          </div>
          <button onClick={onClose} className="ml-3"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0 text-xs">
          {[
            { key: "actions", label: "操作" },
            { key: "messages", label: `留言${(order.messages || []).length > 0 ? `(${(order.messages || []).length})` : ""}`, unread: (order.unread_roles || []).includes("admin") },
            { key: "edit", label: "编辑" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
                tab === t.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              {t.unread && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ───────── ACTIONS TAB ───────── */}
          {tab === "actions" && (
            <div className="space-y-4">
              {/* Order info summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {order.estimated_jpy > 0 && (
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="text-gray-400">日元报价</div>
                    <div className="font-medium">¥{order.estimated_jpy?.toLocaleString()}</div>
                  </div>
                )}
                {order.prepayment_amount > 0 && (
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="text-gray-400">预付款</div>
                    <div className="font-medium">{cur === "JPY" ? `${Math.round(order.prepayment_amount).toLocaleString()} yen` : `${cur} ${Math.round(order.prepayment_amount)}`}</div>
                  </div>
                )}
                {order.paid_amount > 0 && (
                  <div className="bg-green-50 rounded-lg p-2.5">
                    <div className="text-gray-400">已付金额</div>
                    <div className="font-medium text-green-700">{cur === "JPY" ? `${Math.round(order.paid_amount).toLocaleString()} yen` : `${cur} ${Math.round(order.paid_amount)}`}</div>
                  </div>
                )}
                {order.balance_credit > 0 && (
                  <div className="bg-blue-50 rounded-lg p-2.5">
                    <div className="text-gray-400">余额</div>
                    <div className="font-medium text-blue-700">{cur === "JPY" ? `${Math.round(order.balance_credit).toLocaleString()} yen` : `${cur} ${Math.round(order.balance_credit)}`}</div>
                  </div>
                )}
              </div>

              {/* Payment method */}
              {order.payment_method && (
                <div className="bg-gray-50 rounded-lg p-2.5 text-xs">
                  <div className="text-gray-400">付款方式</div>
                  <div className="font-medium">{{ alipay: "支付宝", wechatpay: "微信支付", paypay: "PayPay", paypal: "PayPal", credit_card: "信用卡", bank_transfer: "银行转账", other: "其他" }[order.payment_method] || order.payment_method}</div>
                </div>
              )}

              {/* All uploaded images */}
              {(order.product_image_url || order.payment_proof_url || order.purchase_screenshot_url || order.arrival_photo_url) && (
                <div className="space-y-1.5">
                  <div className="text-xs text-gray-400 font-medium">图片</div>
                  <div className="flex flex-wrap gap-2">
                    {order.product_image_url && (
                      <div className="flex flex-col items-center gap-1">
                        <ImageWithViewer src={order.product_image_url} alt="商品图">
                          <img src={order.product_image_url} alt="商品图" className="h-20 w-20 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                        </ImageWithViewer>
                        <span className="text-[10px] text-gray-400">商品图</span>
                      </div>
                    )}
                    {order.payment_proof_url && (
                      <div className="flex flex-col items-center gap-1">
                        <ImageWithViewer src={order.payment_proof_url} alt="付款凭证">
                          <img src={order.payment_proof_url} alt="付款凭证" className="h-20 w-20 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                        </ImageWithViewer>
                        <span className="text-[10px] text-gray-400">付款凭证</span>
                      </div>
                    )}
                    {order.purchase_screenshot_url && (
                      <div className="flex flex-col items-center gap-1">
                        <ImageWithViewer src={order.purchase_screenshot_url} alt="购买截图">
                          <img src={order.purchase_screenshot_url} alt="购买截图" className="h-20 w-20 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                        </ImageWithViewer>
                        <span className="text-[10px] text-gray-400">购买截图</span>
                      </div>
                    )}
                    {order.arrival_photo_url && (
                      <div className="flex flex-col items-center gap-1">
                        <ImageWithViewer src={order.arrival_photo_url} alt="入库图片">
                          <img src={order.arrival_photo_url} alt="入库图片" className="h-20 w-20 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                        </ImageWithViewer>
                        <span className="text-[10px] text-gray-400">入库图片</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Product links */}
              {productUrlText && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">商品链接</div>
                  <ReactMarkdown
                    className="text-xs text-gray-700 prose prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-0.5 [&_a]:text-blue-600 [&_a]:break-all"
                    components={{
                      hr: () => (
                        <div className="flex items-center gap-2 my-2">
                          <div className="flex-1 border-t border-indigo-300" />
                          <span className="text-[10px] text-indigo-400 font-medium">— 拆单分隔线 —</span>
                          <div className="flex-1 border-t border-indigo-300" />
                        </div>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 break-all inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 flex-shrink-0 inline" />{children}
                        </a>
                      ),
                      p: ({ children }) => <p className="my-0.5 break-all">{children}</p>,
                    }}
                  >
                    {productUrlText}
                  </ReactMarkdown>
                </div>
              )}

              {/* User notes and product description */}
              {(order.user_note || order.product_description) && (
                <div className="space-y-2">
                  {order.product_description && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                      <div className="text-xs text-gray-400 mb-0.5">商品描述</div>
                      {order.product_description}
                    </div>
                  )}
                  {order.user_note && (
                    <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-sm text-yellow-800 whitespace-pre-wrap">
                      <div className="text-xs text-yellow-500 mb-0.5">用户订单备注</div>
                      {order.user_note}
                    </div>
                  )}
                </div>
              )}

              {((order.selected_addons || []).length > 0 || (order.selected_addon_ids || []).length > 0) && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-purple-600 font-medium mb-1.5">增值服务</div>
                  <div className="space-y-1">
                    {(order.selected_addons || []).length > 0
                      ? (order.selected_addons || []).map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700">{a.name || a.id}</span>
                            <span className="font-medium text-purple-700">+{a.fee_currency || "JPY"} {a.fee_currency === "JPY" ? Math.round(parseFloat(a.fee || 0)) : a.fee}</span>
                          </div>
                        ))
                      : (order.selected_addon_ids || []).map((id, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 font-mono">{id}</span>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm">管理员备注</Label>
                <Textarea rows={2} className="mt-1 text-sm" value={form.admin_note}
                  onChange={e => f("admin_note", e.target.value)} />
              </div>

              {/* ── Status-specific action panels ── */}

              {/* pending_confirmation → confirm or reply or cancel */}
              {status === "pending_confirmation" && (
                <div className="space-y-3 border border-purple-100 rounded-xl p-3 bg-purple-50">
                  <div className="text-sm font-medium text-purple-800">后付款待确认 — 请选择处理方式</div>
                  <div className="space-y-2">
                    <Label className="text-xs">确认后设置付款金额 ({cur})</Label>
                    <Input type="number" step={cur === "JPY" ? "1" : "0.01"} placeholder="0" value={form.prepayment_amount}
                      onChange={e => f("prepayment_amount", cur === "JPY" ? Math.round(parseFloat(e.target.value) || 0) || "" : e.target.value)} />
                    <Label className="text-xs">付款截止日期（可选）</Label>
                    <Input type="date" value={form.payment_due_date}
                      onChange={e => f("payment_due_date", e.target.value)} />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                        onClick={handleConfirmOrder} disabled={!form.prepayment_amount || saving}>
                        ✓ 确认可购买，通知付款
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input placeholder="取消理由（取消时必填）" value={form.cancel_reason}
                        onChange={e => f("cancel_reason", e.target.value)} className="text-xs h-8" />
                      <Button size="sm" variant="outline" className="w-full text-xs border-red-300 text-red-600"
                        onClick={handleCancel} disabled={saving || !form.cancel_reason}>
                        取消订单
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* payment_pending → generate alipay link */}
              {status === "payment_pending" && (
                <div className="space-y-2 border border-orange-100 rounded-xl p-3 bg-orange-50">
                  <div className="text-sm font-medium text-orange-800">待付款 — 为用户生成支付宝付款链接</div>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" placeholder="付款金额" value={form.prepayment_amount}
                      onChange={e => f("prepayment_amount", e.target.value)} className="bg-white" />
                    <Button size="sm" variant="outline"
                      className="whitespace-nowrap text-blue-600 border-blue-300 hover:bg-blue-50"
                      onClick={handleGenerateAlipay}
                      disabled={generating || !form.prepayment_amount}>
                      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      <span className="ml-1 text-xs">生成链接</span>
                    </Button>
                  </div>
                  {alipayUrl && (
                    <div className="p-2 bg-white border border-blue-200 rounded-lg space-y-1.5">
                      <div className="flex gap-2">
                        <input readOnly value={alipayUrl}
                          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 font-mono truncate" />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCopyLink}>
                          {linkCopied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 pt-1">
                    <Input placeholder="取消理由（取消时必填）" value={form.cancel_reason}
                      onChange={e => f("cancel_reason", e.target.value)} className="text-xs h-8" />
                    <Button size="sm" variant="outline" className="w-full text-xs border-red-300 text-red-600"
                      onClick={handleCancel} disabled={saving || !form.cancel_reason}>
                      取消订单
                    </Button>
                  </div>
                </div>
              )}

              {/* paid / pending_purchase → mark purchased */}
              {(status === "paid" || status === "pending_purchase") && (
                <div className="space-y-3 border border-indigo-100 rounded-xl p-3 bg-indigo-50">
                  <div className="text-sm font-medium text-indigo-800">待下单 — 完成购买后上传截图</div>
                  <div className="space-y-2">
                    <label
                      className="cursor-pointer block"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith("image/")) uploadFile(file, setPurchaseScreenshot, setUploadingScreenshot);
                      }}
                    >
                      <div className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 text-sm transition-colors ${
                        purchaseScreenshot ? "border-green-300 bg-green-50 text-green-700" : uploadingScreenshot ? "border-blue-200 bg-blue-50 text-blue-500" : "border-indigo-200 bg-white text-gray-400 hover:border-indigo-400"
                      }`}>
                        {purchaseScreenshot
                          ? <><CheckCircle className="w-4 h-4" />截图已上传，点击或拖拽可更换</>
                          : uploadingScreenshot
                          ? <><Loader2 className="w-4 h-4 animate-spin" />上传中...</>
                          : <><Upload className="w-4 h-4" />点击或拖拽上传购买截图（可选）</>}
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => uploadFile(e.target.files[0], setPurchaseScreenshot, setUploadingScreenshot)} />
                    </label>
                    <div>
                      <Label className="text-xs text-gray-500">或粘贴截图URL</Label>
                      <Input
                        type="text"
                        placeholder="https://example.com/screenshot.jpg"
                        value={purchaseScreenshot || ""}
                        onChange={e => setPurchaseScreenshot(e.target.value)}
                        onPaste={e => {
                          const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                          if (item) {
                            e.preventDefault();
                            const file = item.getAsFile();
                            if (file) uploadFile(file, setPurchaseScreenshot, setUploadingScreenshot);
                          }
                        }}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                  {/* Split marker preview */}
                  {order.has_split_marker && (order.split_sections || []).length > 1 && !splitResult && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700">
                        <Scissors className="w-3.5 h-3.5" />
                        检测到 {order.split_sections.length} 组商品链接（拆单标记）
                      </div>
                      <div className="text-xs text-indigo-600 space-y-1">
                        {order.split_sections.map((sec, i) => (
                          <div key={i} className="truncate">
                            <span className="font-medium">第 {i+1} 批：</span>
                            {sec.split('\n')[0].slice(0, 50)}{sec.length > 50 ? '…' : ''}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-indigo-400">购买完成后可点击「下单并拆分」，将生成 {order.split_sections.length} 个子订单，货款平均分配</p>
                    </div>
                  )}
                  {splitResult && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                      ✓ 已拆分为 {splitResult.child_count} 个子订单
                      {(splitResult.children || []).map(c => (
                        <div key={c.id} className="mt-0.5 font-mono">{c.order_number}</div>
                      ))}
                    </div>
                  )}
                  <Input placeholder="取消理由（取消时必填）" value={form.cancel_reason}
                    onChange={e => f("cancel_reason", e.target.value)} className="text-xs" />
                  <div className="flex gap-2 flex-wrap">
                    {order.has_split_marker && (order.split_sections || []).length > 1 && !splitResult ? (
                      <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-xs"
                        onClick={handleSplitOrder} disabled={splitting || saving}>
                        {splitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />拆分中...</> : <><GitBranch className="w-3.5 h-3.5 mr-1" />下单并拆分</>}
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-xs"
                        onClick={handleMarkPurchased} disabled={saving}>
                        ✓ 购买完成 → 已下单
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-600"
                      onClick={handleCancel} disabled={saving || !form.cancel_reason}>
                      取消订单
                    </Button>
                  </div>
                </div>
              )}

              {/* purchased → in_warehouse */}
              {status === "purchased" && (
                <div className="space-y-3 border border-teal-100 rounded-xl p-3 bg-teal-50">
                  <div className="text-sm font-medium text-teal-800">已下单 — 到货后入库</div>
                  <div className="space-y-2">
                    <label
                      className="cursor-pointer block"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith("image/")) uploadFile(file, setArrivalPhoto, setUploadingArrival);
                      }}
                    >
                      <div className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-3 text-sm transition-colors ${
                        arrivalPhoto ? "border-green-300 bg-green-50 text-green-700" :
                        uploadingArrival ? "border-blue-200 bg-blue-50 text-blue-500" :
                        "border-teal-200 bg-white text-gray-400 hover:border-teal-400 hover:text-teal-600"
                      }`}>
                        {arrivalPhoto
                          ? <><CheckCircle className="w-4 h-4" /><span>到货图片已上传，点击或拖拽可更换</span></>
                          : uploadingArrival
                          ? <><Loader2 className="w-4 h-4 animate-spin" /><span>上传中...</span></>
                          : <><Upload className="w-4 h-4" /><span>点击选择或拖拽图片至此处</span></>}
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => uploadFile(e.target.files[0], setArrivalPhoto, setUploadingArrival)} />
                    </label>
                    <div>
                      <Label className="text-xs text-gray-500">或粘贴图片URL</Label>
                      <Input
                        type="text"
                        placeholder="https://example.com/photo.jpg"
                        value={arrivalPhoto || ""}
                        onChange={e => setArrivalPhoto(e.target.value)}
                        onPaste={e => {
                          const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                          if (item) {
                            e.preventDefault();
                            const file = item.getAsFile();
                            if (file) uploadFile(file, setArrivalPhoto, setUploadingArrival);
                          }
                        }}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">货品重量 (g)（默认100g）</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Input type="number" placeholder="100" value={form.weight_g || ""}
                        onChange={e => f("weight_g", e.target.value)}
                        onWheel={e => e.target.blur()}
                        className="flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <button type="button" onClick={() => f("weight_g", Math.max(0, (parseFloat(form.weight_g) || 0) + 100))}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600 whitespace-nowrap">+100</button>
                      <button type="button" onClick={() => f("weight_g", Math.max(0, (parseFloat(form.weight_g) || 0) + 1000))}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600 whitespace-nowrap">+1000</button>
                      <button type="button" onClick={() => f("weight_g", Math.max(0, (parseFloat(form.weight_g) || 0) - 100))}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600 whitespace-nowrap">-100</button>
                    </div>
                  </div>

                  {itemSizeTemplates.length > 0 && (
                    <div>
                      <Label className="text-xs flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />物品尺寸（可选）
                      </Label>
                      <div className="mt-1.5 space-y-1.5">
                        {itemSizeTemplates.map(template => (
                          <label key={template.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            selectedSizeId === template.id ? "border-teal-400 bg-teal-100" : "border-teal-200 hover:bg-teal-50"
                          }`}>
                            <input
                              type="radio"
                              checked={selectedSizeId === template.id}
                              onChange={() => setSelectedSizeId(template.id)}
                              className="mt-0.5 accent-teal-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-800">{template.title}</span>
                                <span className="text-xs font-mono text-teal-700">
                                  +{template.fee_currency} {template.extra_fee}
                                </span>
                              </div>
                              {template.description && <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>}
                            </div>
                          </label>
                        ))}
                        <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          selectedSizeId === "" ? "border-gray-300 bg-gray-50" : "border-gray-200 hover:bg-gray-50"
                        }`}>
                          <input
                            type="radio"
                            checked={selectedSizeId === ""}
                            onChange={() => setSelectedSizeId("")}
                            className="accent-gray-600"
                          />
                          <span className="text-xs text-gray-500">不选择尺寸</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Child orders quick-warehouse list (for -00 split parent) */}
                  {order.split_index === -1 && childOrders && childOrders.length > 0 && (
                    <div className="border border-indigo-100 rounded-lg bg-indigo-50 p-2.5 space-y-1.5">
                      <div className="text-xs font-medium text-indigo-700 flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5" />子订单快捷入库（{childOrders.length} 个）
                      </div>
                      {childOrders.map(child => (
                        <div key={child.id} className="flex items-center justify-between bg-white rounded border border-indigo-100 px-2.5 py-1.5 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-gray-600 truncate">{child.order_number}</div>
                            <div className="text-gray-500 truncate">{child.product_name}</div>
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              child.order_status === 'in_warehouse' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-600'
                            }`}>
                              {child.order_status === 'in_warehouse' ? '已入库' : '已下单'}
                            </span>
                            {child.order_status !== 'in_warehouse' && (
                              <button
                                type="button"
                                className="text-teal-600 hover:text-teal-800 text-xs underline whitespace-nowrap"
                                onClick={async () => {
                                  await updateOrder(child.id, {
                                    order_status: 'in_warehouse',
                                    in_warehouse_date: new Date().toISOString().split('T')[0],
                                  });
                                  const updated = await tenantEntity.list('Order', { parent_order_id: order.id });
                                  setChildOrders(updated || []);
                                }}
                              >
                                入库
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-indigo-400">各子订单独立入库后即可独立操作，不再与父订单绑定</p>
                    </div>
                  )}

                  <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700 text-xs"
                    onClick={handleMarkInWarehouse} disabled={saving}>
                    {order.split_index === -1 ? "✓ 父订单确认入库（-00单）" : "✓ 确认入库"}
                  </Button>
                </div>
              )}

              {/* in_warehouse: show info + allow admin to edit weight/size */}
              {status === "in_warehouse" && (
                <div className="space-y-2 border border-cyan-100 rounded-xl p-3 bg-cyan-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-cyan-800">已入库</div>
                    <button
                      type="button"
                      onClick={() => setWarehouseEditMode(v => !v)}
                      className="text-xs text-cyan-600 hover:text-cyan-800 underline"
                    >
                      {warehouseEditMode ? "收起" : "修改重量/尺寸"}
                    </button>
                  </div>
                  {/* Current values */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    {order.weight_g > 0 && <span className="bg-white border border-cyan-100 rounded px-2 py-0.5">当前重量：<strong>{order.weight_g}g</strong></span>}
                    {order.item_size_title && <span className="bg-white border border-cyan-100 rounded px-2 py-0.5">尺寸：<strong>{order.item_size_title}</strong></span>}
                  </div>
                  {order.shipping_method ? (
                    <div className="text-xs text-gray-700">
                      用户已预设发货方式：<strong>{order.shipping_method}</strong>
                      {order.consolidation_requested && "（申请拼邮）"}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">等待用户通知发货</p>
                  )}
                  {/* Inline edit panel */}
                  {warehouseEditMode && (
                    <div className="border-t border-cyan-200 pt-3 space-y-3 mt-2">
                      <div>
                        <Label className="text-xs">货品重量 (g)</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input type="number" placeholder={order.weight_g || "100"} value={warehouseWeight}
                            onChange={e => setWarehouseWeight(e.target.value)}
                            onWheel={e => e.target.blur()}
                            className="flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-white" />
                          <button type="button" onClick={() => setWarehouseWeight(v => String(Math.max(0, (parseFloat(v) || 0) + 100)))}
                            className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600 whitespace-nowrap">+100</button>
                          <button type="button" onClick={() => setWarehouseWeight(v => String(Math.max(0, (parseFloat(v) || 0) + 1000)))}
                            className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600 whitespace-nowrap">+1000</button>
                          <button type="button" onClick={() => setWarehouseWeight(v => String(Math.max(0, (parseFloat(v) || 0) - 100)))}
                            className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 text-gray-600 whitespace-nowrap">-100</button>
                        </div>
                      </div>
                      {itemSizeTemplates.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" />物品尺寸
                          </Label>
                          <div className="mt-1.5 space-y-1.5">
                            {itemSizeTemplates.map(template => (
                              <label key={template.id} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors bg-white ${
                                warehouseSizeId === template.id ? "border-cyan-400 bg-cyan-50" : "border-gray-200 hover:bg-gray-50"
                              }`}>
                                <input type="radio" checked={warehouseSizeId === template.id}
                                  onChange={() => setWarehouseSizeId(template.id)} className="mt-0.5 accent-cyan-600" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-800">{template.title}</span>
                                    <span className="text-xs font-mono text-cyan-700">+{template.fee_currency} {template.extra_fee}</span>
                                  </div>
                                  {template.description && <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>}
                                </div>
                              </label>
                            ))}
                            <label className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors bg-white ${
                              warehouseSizeId === "" ? "border-gray-300 bg-gray-50" : "border-gray-200 hover:bg-gray-50"
                            }`}>
                              <input type="radio" checked={warehouseSizeId === ""} onChange={() => setWarehouseSizeId("")} className="accent-gray-600" />
                              <span className="text-xs text-gray-500">不选择尺寸</span>
                            </label>
                          </div>
                        </div>
                      )}
                      <Button size="sm" className="w-full bg-cyan-600 hover:bg-cyan-700 text-xs"
                        disabled={savingWarehouseEdit}
                        onClick={async () => {
                          setSavingWarehouseEdit(true);
                          const newWeight = parseFloat(warehouseWeight) || order.weight_g || 0;
                          const newSizeTemplate = itemSizeTemplates.find(t => t.id === warehouseSizeId) || null;
                          // Build change summary for notification
                          const changes = [];
                          if (newWeight !== order.weight_g) changes.push(`货品重量：${order.weight_g || 0}g → ${newWeight}g`);
                          const oldSizeTitle = order.item_size_title || "无";
                          const newSizeTitle = newSizeTemplate?.title || "无";
                          if (newSizeTitle !== oldSizeTitle) changes.push(`物品尺寸：${oldSizeTitle} → ${newSizeTitle}`);
                          const updates = {
                            weight_g: newWeight,
                            item_size_template_id: newSizeTemplate?.id || "",
                            item_size_title: newSizeTemplate?.title || "",
                            item_size_extra_fee: newSizeTemplate?.extra_fee || 0,
                            item_size_fee_currency: newSizeTemplate?.fee_currency || "JPY",
                          };
                          // If there are changes, send system message + mark user unread
                          if (changes.length > 0) {
                            const sysMsg = {
                              id: Date.now().toString(),
                              from: "系统通知",
                              from_email: "__system__",
                              role: "admin",
                              content: `管理员已更新您的入库货品信息：${changes.join("；")}`,
                              timestamp: new Date().toISOString(),
                            };
                            const currentMessages = order.messages || [];
                            const currentUnread = order.unread_roles || [];
                            updates.messages = [...currentMessages, sysMsg];
                            updates.unread_roles = [...new Set([...currentUnread, "user"])];
                          }
                          await updateOrder(order.id, updates);
                          setSavingWarehouseEdit(false);
                          setWarehouseEditMode(false);
                          onSaved();
                        }}>
                        {savingWarehouseEdit ? "保存中..." : "保存修改并通知用户"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* notified_shipment → open pool detail modal */}
              {status === "notified_shipment" && (() => {
                // Find pool by order_ids (same logic as table action column)
                const pool = shippingPools.find(p => (p.order_ids || []).includes(order.id))
                  || (order.consolidation_pool_id ? shippingPools.find(p => p.id === order.consolidation_pool_id) : null);
                const poolId = pool?.id || order.consolidation_pool_id;
                const isConsolidation = pool?.consolidation_type && pool.consolidation_type !== "";
                return (
                  <div className="space-y-3 border border-cyan-100 rounded-xl p-3 bg-cyan-50">
                    <div className="text-sm font-medium text-cyan-800">已通知出货 — 通过发货池管理发货</div>
                    {order.shipping_method && (
                      <div className="text-xs text-gray-600">发货方式：{order.shipping_method}
                        {order.consolidation_requested && " · 拼邮"}
                      </div>
                    )}
                    {poolId && (
                      <div className="text-xs text-gray-500">
                        发货申请ID：<span className="font-mono text-cyan-700">{poolId.slice(-6).toUpperCase()}</span>
                      </div>
                    )}
                    <Button size="sm" variant="outline"
                      className={`w-full text-xs ${isConsolidation ? "text-purple-600 border-purple-200 hover:bg-purple-50" : "text-teal-600 border-teal-200 hover:bg-teal-50"}`}
                      disabled={!poolId}
                      onClick={() => { onClose(); onOpenPool?.(poolId); }}>
                      {isConsolidation
                        ? <><Layers className="w-3.5 h-3.5 mr-1.5" />查看拼邮详情</>
                        : <><Send className="w-3.5 h-3.5 mr-1.5" />查看发货需求详情</>}
                    </Button>
                  </div>
                );
              })()}

              {/* shipping_fee_pending / ready_to_ship → shipped */}
              {(status === "shipping_fee_pending" || status === "ready_to_ship") && (
                <div className="space-y-3 border border-lime-100 rounded-xl p-3 bg-lime-50">
                  <div className="text-sm font-medium text-lime-800">
                    {status === "shipping_fee_pending" ? "等待用户付运费" : "已付运费 — 填写运单号后发出"}
                  </div>
                  <div>
                    <Label className="text-xs">运单号</Label>
                    <Input className="mt-1" value={trackingNumber}
                      onChange={e => setTrackingNumber(e.target.value)} />
                  </div>
                  <Button size="sm" className="w-full bg-lime-600 hover:bg-lime-700 text-xs"
                    onClick={handleMarkShipped} disabled={!trackingNumber || saving}>
                    ✓ 确认已发出
                  </Button>
                </div>
              )}

              {/* Any status → send to awaiting_reply */}
              {!["awaiting_reply", "cancelled", "delivered"].includes(status) && (
                <div className="pt-2 border-t border-gray-100">
                  <Button size="sm" variant="outline" className="text-xs w-full border-orange-200 text-orange-600"
                    onClick={() => setTab("messages")}>
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />发起留言
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ───────── MESSAGES TAB ───────── */}
          {tab === "messages" && (
            <OrderMessageThread
              order={order}
              currentUser={currentUser || { email: "admin" }}
              isAdmin={true}
              contactInfo=""
              userProfileMap={userProfileMap}
              onMessageSent={() => {}}
            />
          )}

          {/* ───────── EDIT TAB ───────── */}
          {tab === "edit" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">订单状态</Label>
                  <Select value={form.order_status} onValueChange={v => f("order_status", v)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">余额 ({cur})</Label>
                  <Input type="number" step="0.01" className="mt-1" value={form.balance_credit}
                    onChange={e => f("balance_credit", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">日元报价 (¥)</Label>
                  <Input type="number" className="mt-1" value={form.estimated_jpy}
                    onChange={e => f("estimated_jpy", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">实际付款货币</Label>
                  <Select value={form.prepayment_currency} onValueChange={v => f("prepayment_currency", v)}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["JPY","CNY","USD","TWD","HKD","EUR","SGD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">
                    {form.prepayment_currency === "JPY" ? "预付款金额 (JPY)" : `实际付款金额 (${form.prepayment_currency})`}
                  </Label>
                  <Input type="number" step="0.01" className="mt-1" value={form.prepayment_amount}
                    onChange={e => f("prepayment_amount", e.target.value)} />
                </div>
                {form.prepayment_currency !== "JPY" && (
                  <div>
                    <Label className="text-sm">原始 JPY 金额</Label>
                    <Input type="number" step="1" className="mt-1" value={form.prepayment_amount_jpy}
                      onChange={e => f("prepayment_amount_jpy", e.target.value)}
                      placeholder={String(order.prepayment_amount_jpy || order.estimated_jpy || "")} />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm">付款截止日期</Label>
                <Input type="date" className="mt-1" value={form.payment_due_date}
                  onChange={e => f("payment_due_date", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">取消理由</Label>
                <Input className="mt-1" value={form.cancel_reason}
                  onChange={e => f("cancel_reason", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">管理员备注</Label>
                <Textarea rows={3} className="mt-1" value={form.admin_note}
                  onChange={e => f("admin_note", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex gap-2 justify-end flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          {tab === "edit" && (
            <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存变更"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}