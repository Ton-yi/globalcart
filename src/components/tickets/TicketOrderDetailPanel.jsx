/**
 * 票务订单详情面板
 * 专门用于显示票务订单的所有属性信息
 */
import { useState } from "react";
import { X, Ticket, Calendar, MapPin, Users, CreditCard, FileText, Image as ImageIcon, MessageSquare, Wand2, Loader2, Upload, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import ReactMarkdown from "react-markdown";
import OrderMessageThread from "@/components/orders/OrderMessageThread";
import OrderCancellationModule from "@/components/orders/OrderCancellationModule";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { updateOrder } from "@/lib/tenantApi";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";

const TICKET_STATUS_LABELS = {
  pending_confirmation: "待确认",
  accepted: "已受理",
  awaiting_lottery_result: "待抽选结果",
  purchased_pending_warehouse: "已购买待入库",
  in_warehouse: "已入库",
  shipped: "已发货",
  delivered: "已收货",
  cancelled: "已取消",
};

const TICKET_STATUS_COLORS = {
  pending_confirmation: "bg-gray-100 text-gray-700",
  accepted: "bg-blue-100 text-blue-700",
  awaiting_lottery_result: "bg-yellow-100 text-yellow-700",
  purchased_pending_warehouse: "bg-purple-100 text-purple-700",
  in_warehouse: "bg-green-100 text-green-700",
  shipped: "bg-teal-100 text-teal-700",
  delivered: "bg-green-200 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

const SALES_METHOD_LABELS = {
  first_come: "先着販売",
  lottery: "抽選販売",
  other: "その他",
};

const TICKETING_METHOD_LABELS = {
  paper: "紙チケット",
  electronic: "電子チケット",
  ticket_number: "発券番号",
};

export default function TicketOrderDetailPanel({ order, onClose, onRefresh, userProfileMap = {}, currentUser }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { user: authUser } = useAuth();
  const { can } = usePermissions();
  const actualCurrentUser = currentUser || authUser;
  const isAdmin = actualCurrentUser?.role === "admin" || actualCurrentUser?.role === "staff" || actualCurrentUser?.role === "platform_admin";
  const canUpdateStatus = can("order:update") || isAdmin;
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [ticketNumberInput, setTicketNumberInput] = useState(order.ticket_number_issued || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showTicketNumberModal, setShowTicketNumberModal] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [imageUploadType, setImageUploadType] = useState("ticket"); // "ticket" or "lottery"
  const [lotteryImageFile, setLotteryImageFile] = useState(null);
  const [lotteryImagePreview, setLotteryImagePreview] = useState(null);
  const [paperTicketImageFile, setPaperTicketImageFile] = useState(null);
  const [paperTicketImagePreview, setPaperTicketImagePreview] = useState(null);
  const [warehouseImageFile, setWarehouseImageFile] = useState(null);
  const [warehouseImagePreview, setWarehouseImagePreview] = useState(null);

  const ticketData = order.ticket_data || {};
  const seats = ticketData.seats || [];
  const totalSeats = seats.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const totalPrepaid = order.ticket_prepaid_total_jpy || 0;
  const totalRefund = order.ticket_refund_jpy || 0;

  const handleStatusUpdate = async (newStatus) => {
    setStatusUpdating(true);
    try {
      await updateOrder(order.id, {
        ticket_status: newStatus,
        messages: [
          ...(order.messages || []),
          {
            id: `status_update_${Date.now()}`,
            from: "系统通知",
            from_email: "system@system.local",
            role: "admin",
            content: `订单状态已更新为：${TICKET_STATUS_LABELS[newStatus] || newStatus}`,
            timestamp: new Date().toISOString(),
            is_system_notification: true,
            meta: { type: "status_update", new_status: newStatus }
          }
        ],
        unread_roles: ["user"]
      });
      toast.success("订单状态已更新");
      onRefresh?.(); // 刷新订单列表
      onClose?.();
    } catch (error) {
      toast.error("更新失败：" + error.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount <= 0) return "-";
    return `${Math.round(amount).toLocaleString()} JPY`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN", { 
      year: "numeric", 
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const isPendingConfirmation = order.ticket_status === "pending_confirmation";
  const isAccepted = order.ticket_status === "accepted";
  
  // 判断当前订单应该显示什么操作按钮
  const shouldShowTicketNumberButton = isAccepted && 
    (ticketData.sales_method === "first_come" || ticketData.sales_method === "other") &&
    (ticketData.ticketing_method === "electronic" || ticketData.ticketing_method === "ticket_number");
  
  // 先着/other + 紙チケット → 已受理时显示上传票图片按钮
  // 抽選 + 紙チケット → 待抽选结果状态时也显示上传票图片按钮（上传后→已购买待入库）
  const shouldShowPaperTicketButton = (
    isAccepted &&
    (ticketData.sales_method === "first_come" || ticketData.sales_method === "other") &&
    ticketData.ticketing_method === "paper"
  ) || (
    isAdmin &&
    order.ticket_status === "awaiting_lottery_result" &&
    ticketData.sales_method === "lottery" &&
    ticketData.ticketing_method === "paper"
  );

  // 抽選 → 已受理时显示上传抽选截图按钮（紙チケット的抽選在 awaiting_lottery_result 改用上方 paper 按钮）
  const shouldShowLotteryButton = isAccepted && ticketData.sales_method === "lottery";
  const shouldShowWarehouseButton = order.ticket_status === "purchased_pending_warehouse" && isAdmin;

  const handleTicketNumberSubmit = async () => {
    if (!ticketNumberInput.trim()) {
      toast.error("请输入发券番号");
      return;
    }
    setStatusUpdating(true);
    try {
      await updateOrder(order.id, {
        ticket_status: "shipped",
        ticket_number_issued: ticketNumberInput.trim(),
        messages: [
          ...(order.messages || []),
          {
            id: `ticket_number_${Date.now()}`,
            from: "系统通知",
            from_email: "system@system.local",
            role: "admin",
            content: `发券番号已登记：${ticketNumberInput.trim()}，订单状态更新为已发货`,
            timestamp: new Date().toISOString(),
            is_system_notification: true,
            meta: { type: "ticket_number_registered", ticket_number: ticketNumberInput.trim() }
          }
        ],
        unread_roles: ["user"]
      });
      toast.success("发券番号已登记，订单状态已更新");
      onRefresh?.();
      onClose?.();
    } catch (error) {
      toast.error("更新失败：" + error.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleImageUpload = async (file, type) => {
    setUploadingImage(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const imageUrl = uploadRes?.file_url;
      if (!imageUrl) { toast.error("图片上传失败"); return; }

      const newStatus = type === "ticket" ? "purchased_pending_warehouse" : "awaiting_lottery_result";
      const statusLabel = type === "ticket" ? "已购买待入库" : "等待抽选结果";
      const messageContent = type === "ticket"
        ? "票券图片已上传，订单状态更新为已购买待入库"
        : "抽选截图已上传，订单状态更新为等待抽选结果";

      await updateOrder(order.id, {
        ticket_status: newStatus,
        ticket_image_urls: [...(order.ticket_image_urls || []), imageUrl],
        messages: [
          ...(order.messages || []),
          { id: `image_upload_${Date.now()}`, from: "系统通知", from_email: "system@system.local",
            role: "admin", content: messageContent, timestamp: new Date().toISOString(),
            is_system_notification: true, meta: { type: "image_uploaded", image_url: imageUrl, new_status: newStatus } }
        ],
        unread_roles: ["user"]
      });
      toast.success(`图片已上传，订单状态已更新为${statusLabel}`);
      onRefresh?.();
      onClose?.();
    } catch (error) {
      toast.error("上传失败：" + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // 抽选：上传图片后更新状态为待抽选结果
  const handleLotteryImageUpload = async (file) => {
    if (!(file instanceof File)) return;
    setUploadingImage(true);
    try {
      const uploadRes2 = await base44.integrations.Core.UploadFile({ file });
      const imageUrl = uploadRes2?.file_url;
      if (!imageUrl) { toast.error("图片上传失败"); return; }

      await updateOrder(order.id, {
        ticket_status: "awaiting_lottery_result",
        ticket_image_urls: [...(order.ticket_image_urls || []), imageUrl],
        messages: [
          ...(order.messages || []),
          { id: `lottery_${Date.now()}`, from: "系统通知", from_email: "system@system.local",
            role: "admin", content: "抽选截图已上传，订单状态更新为等待抽选结果",
            timestamp: new Date().toISOString(), is_system_notification: true,
            meta: { type: "lottery_image_uploaded", image_url: imageUrl } }
        ],
        unread_roles: ["user"]
      });
      toast.success("抽选截图已上传，订单状态已更新为等待抽选结果");
      onRefresh?.();
      onClose?.();
    } catch (error) {
      toast.error("上传失败：" + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setLotteryImageFile(file);
          const previewUrl = URL.createObjectURL(file);
          setLotteryImagePreview(previewUrl);
          toast.success("图片已从剪贴板加载");
          break;
        }
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.indexOf('image') === -1) {
      toast.error("请上传图片文件");
      return;
    }
    
    setLotteryImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLotteryImagePreview(previewUrl);
    toast.success("图片已加载");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };
  
  // 已购买待入库 浮层
  const [showPurchasedPopover, setShowPurchasedPopover] = useState(false);
  const [purchasedConfirmed, setPurchasedConfirmed] = useState(false); // 第一次点击后设为true，第二次点击直接提交
  const defaultDeliveryDatetime = () => {
    const base = ticketData.performance_datetime
      ? new Date(ticketData.performance_datetime)
      : new Date();
    // 精确到小时
    base.setMinutes(0, 0, 0);
    return base.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  };
  const [deliveryDatetime, setDeliveryDatetime] = useState(defaultDeliveryDatetime);

  const handlePurchasedPendingWarehouse = async () => {
    setStatusUpdating(true);
    try {
      await updateOrder(order.id, {
        ticket_status: "purchased_pending_warehouse",
        ticket_data: { ...ticketData, estimated_ticket_delivery_datetime: deliveryDatetime + ":00:00" },
        messages: [
          ...(order.messages || []),
          { id: `purchased_${Date.now()}`, from: "系统通知", from_email: "system@system.local",
            role: "admin", content: "订单状态更新为已购买待入库，预计发票时间：" + new Date(deliveryDatetime + ":00:00").toLocaleString("zh-CN"),
            timestamp: new Date().toISOString(), is_system_notification: true,
            meta: { type: "status_update", new_status: "purchased_pending_warehouse" } }
        ],
        unread_roles: ["user"]
      });
      toast.success("订单已更新为已购买待入库");
      setShowPurchasedPopover(false);
      setPurchasedConfirmed(false);
      onRefresh?.();
      onClose?.();
    } catch (e) {
      toast.error("更新失败：" + e.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const [editingSeats, setEditingSeats] = useState(false);
  const [actualSeats, setActualSeats] = useState(
    (ticketData.seats || []).map(s => ({ ...s, actual_quantity: s.actual_quantity ?? s.quantity ?? 0 }))
  );
  const [savingSeats, setSavingSeats] = useState(false);

  // 演出信息编辑
  const [editingPerformance, setEditingPerformance] = useState(false);
  const [perfForm, setPerfForm] = useState({
    performance_name: ticketData.performance_name || "",
    performance_datetime: ticketData.performance_datetime || "",
    prefecture: ticketData.prefecture || "",
    purchase_link: ticketData.purchase_link || "",
  });
  const [savingPerf, setSavingPerf] = useState(false);

  const handleSavePerformance = async () => {
    setSavingPerf(true);
    try {
      await updateOrder(order.id, {
        ticket_data: { ...ticketData, ...perfForm },
      });
      toast.success("演出信息已保存");
      setEditingPerformance(false);
      onRefresh?.();
    } catch (e) {
      toast.error("保存失败：" + e.message);
    } finally {
      setSavingPerf(false);
    }
  };

  // 销售信息编辑
  const [editingSales, setEditingSales] = useState(false);
  const [salesForm, setSalesForm] = useState({
    sales_method: ticketData.sales_method || "",
    ticketing_method: ticketData.ticketing_method || "",
    sales_start_time: ticketData.sales_start_time || "",
    sales_end_time: ticketData.sales_end_time || "",
    lottery_result_time: ticketData.lottery_result_time || "",
  });
  const [savingSales, setSavingSales] = useState(false);

  const handleSaveSales = async () => {
    setSavingSales(true);
    try {
      await updateOrder(order.id, {
        ticket_data: { ...ticketData, ...salesForm },
      });
      toast.success("销售信息已保存");
      setEditingSales(false);
      onRefresh?.();
    } catch (e) {
      toast.error("保存失败：" + e.message);
    } finally {
      setSavingSales(false);
    }
  };

  // 正数 = 应退款，负数 = 应补款
  const computedRefund = actualSeats.reduce((sum, s) => {
    const diff = (s.quantity || 0) - (s.actual_quantity ?? s.quantity ?? 0);
    return sum + diff * (s.price_jpy || 0);
  }, 0) * (ticketData.account_count || 1);
  const needsSupplement = computedRefund < 0; // 实际买到更多 → 需要补款

  const handleSaveActualSeats = async () => {
    setSavingSeats(true);
    try {
      const updatedSeats = actualSeats.map(s => ({ ...s }));
      await updateOrder(order.id, {
        ticket_data: { ...ticketData, seats: updatedSeats },
        ticket_refund_jpy: computedRefund > 0 ? computedRefund : 0,
        supplement_requested: computedRefund < 0,
        supplement_amount: computedRefund < 0 ? Math.abs(computedRefund) : 0,
      });
      toast.success("实际数量已保存，退款金额已更新");
      setEditingSeats(false);
      onRefresh?.();
    } catch (e) {
      toast.error("保存失败：" + e.message);
    } finally {
      setSavingSeats(false);
    }
  };

  const tabs = [
    { key: "overview", label: "概览" },
    { key: "details", label: "席种 · 数量" },
    { key: "messages", label: "留言 & 取消", badge: (order.unread_roles || []).includes("admin") && isAdmin ? "red" : null },
    { key: "fees", label: "费用明细" },
    { key: "timeline", label: "时间线" },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Ticket className="w-5 h-5 text-violet-600" />
              <Badge className={`text-xs ${TICKET_STATUS_COLORS[order.ticket_status] || "bg-gray-100 text-gray-700"}`}>
                {TICKET_STATUS_LABELS[order.ticket_status] || order.ticket_status}
              </Badge>
              {ticketData.sales_method && (
                <Badge variant="outline" className="text-xs">
                  {SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method}
                </Badge>
              )}
              {ticketData.ticketing_method && (
                <Badge variant="outline" className="text-xs">
                  {TICKETING_METHOD_LABELS[ticketData.ticketing_method] || ticketData.ticketing_method}
                </Badge>
              )}
              {order.supplement_requested && (order.supplement_amount || 0) > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">待补款</Badge>
              )}
              <span className="text-xs text-gray-400 font-mono">{order.order_number}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{order.product_name}</h2>
              {ticketData.performance_name && (
                <>
                  <span className="text-gray-300 flex-shrink-0">・</span>
                  <span className="text-sm text-gray-600 truncate">{ticketData.performance_name}</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.user_name} · {order.user_email}
            </p>
          </div>
          <button onClick={onClose} className="ml-3 p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 sticky top-[73px] bg-white z-10 items-center">
          {tabs.map(t => (
            <button 
              key={t.key} 
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === t.key 
                  ? "border-violet-600 text-violet-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
          {isPendingConfirmation && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusUpdate("accepted")}
              disabled={statusUpdating}
              className="ml-auto bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              已受理 / 待开票
            </Button>
          )}
          {shouldShowTicketNumberButton && (
            <div className="ml-auto flex items-center gap-2">
              <textarea
                value={ticketNumberInput}
                onChange={(e) => setTicketNumberInput(e.target.value)}
                placeholder="请输入发券番号"
                className="w-40 h-8 text-sm resize-none rounded-md border border-input bg-background px-3 py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                disabled={statusUpdating}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (ticketNumberInput.trim()) {
                    handleTicketNumberSubmit();
                  } else {
                    setShowTicketNumberModal(true);
                  }
                }}
                disabled={statusUpdating}
                className="bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200"
              >
                <Wand2 className="w-3.5 h-3.5 mr-1" />
                登记发券番号 / 已发货
              </Button>
              {/* 已购买待入库 按钮（通用） */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={statusUpdating}
                  onClick={() => {
                    if (!showPurchasedPopover) {
                      setDeliveryDatetime(defaultDeliveryDatetime());
                      setPurchasedConfirmed(false);
                      setShowPurchasedPopover(true);
                    } else if (purchasedConfirmed) {
                      handlePurchasedPendingWarehouse();
                    } else {
                      setPurchasedConfirmed(true);
                    }
                  }}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                >
                  已购买待入库
                </Button>
                {showPurchasedPopover && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-72">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-800">设置预计发票时间</span>
                      <button onClick={() => { setShowPurchasedPopover(false); setPurchasedConfirmed(false); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                    </div>
                    <div className="mb-3">
                      <Label className="text-xs text-gray-500 mb-1 block">预计发票日期时间（精确到小时）</Label>
                      <input
                        type="datetime-local"
                        step="3600"
                        value={deliveryDatetime}
                        onChange={e => {
                          // 截取到小时
                          const v = e.target.value.slice(0, 13);
                          setDeliveryDatetime(v);
                          setPurchasedConfirmed(false);
                        }}
                        className="w-full h-8 text-sm rounded-md border border-input px-2 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    </div>
                    <div className="mb-3 text-xs text-purple-700 bg-purple-50 rounded px-3 py-2">
                      当前设置预计发票时间为：<span className="font-semibold">{deliveryDatetime ? new Date(deliveryDatetime + ":00:00").toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={statusUpdating}
                      onClick={handlePurchasedPendingWarehouse}
                    >
                      {statusUpdating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      确认 / 已购买待入库
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {shouldShowPaperTicketButton && (
            <div className="ml-auto flex items-center gap-2">
              <div className="relative" style={{ minWidth: 160 }}>
                <input
                  readOnly
                  placeholder="点击后粘贴 / 拖拽截图"
                  value={paperTicketImageFile instanceof File ? paperTicketImageFile.name : ""}
                  className={`h-8 w-full rounded-md border px-3 text-sm shadow-sm outline-none focus:ring-1 cursor-pointer ${
                    paperTicketImageFile instanceof File
                      ? "border-purple-400 bg-purple-50 text-purple-700 focus:ring-purple-400 pr-14"
                      : "border-input bg-background text-muted-foreground focus:ring-ring pr-3"
                  }`}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) {
                          setPaperTicketImageFile(file);
                          setPaperTicketImagePreview(URL.createObjectURL(file));
                          toast.success("图片已从剪贴板加载");
                          break;
                        }
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer?.files?.[0];
                    if (file && file.type.indexOf('image') !== -1) {
                      setPaperTicketImageFile(file);
                      setPaperTicketImagePreview(URL.createObjectURL(file));
                      toast.success("图片已加载");
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={async (e) => {
                    e.currentTarget.focus();
                    try {
                      const items = await navigator.clipboard.read();
                      for (const item of items) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) {
                          const blob = await item.getType(imageType);
                          const file = new File([blob], `clipboard_${Date.now()}.png`, { type: imageType });
                          setPaperTicketImageFile(file);
                          setPaperTicketImagePreview(URL.createObjectURL(file));
                          toast.success("已从剪切板加载图片");
                          break;
                        }
                      }
                    } catch {
                      // 用户未授权剪切板或剪切板无图片，保持 focus 等待手动粘贴
                    }
                  }}
                />
                {paperTicketImageFile instanceof File && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {paperTicketImagePreview && <img src={paperTicketImagePreview} className="h-5 w-5 object-cover rounded" />}
                    <button
                      className="text-purple-500 hover:text-red-500 px-1 text-base leading-none"
                      onClick={() => { setPaperTicketImageFile(null); setPaperTicketImagePreview(null); }}
                    >×</button>
                  </div>
                )}
              </div>
              <input
                id="paper-ticket-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPaperTicketImageFile(file);
                    setPaperTicketImagePreview(URL.createObjectURL(file));
                    toast.success("图片已加载");
                  }
                }}
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (paperTicketImageFile instanceof File) {
                    await handleImageUpload(paperTicketImageFile, "ticket");
                  } else {
                    document.getElementById('paper-ticket-image-input').click();
                  }
                }}
                disabled={statusUpdating || uploadingImage}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                {paperTicketImageFile instanceof File ? "确认上传 / 已购买待入库" : "上传票图片 / 已购买待入库"}
              </Button>
            </div>
          )}
          {shouldShowWarehouseButton && (
            <div className="ml-auto flex items-center gap-2">
              <div className="relative" style={{ minWidth: 160 }}>
                <input
                  readOnly
                  placeholder="点击后粘贴 / 拖拽截图"
                  value={warehouseImageFile instanceof File ? warehouseImageFile.name : ""}
                  className={`h-8 w-full rounded-md border px-3 text-sm shadow-sm outline-none focus:ring-1 cursor-pointer ${
                    warehouseImageFile instanceof File
                      ? "border-green-400 bg-green-50 text-green-700 focus:ring-green-400 pr-14"
                      : "border-input bg-background text-muted-foreground focus:ring-ring pr-3"
                  }`}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) {
                          setWarehouseImageFile(file);
                          setWarehouseImagePreview(URL.createObjectURL(file));
                          toast.success("图片已从剪贴板加载");
                          break;
                        }
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer?.files?.[0];
                    if (file && file.type.indexOf('image') !== -1) {
                      setWarehouseImageFile(file);
                      setWarehouseImagePreview(URL.createObjectURL(file));
                      toast.success("图片已加载");
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={async (e) => {
                    e.currentTarget.focus();
                    try {
                      const items = await navigator.clipboard.read();
                      for (const item of items) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) {
                          const blob = await item.getType(imageType);
                          const file = new File([blob], `clipboard_${Date.now()}.png`, { type: imageType });
                          setWarehouseImageFile(file);
                          setWarehouseImagePreview(URL.createObjectURL(file));
                          toast.success("已从剪切板加载图片");
                          break;
                        }
                      }
                    } catch {
                      // 用户未授权剪切板或剪切板无图片，保持 focus 等待手动粘贴
                    }
                  }}
                />
                {warehouseImageFile instanceof File && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {warehouseImagePreview && <img src={warehouseImagePreview} className="h-5 w-5 object-cover rounded" />}
                    <button
                      className="text-green-500 hover:text-red-500 px-1 text-base leading-none"
                      onClick={() => { setWarehouseImageFile(null); setWarehouseImagePreview(null); }}
                    >×</button>
                  </div>
                )}
              </div>
              <input
                id="warehouse-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setWarehouseImageFile(file);
                    setWarehouseImagePreview(URL.createObjectURL(file));
                    toast.success("图片已加载");
                  }
                }}
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (warehouseImageFile instanceof File) {
                    setUploadingImage(true);
                    try {
                      const uploadRes = await base44.integrations.Core.UploadFile({ file: warehouseImageFile });
                      const imageUrl = uploadRes?.file_url;
                      if (!imageUrl) { toast.error("图片上传失败"); return; }
                      await updateOrder(order.id, {
                        ticket_status: "in_warehouse",
                        ticket_image_urls: [...(order.ticket_image_urls || []), imageUrl],
                        messages: [
                          ...(order.messages || []),
                          { id: `warehouse_${Date.now()}`, from: "系统通知", from_email: "system@system.local",
                            role: "admin", content: "票券图片已上传，订单状态更新为已入库/待发货",
                            timestamp: new Date().toISOString(), is_system_notification: true,
                            meta: { type: "warehouse_image_uploaded", image_url: imageUrl } }
                        ],
                        unread_roles: ["user"]
                      });
                      toast.success("图片已上传，订单状态已更新为已入库/待发货");
                      onRefresh?.();
                      onClose?.();
                    } catch (error) {
                      toast.error("上传失败：" + error.message);
                    } finally {
                      setUploadingImage(false);
                    }
                  } else {
                    document.getElementById('warehouse-image-input').click();
                  }
                }}
                disabled={statusUpdating || uploadingImage}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                {warehouseImageFile instanceof File ? "确认上传 / 已入库待发货" : "上传图片 / 已入库待发货"}
              </Button>
            </div>
          )}
          {shouldShowLotteryButton && (
            <div className="ml-auto flex items-center gap-2">
              {/* 真实输入框：可点击聚焦后粘贴图片，也支持拖拽 */}
              <div className="relative" style={{ minWidth: 160 }}>
                <input
                  readOnly
                  placeholder="点击后粘贴 / 拖拽截图"
                  value={lotteryImageFile instanceof File ? lotteryImageFile.name : ""}
                  className={`h-8 w-full rounded-md border px-3 text-sm shadow-sm outline-none focus:ring-1 cursor-pointer ${
                    lotteryImageFile instanceof File
                      ? "border-yellow-400 bg-yellow-50 text-yellow-700 focus:ring-yellow-400 pr-14"
                      : "border-input bg-background text-muted-foreground focus:ring-ring pr-3"
                  }`}
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) {
                          setLotteryImageFile(file);
                          setLotteryImagePreview(URL.createObjectURL(file));
                          toast.success("图片已从剪贴板加载");
                          break;
                        }
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer?.files?.[0];
                    if (file && file.type.indexOf('image') !== -1) {
                      setLotteryImageFile(file);
                      setLotteryImagePreview(URL.createObjectURL(file));
                      toast.success("图片已加载");
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={async (e) => {
                    e.currentTarget.focus();
                    // 尝试从剪切板读取图片
                    try {
                      const items = await navigator.clipboard.read();
                      for (const item of items) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) {
                          const blob = await item.getType(imageType);
                          const file = new File([blob], `clipboard_${Date.now()}.png`, { type: imageType });
                          setLotteryImageFile(file);
                          setLotteryImagePreview(URL.createObjectURL(file));
                          toast.success("已从剪切板加载图片");
                          break;
                        }
                      }
                    } catch {
                      // 用户未授权剪切板或剪切板无图片，保持 focus 等待手动粘贴
                    }
                  }}
                />
                {lotteryImageFile instanceof File && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {lotteryImagePreview && <img src={lotteryImagePreview} className="h-5 w-5 object-cover rounded" />}
                    <button
                      className="text-yellow-500 hover:text-red-500 px-1 text-base leading-none"
                      onClick={() => { setLotteryImageFile(null); setLotteryImagePreview(null); }}
                    >×</button>
                  </div>
                )}
              </div>
              <input
                id="lottery-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLotteryImageFile(file);
                    setLotteryImagePreview(URL.createObjectURL(file));
                    toast.success("图片已加载");
                  }
                }}
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (lotteryImageFile instanceof File) {
                    await handleLotteryImageUpload(lotteryImageFile);
                  } else {
                    document.getElementById('lottery-image-input').click();
                  }
                }}
                disabled={statusUpdating || uploadingImage}
                className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200"
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                {lotteryImageFile instanceof File ? "确认上传 / 待抽选结果" : "上传抽选截图 / 待抽选结果"}
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          
          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                  <div className="text-xs text-violet-600 mb-1">预付总额</div>
                  <div className="text-lg font-bold text-violet-700">{formatCurrency(totalPrepaid)}</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="text-xs text-blue-600 mb-1">账户数</div>
                  <div className="text-lg font-bold text-blue-700">{ticketData.account_count || 1}</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <div className="text-xs text-green-600 mb-1">总票数</div>
                  <div className="text-lg font-bold text-green-700">{totalSeats}</div>
                </div>
                {((ticketData.additional_fee_jpy || 0) > 0 || (ticketData.lottery_win_bonus_jpy || 0) > 0) ? (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <div className="text-xs text-orange-600 mb-1">追加费用</div>
                    {(ticketData.additional_fee_jpy || 0) > 0 && (
                      <div className="text-xs text-orange-700">追加料金 <span className="font-bold">{Math.round(ticketData.additional_fee_jpy).toLocaleString()} JPY</span></div>
                    )}
                    {(ticketData.lottery_win_bonus_jpy || 0) > 0 && (
                      <div className="text-xs text-orange-700 mt-0.5">抽中追加 <span className="font-bold">{Math.round(ticketData.lottery_win_bonus_jpy).toLocaleString()} JPY</span></div>
                    )}
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <div className="text-xs text-orange-600 mb-1">销售方式</div>
                    <div className="text-sm font-bold text-orange-700">
                      {SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method || "-"}
                    </div>
                  </div>
                )}
              </div>

              {/* Performance info & Sales info */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* 演出信息 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Calendar className="w-4 h-4" />演出信息
                    </div>
                    {isAdmin && !editingPerformance && (
                      <button onClick={() => { setPerfForm({ performance_name: ticketData.performance_name || "", performance_datetime: ticketData.performance_datetime || "", prefecture: ticketData.prefecture || "", purchase_link: ticketData.purchase_link || "" }); setEditingPerformance(true); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {editingPerformance ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <Label className="text-xs text-gray-500">演出名称</Label>
                        <Input className="mt-0.5 h-7 text-sm" value={perfForm.performance_name} onChange={e => setPerfForm(p => ({ ...p, performance_name: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">演出时间</Label>
                        <Input type="datetime-local" className="mt-0.5 h-7 text-sm" value={perfForm.performance_datetime ? perfForm.performance_datetime.slice(0, 16) : ""} onChange={e => setPerfForm(p => ({ ...p, performance_datetime: e.target.value ? new Date(e.target.value).toISOString() : "" }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">都道府县</Label>
                        <Input className="mt-0.5 h-7 text-sm" value={perfForm.prefecture} onChange={e => setPerfForm(p => ({ ...p, prefecture: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">演出/购买链接</Label>
                        <Input className="mt-0.5 h-7 text-sm" value={perfForm.purchase_link} onChange={e => setPerfForm(p => ({ ...p, purchase_link: e.target.value }))} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700" onClick={handleSavePerformance} disabled={savingPerf}>
                          {savingPerf ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />保存</>}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingPerformance(false)} disabled={savingPerf}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">演出名称</span>
                        <span className="font-medium text-gray-900">{ticketData.performance_name || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">演出时间</span>
                        <span className="font-medium text-gray-900">{formatDate(ticketData.performance_datetime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">都道府县</span>
                        <span className="font-medium text-gray-900">{ticketData.prefecture || "-"}</span>
                      </div>
                      {ticketData.purchase_link && (
                        <div className="flex justify-between items-start gap-2 pt-1">
                          <span className="text-gray-500">演出链接</span>
                          <a href={ticketData.purchase_link} target="_blank" rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-xs break-all">
                            点击查看 →
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 销售信息 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <FileText className="w-4 h-4" />销售信息
                    </div>
                    {isAdmin && !editingSales && (
                      <button onClick={() => { setSalesForm({ sales_method: ticketData.sales_method || "", ticketing_method: ticketData.ticketing_method || "", sales_start_time: ticketData.sales_start_time || "", sales_end_time: ticketData.sales_end_time || "", lottery_result_time: ticketData.lottery_result_time || "" }); setEditingSales(true); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {editingSales ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <Label className="text-xs text-gray-500">销售方式</Label>
                        <Select value={salesForm.sales_method} onValueChange={v => setSalesForm(p => ({ ...p, sales_method: v }))}>
                          <SelectTrigger className="mt-0.5 h-7 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first_come">先着販売</SelectItem>
                            <SelectItem value="lottery">抽選販売</SelectItem>
                            <SelectItem value="other">その他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">発券方式</Label>
                        <Select value={salesForm.ticketing_method} onValueChange={v => setSalesForm(p => ({ ...p, ticketing_method: v }))}>
                          <SelectTrigger className="mt-0.5 h-7 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paper">紙チケット</SelectItem>
                            <SelectItem value="electronic">電子チケット</SelectItem>
                            <SelectItem value="ticket_number">発券番号</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">販売開始</Label>
                        <Input type="datetime-local" className="mt-0.5 h-7 text-sm" value={salesForm.sales_start_time ? salesForm.sales_start_time.slice(0, 16) : ""} onChange={e => setSalesForm(p => ({ ...p, sales_start_time: e.target.value ? new Date(e.target.value).toISOString() : "" }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">販売終了</Label>
                        <Input type="datetime-local" className="mt-0.5 h-7 text-sm" value={salesForm.sales_end_time ? salesForm.sales_end_time.slice(0, 16) : ""} onChange={e => setSalesForm(p => ({ ...p, sales_end_time: e.target.value ? new Date(e.target.value).toISOString() : "" }))} />
                      </div>
                      {salesForm.sales_method === "lottery" && (
                        <div>
                          <Label className="text-xs text-gray-500">抽選結果発表</Label>
                          <Input type="datetime-local" className="mt-0.5 h-7 text-sm" value={salesForm.lottery_result_time ? salesForm.lottery_result_time.slice(0, 16) : ""} onChange={e => setSalesForm(p => ({ ...p, lottery_result_time: e.target.value ? new Date(e.target.value).toISOString() : "" }))} />
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700" onClick={handleSaveSales} disabled={savingSales}>
                          {savingSales ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />保存</>}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingSales(false)} disabled={savingSales}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">销售方式</span>
                        <span className="font-medium text-gray-900">{SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">发券方式</span>
                        <span className="font-medium text-gray-900">{TICKETING_METHOD_LABELS[ticketData.ticketing_method] || ticketData.ticketing_method || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">提交日期</span>
                        <span className="font-medium text-gray-900">{formatDate(order.created_date)}</span>
                      </div>
                      {ticketData.estimated_ticket_delivery_datetime && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">预计发票时间</span>
                          <span className="font-medium text-purple-700">{formatDate(ticketData.estimated_ticket_delivery_datetime)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Purchase links */}
              {order.product_url && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />购买链接
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <ReactMarkdown
                      className="text-sm text-gray-700 prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:break-all"
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {order.product_url}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Ticket images */}
              {(order.ticket_image_urls || []).length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />票券图片
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {order.ticket_image_urls.map((url, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <ImageWithViewer src={url} alt={`票券图片 ${i + 1}`}>
                          <img src={url} alt={`票券图片 ${i + 1}`} 
                            className="w-full h-32 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                        </ImageWithViewer>
                        <span className="text-[10px] text-gray-400">图片 {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User note */}
              {order.user_note && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">用户备注</div>
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-yellow-800 whitespace-pre-wrap">
                    {order.user_note}
                  </div>
                </div>
              )}

              {/* Admin note */}
              {order.admin_note && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">管理员备注</div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {order.admin_note}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== DETAILS TAB ===== */}
          {activeTab === "details" && (
            <div className="space-y-5">
              {/* 席种明细 + 实际数量编辑 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    席种明细（共 {totalSeats} 票，×{ticketData.account_count || 1} 账户）
                  </div>
                  {isAdmin && !editingSeats && (
                    <Button size="sm" variant="outline" onClick={() => setEditingSeats(true)}>
                      编辑实际数量
                    </Button>
                  )}
                  {isAdmin && editingSeats && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingSeats(false); setActualSeats((ticketData.seats || []).map(s => ({ ...s, actual_quantity: s.actual_quantity ?? s.quantity ?? 0 }))); }}>
                        取消
                      </Button>
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={handleSaveActualSeats} disabled={savingSeats}>
                        {savingSeats ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />保存中...</> : "保存"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">席种</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">需求数</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">单价 (JPY)</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">小计</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">实际买到</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">差额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {actualSeats.map((seat, i) => {
                        const actualQty = seat.actual_quantity ?? seat.quantity ?? 0;
                        const diff = (seat.quantity || 0) - actualQty;
                        const refundForRow = diff * (seat.price_jpy || 0) * (ticketData.account_count || 1);
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{seat.seat_type || "-"}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700">{seat.quantity || 0}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700">{(seat.price_jpy || 0).toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                              {((seat.quantity || 0) * (seat.price_jpy || 0) * (ticketData.account_count || 1)).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {editingSeats ? (
                                <div className="inline-flex items-center gap-1 w-20">
                                  <input
                                   type="number"
                                   min={0}
                                   value={actualQty}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value));
                                      setActualSeats(prev => prev.map((s, idx) => idx === i ? { ...s, actual_quantity: val } : s));
                                    }}
                                    className="w-10 text-right rounded border border-violet-300 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                                  />
                                  <div className="flex flex-col">
                                    <button
                                      onClick={() => setActualSeats(prev => prev.map((s, idx) => idx === i ? { ...s, actual_quantity: (s.actual_quantity ?? s.quantity ?? 0) + 1 } : s))}
                                      className="h-[18px] w-6 flex items-center justify-center rounded-t border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs leading-none"
                                    >▲</button>
                                    <button
                                      onClick={() => setActualSeats(prev => prev.map((s, idx) => idx === i ? { ...s, actual_quantity: Math.max(0, (s.actual_quantity ?? s.quantity ?? 0) - 1) } : s))}
                                      className="h-[18px] w-6 flex items-center justify-center rounded-b border-x border-b border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs leading-none"
                                    >▼</button>
                                  </div>
                                </div>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  seat.actual_quantity === undefined ? "text-gray-400" :
                                  diff > 0 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                                }`}>
                                  {seat.actual_quantity === undefined ? "—" : actualQty}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs">
                              {diff > 0 ? (
                                <span className="text-orange-600 font-medium">退 {Math.abs(refundForRow).toLocaleString()} JPY</span>
                              ) : diff < 0 ? (
                                <span className="text-red-600 font-medium">补 {Math.abs(refundForRow).toLocaleString()} JPY</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 退款/补款合计预览 */}
                {(editingSeats || computedRefund !== 0) && (
                  <div className={`mt-3 rounded-lg p-3 flex justify-between items-center text-sm ${
                    needsSupplement ? "bg-red-50 border border-red-200" :
                    computedRefund > 0 ? "bg-orange-50 border border-orange-200" :
                    "bg-gray-50 border border-gray-200"
                  }`}>
                    <span className="font-medium text-gray-700">
                      {needsSupplement ? "应补款合计" : "应退款合计"}
                    </span>
                    <span className={`font-bold text-base ${
                      needsSupplement ? "text-red-600" :
                      computedRefund > 0 ? "text-orange-600" : "text-gray-500"
                    }`}>
                      {computedRefund !== 0 ? `${Math.abs(computedRefund).toLocaleString()} JPY` : "无差额"}
                    </span>
                  </div>
                )}

                {/* 已存退款/补款信息 */}
                {!editingSeats && (order.ticket_refund_jpy || 0) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-blue-600 px-1">
                    <span>已记录退差价：{(order.ticket_refund_jpy).toLocaleString()} JPY</span>
                    <Badge className={order.ticket_refund_settled ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                      {order.ticket_refund_settled ? "已结算" : "待结算"}
                    </Badge>
                  </div>
                )}
                {!editingSeats && order.supplement_requested && (order.supplement_amount || 0) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-red-600 px-1">
                    <span>待补款金额：{(order.supplement_amount).toLocaleString()} JPY</span>
                    <Badge className="bg-red-100 text-red-700">待补款</Badge>
                  </div>
                )}
              </div>

              {/* 销售时间线 */}
              {(ticketData.sales_start_time || ticketData.sales_end_time || ticketData.lottery_result_time) && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Calendar className="w-4 h-4" />销售时间线
                  </div>
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    {ticketData.sales_start_time && (
                      <div><div className="text-xs text-gray-500 mb-1">销售开始</div><div className="font-medium text-gray-900">{formatDate(ticketData.sales_start_time)}</div></div>
                    )}
                    {ticketData.sales_end_time && (
                      <div><div className="text-xs text-gray-500 mb-1">销售结束</div><div className="font-medium text-gray-900">{formatDate(ticketData.sales_end_time)}</div></div>
                    )}
                    {ticketData.lottery_result_time && (
                      <div><div className="text-xs text-gray-500 mb-1">抽选结果发表</div><div className="font-medium text-gray-900">{formatDate(ticketData.lottery_result_time)}</div></div>
                    )}
                  </div>
                </div>
              )}

              {/* 发券番号 */}
              {order.ticket_number_issued && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="text-sm font-semibold text-blue-800 mb-1">発券番号</div>
                  <div className="text-lg font-mono font-bold text-blue-700">{order.ticket_number_issued}</div>
                </div>
              )}
            </div>
          )}

          {/* ===== MESSAGES & CANCEL TAB ===== */}
          {activeTab === "messages" && (
            <div>
              <OrderMessageThread
                order={order}
                currentUser={actualCurrentUser}
                isAdmin={isAdmin}
                userProfileMap={userProfileMap}
                hideHistory={false}
              />
            </div>
          )}



          {/* ===== FEES TAB ===== */}
          {activeTab === "fees" && (
            <div className="space-y-4">
              {/* Detailed fee breakdown */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-900">
                  <CreditCard className="w-4 h-4" />费用详细构成
                </div>
                <div className="space-y-2 text-sm">
                  {/* Base ticket cost */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-green-700">席种总价</span>
                    <span className="font-medium text-green-900">
                      {formatCurrency(seats.reduce((sum, s) => sum + ((s.quantity || 0) * (s.price_jpy || 0)), 0))}
                    </span>
                  </div>
                  <div className="text-xs text-green-600 pl-3">
                    {seats.map((s, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{s.seat_type || `席种 ${i + 1}`} × {s.quantity}</span>
                        <span>{formatCurrency((s.quantity || 0) * (s.price_jpy || 0))}</span>
                      </div>
                    ))}
                  </div>

                  {/* Account multiplier */}
                  {(ticketData.account_count || 1) > 1 && (
                    <div className="flex justify-between items-center py-1 pl-3 border-l-2 border-green-300">
                      <span className="text-green-700">账户数 ×{ticketData.account_count}</span>
                      <span className="font-medium text-green-900">
                        {formatCurrency(seats.reduce((sum, s) => sum + ((s.quantity || 0) * (s.price_jpy || 0)), 0) * ((ticketData.account_count || 1) - 1))}
                      </span>
                    </div>
                  )}

                  {/* Additional fees */}
                  {(ticketData.additional_fee_jpy || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-green-700">追加料金</span>
                      <span className="font-medium text-green-900">{formatCurrency(ticketData.additional_fee_jpy)}</span>
                    </div>
                  )}

                  {/* Lottery bonus */}
                  {(ticketData.lottery_win_bonus_jpy || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-green-700">抽中追加报酬</span>
                      <span className="font-medium text-green-900">{formatCurrency(ticketData.lottery_win_bonus_jpy)}</span>
                    </div>
                  )}

                  {/* Payment surcharge */}
                  {(order.payment_surcharge_jpy || 0) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-green-700">支付方式服务费</span>
                      <span className="font-medium text-green-900">{formatCurrency(order.payment_surcharge_jpy)}</span>
                    </div>
                  )}

                  {/* Subtotal */}
                  <div className="border-t border-green-300 pt-2 flex justify-between items-center text-base">
                    <span className="font-semibold text-green-900">预付总额</span>
                    <span className="font-bold text-green-900">{formatCurrency(totalPrepaid)}</span>
                  </div>

                  {/* Refund */}
                  {totalRefund > 0 && (
                    <>
                      <div className="flex justify-between items-center py-1 text-blue-700">
                        <span>退差价</span>
                        <span className="font-medium">-{formatCurrency(totalRefund)}</span>
                      </div>
                      <div className="text-xs text-blue-600 pl-3">
                        退差价状态：{order.ticket_refund_settled ? "已结算" : "待结算"}
                      </div>
                    </>
                  )}

                  {/* Final total */}
                  <div className="border-t-2 border-green-400 pt-3 flex justify-between items-center text-lg bg-green-100/50 rounded px-3 py-2">
                    <span className="font-bold text-green-900">实际支付</span>
                    <span className="font-bold text-green-900">
                      {formatCurrency(totalPrepaid - totalRefund + (order.payment_surcharge_jpy || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Refund info */}
              {totalRefund > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <CreditCard className="w-4 h-4" />退差价信息
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">退差价金额</span>
                    <span className="font-bold text-blue-700">{formatCurrency(totalRefund)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">退差价状态</span>
                    <Badge className={order.ticket_refund_settled ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                      {order.ticket_refund_settled ? "已结算" : "待结算"}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Payment info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="text-sm font-semibold text-gray-700 mb-2">支付信息</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">支付方式</span>
                    <span className="font-medium text-gray-900">
                      {{ 
                        alipay: "支付宝", 
                        wechatpay: "微信支付", 
                        paypay: "PayPay", 
                        paypal: "PayPal", 
                        credit_card: "信用卡", 
                        bank_transfer: "银行转账", 
                        credit: "记账", 
                        other: "其他" 
                      }[order.payment_method] || order.payment_method || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">支付模式</span>
                    <span className="font-medium text-gray-900">
                      {{ 
                        prepay: "预付款", 
                        deferred: "后付款", 
                        fullpay_once: "一次付清", 
                        credit: "记账" 
                      }[order.payment_mode] || order.payment_mode || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">支付状态</span>
                    <span className="font-medium text-gray-900">
                      {{ 
                        pending: "待处理", 
                        awaiting_payment: "待付款", 
                        awaiting_confirmation: "待确认", 
                        paid: "已付款", 
                        underpaid: "不足额", 
                        overpaid: "超额", 
                        confirmed: "已确认" 
                      }[order.payment_status] || order.payment_status || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== TIMELINE TAB ===== */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              {/* Order timeline */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-700 mb-3">订单时间线</div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">订单创建</div>
                      <div className="text-xs text-gray-500">{formatDate(order.created_date)}</div>
                    </div>
                  </div>
                  {order.submit_date && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">提交日期</div>
                        <div className="text-xs text-gray-500">{formatDate(order.submit_date)}</div>
                      </div>
                    </div>
                  )}
                  {order.purchased_date && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">已购买</div>
                        <div className="text-xs text-gray-500">{formatDate(order.purchased_date)}</div>
                      </div>
                    </div>
                  )}
                  {order.in_warehouse_date && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">已入库</div>
                        <div className="text-xs text-gray-500">{formatDate(order.in_warehouse_date)}</div>
                      </div>
                    </div>
                  )}
                  {order.shipped_date && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">已发货</div>
                        <div className="text-xs text-gray-500">{formatDate(order.shipped_date)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages timeline */}
              {(order.messages || []).length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-700 mb-3">留言记录</div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {order.messages.map((msg, i) => (
                      <div key={i} className={`flex items-start gap-3 ${msg.role === "admin" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${
                          msg.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {msg.role === "admin" ? "管" : "用"}
                        </div>
                        <div className={`flex-1 ${msg.role === "admin" ? "text-right" : ""}`}>
                          <div className={`inline-block px-3 py-2 rounded-lg text-sm ${
                            msg.role === "admin" ? "bg-blue-50 text-blue-800" : "bg-gray-50 text-gray-800"
                          }`}>
                            {msg.content}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{formatDate(msg.timestamp)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 发券番号输入弹窗 */}
        {showTicketNumberModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={() => setShowTicketNumberModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onMouseDown={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-900">登记发券番号</h3>
                <p className="text-xs text-gray-500 mt-0.5">{order.order_number}</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div>
                  <Label className="text-sm">发券番号</Label>
                  <Textarea
                    value={ticketNumberInput}
                    onChange={(e) => setTicketNumberInput(e.target.value)}
                    placeholder="请输入发券番号（支持多行）"
                    className="mt-1 min-h-[120px] text-base font-mono"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  <p>当前订单：{order.product_name}</p>
                  <p className="mt-1">销售方式：{SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method}</p>
                  <p>发券方式：{TICKETING_METHOD_LABELS[ticketData.ticketing_method] || ticketData.ticketing_method}</p>
                </div>
              </div>
              <div className="px-6 py-3 border-t flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowTicketNumberModal(false)} disabled={statusUpdating}>
                  取消
                </Button>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleTicketNumberSubmit} disabled={statusUpdating || !ticketNumberInput.trim()}>
                  {statusUpdating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />处理中...</> : <><Wand2 className="w-3.5 h-3.5 mr-1" />确认登记</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 图片上传弹窗 */}
        {showImageUploadModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={() => setShowImageUploadModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onMouseDown={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-900">
                  {imageUploadType === "ticket" ? "上传票券图片" : "上传抽选截图"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{order.order_number}</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  <p>当前订单：{order.product_name}</p>
                  <p className="mt-1">销售方式：{SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method}</p>
                  <p>发券方式：{TICKETING_METHOD_LABELS[ticketData.ticketing_method] || ticketData.ticketing_method}</p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">点击选择图片或拖拽图片到此处</p>
                  <p className="text-xs text-gray-500 mt-1">支持 JPG、PNG 格式</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="image-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file, imageUploadType);
                      }
                    }}
                    disabled={uploadingImage}
                  />
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <Button size="sm" className="mt-3" disabled={uploadingImage}>
                      {uploadingImage ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />上传中...</> : "选择图片"}
                    </Button>
                  </Label>
                </div>
              </div>
              <div className="px-6 py-3 border-t flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowImageUploadModal(false)} disabled={uploadingImage}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}