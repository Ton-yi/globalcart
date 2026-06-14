/**
 * 票务订单详情面板
 * 专门用于显示票务订单的所有属性信息
 */
import { useState } from "react";
import { X, Ticket, Calendar, MapPin, Users, CreditCard, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import ReactMarkdown from "react-markdown";

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

export default function TicketOrderDetailPanel({ order, onClose, userProfileMap = {} }) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "details" | "fees" | "timeline"

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

  const tabs = [
    { key: "overview", label: "概览" },
    { key: "details", label: "票务详情" },
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
              <span className="text-xs text-gray-400 font-mono">{order.order_number}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 truncate">{order.product_name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.user_name} · {order.user_email}
            </p>
          </div>
          <button onClick={onClose} className="ml-3 p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 sticky top-[73px] bg-white z-10">
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
                    {SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method || "-"}
                  </div>
                </div>
              </div>

              {/* Performance info */}
              <div className="grid md:grid-cols-2 gap-4">
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
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FileText className="w-4 h-4" />销售信息
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">销售方式</span>
                      <span className="font-medium text-gray-900">
                        {SALES_METHOD_LABELS[ticketData.sales_method] || ticketData.sales_method || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">发券方式</span>
                      <span className="font-medium text-gray-900">
                        {TICKETING_METHOD_LABELS[ticketData.ticketing_method] || ticketData.ticketing_method || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">提交日期</span>
                      <span className="font-medium text-gray-900">{formatDate(order.created_date)}</span>
                    </div>
                  </div>
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
            <div className="space-y-6">
              {/* Seats breakdown */}
              {seats.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />席种明细（共 {totalSeats} 票）
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">席种</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">数量</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">单价</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">小计</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">实际购买</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {seats.map((seat, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{seat.seat_type || "-"}</td>
                            <td className="px-3 py-2.5 text-gray-700">{seat.quantity || 0}</td>
                            <td className="px-3 py-2.5 text-gray-700">{formatCurrency(seat.price_jpy)}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900">
                              {formatCurrency((seat.quantity || 0) * (seat.price_jpy || 0))}
                            </td>
                            <td className="px-3 py-2.5">
                              {seat.actual_quantity !== undefined ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  seat.actual_quantity !== seat.quantity 
                                    ? "bg-yellow-100 text-yellow-700" 
                                    : "bg-green-100 text-green-700"
                                }`}>
                                  {seat.actual_quantity}
                                </span>
                              ) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sales timeline */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Calendar className="w-4 h-4" />销售时间线
                </div>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  {ticketData.sales_start_time && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">销售开始</div>
                      <div className="font-medium text-gray-900">{formatDate(ticketData.sales_start_time)}</div>
                    </div>
                  )}
                  {ticketData.sales_end_time && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">销售结束</div>
                      <div className="font-medium text-gray-900">{formatDate(ticketData.sales_end_time)}</div>
                    </div>
                  )}
                  {ticketData.lottery_result_time && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">抽选结果发表</div>
                      <div className="font-medium text-gray-900">{formatDate(ticketData.lottery_result_time)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional fees */}
              {(ticketData.additional_fee_jpy || 0) > 0 && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-purple-800">
                    <CreditCard className="w-4 h-4" />追加料金
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600">用户预期额外报酬</span>
                    <span className="font-bold text-purple-700">{formatCurrency(ticketData.additional_fee_jpy)}</span>
                  </div>
                </div>
              )}

              {/* Lottery win bonus */}
              {(ticketData.lottery_win_bonus_jpy || 0) > 0 && (
                <div className="bg-pink-50 border border-pink-100 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-pink-800">
                    <CreditCard className="w-4 h-4" />抽中追加报酬
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-pink-600">抽选販売追加报酬</span>
                    <span className="font-bold text-pink-700">{formatCurrency(ticketData.lottery_win_bonus_jpy)}</span>
                  </div>
                </div>
              )}

              {/* Ticket number */}
              {order.ticket_number_issued && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="text-sm font-semibold text-blue-800 mb-1">发券番号</div>
                  <div className="text-lg font-mono font-bold text-blue-700">{order.ticket_number_issued}</div>
                </div>
              )}
            </div>
          )}

          {/* ===== FEES TAB ===== */}
          {activeTab === "fees" && (
            <div className="space-y-4">
              {/* Fee summary */}
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
                  <CreditCard className="w-4 h-4" />费用汇总
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">预付总额</span>
                    <span className="font-bold text-green-700">{formatCurrency(totalPrepaid)}</span>
                  </div>
                  {totalRefund > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">退差价</span>
                      <span className="font-bold text-green-700">{formatCurrency(totalRefund)}</span>
                    </div>
                  )}
                  {(order.payment_surcharge_jpy || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">支付方式服务费</span>
                      <span className="font-bold text-green-700">{formatCurrency(order.payment_surcharge_jpy)}</span>
                    </div>
                  )}
                  <div className="border-t border-green-200 pt-2 flex justify-between text-base">
                    <span className="font-semibold text-green-800">实际支付</span>
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
      </div>
    </div>
  );
}