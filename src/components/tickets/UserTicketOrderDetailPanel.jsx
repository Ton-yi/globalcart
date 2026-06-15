/**
 * 用户端票务订单详情面板
 * 参照 TicketOrderDetailPanel 设计，但针对用户端简化操作权限
 */
import { useState } from "react";
import { X, Ticket, Calendar, MapPin, Users, CreditCard, FileText, Image as ImageIcon, MessageSquare, Loader2, Send, Truck, Store, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import ReactMarkdown from "react-markdown";
import OrderMessageThread from "@/components/orders/OrderMessageThread";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { updateOrder } from "@/lib/tenantApi";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  ticketStatusLabel, TICKET_STATUS_COLORS,
  salesMethodLabel, ticketingMethodLabel,
} from "@/lib/ticketConfig";

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

export default function UserTicketOrderDetailPanel({ order, onClose, onRefresh, userProfileMap = {}, currentUser }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { user: authUser } = useAuth();
  const { can } = usePermissions();
  const actualCurrentUser = currentUser || authUser;
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showShippingRequestModal, setShowShippingRequestModal] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  
  // 发货申请表单状态
  const [shippingMethodType, setShippingMethodType] = useState("domestic"); // "domestic" | "pickup"
  const [selectedShippingMethod, setSelectedShippingMethod] = useState("");
  const [selectedPickupLocation, setSelectedPickupLocation] = useState("");
  const [expectedDeliveryDatetime, setExpectedDeliveryDatetime] = useState("");
  const [pickupDatetime, setPickupDatetime] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("alipay");
  const [submittingShippingRequest, setSubmittingShippingRequest] = useState(false);

  const ticketData = order.ticket_data || {};
  const seats = ticketData.seats || [];
  const totalSeats = seats.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const totalPrepaid = order.ticket_prepaid_total_jpy || 0;
  const totalRefund = order.ticket_refund_jpy || 0;

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

  // 用户可对已入库订单提出发货申请
  const canRequestShipping = order.ticket_status === "in_warehouse";
  // 用户可对已发货订单确认收货
  const canConfirmDelivery = order.ticket_status === "shipped";

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setSendingMessage(true);
    try {
      await updateOrder(order.id, {
        messages: [
          ...(order.messages || []),
          {
            id: `msg_${Date.now()}`,
            from: actualCurrentUser?.full_name || actualCurrentUser?.email || "用户",
            from_email: actualCurrentUser?.email,
            role: "user",
            content: messageText.trim(),
            timestamp: new Date().toISOString(),
          }
        ],
        unread_roles: ["admin"]
      });
      toast.success("留言已发送");
      setMessageText("");
      onRefresh?.();
    } catch (error) {
      toast.error("发送失败：" + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleShippingRequestSubmit = async () => {
    if (!selectedShippingMethod && shippingMethodType === "domestic") {
      toast.error("请选择运输方式");
      return;
    }
    if (!selectedPickupLocation && shippingMethodType === "pickup") {
      toast.error("请选择自提地点");
      return;
    }
    if (!shippingNote.trim()) {
      toast.error("请输入备注说明");
      return;
    }

    setSubmittingShippingRequest(true);
    try {
      const res = await base44.functions.invoke('submitTicketShippingRequest', {
        order_id: order.id,
        shipping_method_type: shippingMethodType,
        shipping_method_code: selectedShippingMethod,
        pickup_location_id: selectedPickupLocation,
        expected_delivery_datetime: shippingMethodType === "domestic" ? expectedDeliveryDatetime : null,
        pickup_datetime: shippingMethodType === "pickup" ? pickupDatetime : null,
        note: shippingNote,
        payment_method: paymentMethod
      });

      toast.success(res.data?.message || "发货申请已提交");
      setShowShippingRequestModal(false);
      resetShippingForm();
      onRefresh?.();
    } catch (error) {
      toast.error("提交失败：" + error.message);
    } finally {
      setSubmittingShippingRequest(false);
    }
  };

  const resetShippingForm = () => {
    setShippingMethodType("domestic");
    setSelectedShippingMethod("");
    setSelectedPickupLocation("");
    setExpectedDeliveryDatetime("");
    setPickupDatetime("");
    setShippingNote("");
    setPaymentMethod("alipay");
  };

  const handleConfirmDelivery = async () => {
    if (!confirm("确认已收到商品？")) return;
    
    setConfirmingDelivery(true);
    try {
      const res = await base44.functions.invoke('confirmTicketDelivery', {
        order_id: order.id
      });

      toast.success(res.data?.message || "已确认收货");
      onRefresh?.();
    } catch (error) {
      toast.error("确认失败：" + error.message);
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const tabs = [
    { key: "overview", label: "概览" },
    { key: "details", label: "席种·数量" },
    { key: "messages", label: "留言" },
    { key: "fees", label: "费用明细" },
  ];

  // 获取本地运输方式和自提点列表
  const { data: localShippingData, isLoading: isLoadingShipping } = useQuery({
    queryKey: ['local_shipping_options', order.tenant_id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getLocalShippingOptions', {});
      return res.data || { shippingMethods: [], pickupLocations: [] };
    },
    enabled: !!order.tenant_id
  });

  const shippingMethods = localShippingData?.shippingMethods || [];
  const pickupLocations = localShippingData?.pickupLocations || [];

  // 计算需要补正的金额（使用本地运输方式的 fee_jpy）
  const calculatePaymentAmount = () => {
    const pendingSupplement = order.supplement_requested ? (order.supplement_amount || 0) : 0;
    let shippingFee = 0;
    if (shippingMethodType === "domestic" && selectedShippingMethod) {
      const method = shippingMethods.find(m => m.name === selectedShippingMethod);
      shippingFee = method?.fee_jpy || 0;
    } else if (shippingMethodType === "pickup" && selectedPickupLocation) {
      const location = pickupLocations.find(l => l._id === selectedPickupLocation);
      shippingFee = location?.pickup_service_fee_jpy || 0;
    }
    return pendingSupplement + shippingFee;
  };

  const paymentAmount = calculatePaymentAmount();

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
                {ticketStatusLabel(order.ticket_status, "user", ticketData.sales_method === "lottery")}
              </Badge>
              {ticketData.sales_method && (
                <Badge variant="outline" className="text-xs">
                  {salesMethodLabel(ticketData.sales_method)}
                </Badge>
              )}
              {ticketData.ticketing_method && (
                <Badge variant="outline" className="text-xs">
                  {ticketingMethodLabel(ticketData.ticketing_method)}
                </Badge>
              )}
              {order.ticket_refund_settled && (order.ticket_refund_jpy || 0) > 0 && (
                <Badge className="bg-green-100 text-green-700 text-xs">已退差价</Badge>
              )}
              <span className="text-xs text-gray-400 font-mono">{order.order_number}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{order.product_name}</h2>
              {ticketData.performance_name && (
                <>
                  <span className="text-gray-300 flex-shrink-0">·</span>
                  <span className="text-sm text-gray-600 truncate">{ticketData.performance_name}</span>
                </>
              )}
            </div>
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
          {canRequestShipping && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowShippingRequestModal(true)}
              className="ml-auto bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              发货申请
            </Button>
          )}
          {canConfirmDelivery && (
            <Button
              size="sm"
              onClick={handleConfirmDelivery}
              disabled={confirmingDelivery}
              className="ml-auto bg-green-600 hover:bg-green-700 text-white"
            >
              {confirmingDelivery ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              确认收货
            </Button>
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
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                  <div className="text-xs text-orange-600 mb-1">销售方式</div>
                  <div className="text-sm font-bold text-orange-700">
                    {salesMethodLabel(ticketData.sales_method) || "-"}
                  </div>
                </div>
              </div>

              {/* Performance info & Sales info */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* 演出信息 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Calendar className="w-4 h-4" />演出信息
                  </div>
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
                </div>

                {/* 销售信息 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FileText className="w-4 h-4" />销售信息
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">销售方式</span>
                      <span className="font-medium text-gray-900">{salesMethodLabel(ticketData.sales_method) || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">发券方式</span>
                      <span className="font-medium text-gray-900">{ticketingMethodLabel(ticketData.ticketing_method) || "-"}</span>
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
                </div>
              </div>

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

              {/* 发券番号 */}
              {order.ticket_number_issued && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="text-sm font-semibold text-blue-800 mb-1">発券番号</div>
                  <div className="text-lg font-mono font-bold text-blue-700">{order.ticket_number_issued}</div>
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
              {/* 席种明细 */}
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  席种明细（共 {totalSeats} 票，×{ticketData.account_count || 1} 账户）
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">席种</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">数量</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">单价 (JPY)</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">小计</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {seats.map((seat, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{seat.seat_type || "-"}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{seat.quantity || 0}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{(seat.price_jpy || 0).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                            {((seat.quantity || 0) * (seat.price_jpy || 0) * (ticketData.account_count || 1)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 退款信息 */}
                {(order.ticket_refund_jpy || 0) > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-blue-600 px-1">
                    <span>退差价金额：{(order.ticket_refund_jpy).toLocaleString()} JPY</span>
                    <Badge className={order.ticket_refund_settled ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                      {order.ticket_refund_settled ? "已结算" : "待结算"}
                    </Badge>
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
            </div>
          )}

          {/* ===== MESSAGES TAB ===== */}
          {activeTab === "messages" && (
            <div className="space-y-4">
              <OrderMessageThread
                order={order}
                currentUser={actualCurrentUser}
                isAdmin={false}
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
                      {formatCurrency(totalPrepaid - totalRefund)}
                    </span>
                  </div>
                </div>
              </div>

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
        </div>

        {/* 发货申请弹窗 */}
        {showShippingRequestModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={() => setShowShippingRequestModal(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onMouseDown={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">发货申请</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{order.order_number}</p>
                </div>
                <button onClick={() => setShowShippingRequestModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                {/* 发货方式切换 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">发货方式</Label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${shippingMethodType === "domestic" ? "font-semibold text-teal-700" : "text-gray-500"}`}>日本发货</span>
                      <Switch
                        checked={shippingMethodType === "pickup"}
                        onCheckedChange={(v) => {
                          setShippingMethodType(v ? "pickup" : "domestic");
                          setSelectedShippingMethod("");
                          setSelectedPickupLocation("");
                        }}
                      />
                      <span className={`text-xs ${shippingMethodType === "pickup" ? "font-semibold text-teal-700" : "text-gray-500"}`}>自提</span>
                    </div>
                  </div>

                  {shippingMethodType === "domestic" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 p-2 rounded">
                        <Truck className="w-3.5 h-3.5" />
                        <span>选择日本国内运输方式</span>
                      </div>
                      <div>
                        <Label className="text-xs">运输方式</Label>
                        <Select value={selectedShippingMethod} onValueChange={setSelectedShippingMethod}>
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue placeholder="请选择运输方式" />
                          </SelectTrigger>
                          <SelectContent>
                            {shippingMethods.map(m => (
                              <SelectItem key={m.name} value={m.name}>
                                {m.name} {m.fee_jpy ? `· ¥${m.fee_jpy.toLocaleString()}` : ""} {m.transit_days ? `· ${m.transit_days}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">期望到着日期时间</Label>
                        <Input
                          type="datetime-local"
                          value={expectedDeliveryDatetime}
                          onChange={(e) => setExpectedDeliveryDatetime(e.target.value)}
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 p-2 rounded">
                        <Store className="w-3.5 h-3.5" />
                        <span>选择自提地点</span>
                      </div>
                      <div>
                        <Label className="text-xs">自提地点</Label>
                        <Select value={selectedPickupLocation} onValueChange={setSelectedPickupLocation}>
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue placeholder="请选择自提地点" />
                          </SelectTrigger>
                          <SelectContent>
                            {pickupLocations.map(l => (
                              <SelectItem key={l._id} value={l._id}>
                                {l.name} {l.pickup_service_fee_jpy ? `· 服务费 ¥${l.pickup_service_fee_jpy.toLocaleString()}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedPickupLocation && (
                        <div>
                          <Label className="text-xs">期望自提日期时间</Label>
                          <Input
                            type="datetime-local"
                            value={pickupDatetime}
                            onChange={(e) => setPickupDatetime(e.target.value)}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 备注 */}
                <div className="mb-4">
                  <Label className="text-sm">备注说明</Label>
                  <Textarea
                    value={shippingNote}
                    onChange={(e) => setShippingNote(e.target.value)}
                    placeholder="请说明您的特殊要求..."
                    className="mt-1 min-h-[80px] text-sm"
                  />
                </div>

                {/* 付款金额补正 */}
                {paymentAmount > 0 && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                      <CreditCard className="w-4 h-4" />
                      付款金额补正
                    </div>
                    <div className="flex justify-between text-xs text-orange-700">
                      <span>订单待补款</span>
                      <span>¥{(order.supplement_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-orange-700">
                      <span>{shippingMethodType === "domestic" ? "运输费用" : "自提点服务费"}</span>
                      <span>¥{(paymentAmount - (order.supplement_amount || 0)).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-orange-200 pt-2 flex justify-between text-sm font-bold text-orange-900">
                      <span>合计应付</span>
                      <span>¥{paymentAmount.toLocaleString()}</span>
                    </div>
                    <div>
                      <Label className="text-xs">支付方式</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alipay">支付宝</SelectItem>
                          <SelectItem value="wechatpay">微信支付</SelectItem>
                          <SelectItem value="paypay">PayPay</SelectItem>
                          <SelectItem value="credit">记账</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  <p>提交后订单状态将更新为"已发货"（日本发货）或等待管理员确认（自提）。</p>
                  <p className="mt-1">管理员会审核您的发货申请并尽快处理。</p>
                </div>
              </div>

              <div className="px-6 py-3 border-t flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowShippingRequestModal(false)} disabled={submittingShippingRequest}>
                  取消
                </Button>
                <Button 
                  size="sm" 
                  className="bg-teal-600 hover:bg-teal-700 text-white" 
                  onClick={handleShippingRequestSubmit} 
                  disabled={submittingShippingRequest || (shippingMethodType === "domestic" && !selectedShippingMethod) || (shippingMethodType === "pickup" && !selectedPickupLocation) || !shippingNote.trim()}
                >
                  {submittingShippingRequest ? (<><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />提交中...</>) : (<><Send className="w-3.5 h-3.5 mr-1" />提交申请{paymentAmount > 0 ? ` · 支付 ¥${paymentAmount.toLocaleString()}` : ""}</>)}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}