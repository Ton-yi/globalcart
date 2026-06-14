/**
 * 实物订单控制器
 * 
 * 负责实物订单的：
 * - 表格列定义
 * - 单元格渲染逻辑
 * - 详情弹窗组件
 * - 数据过滤规则
 */

import { Package } from "lucide-react";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PreShipmentBadge from "@/components/admin/PreShipmentBadge";
import { matchStoreTagResult } from "@/lib/onlineStoreTag";

export const PhysicalOrderController = {
  getLabel: () => "实物订单",
  getIcon: () => Package,
  
  /**
   * 获取控制器辅助方法（可选）
   */
  getHelpers: () => ({
    // 可以在这里定义控制器需要的辅助方法
  }),

  /**
   * 获取表格列配置
   */
  getColumnConfig: () => {
    return [
      { key: "order_number", label: "订单号", defaultVisible: true, sortable: true },
      { key: "user_name", label: "用户名", defaultVisible: true, sortable: true },
      { key: "product_name", label: "商品名", defaultVisible: true, sortable: true },
      { key: "estimated_jpy", label: "货款", defaultVisible: true, sortable: true },
      { key: "prepayment_amount", label: "付款金额", defaultVisible: true, sortable: true },
      { key: "weight_g", label: "订单重量", defaultVisible: true, sortable: true },
      { key: "order_status", label: "订单状态", defaultVisible: true, sortable: true },
      { key: "online_store_tag", label: "商城标签", defaultVisible: false, sortable: true },
      { key: "reply_status", label: "回复状态", defaultVisible: false, sortable: true },
      { key: "purchased_date", label: "下单日", defaultVisible: false, sortable: true },
      { key: "in_warehouse_date", label: "入库日", defaultVisible: false, sortable: true },
      { key: "shipped_date", label: "发货日", defaultVisible: false, sortable: true },
      { key: "submit_date", label: "订单提交日", defaultVisible: false, sortable: true },
      { key: "product_image_url", label: "商品图片", defaultVisible: false, sortable: false, isImage: true },
      { key: "arrival_photo_url", label: "入库图片", defaultVisible: false, sortable: false, isImage: true },
      { key: "product_description", label: "商品描述", defaultVisible: false, sortable: true },
      { key: "admin_note", label: "管理员备注", defaultVisible: false, sortable: true },
      { key: "user_note", label: "用户订单备注", defaultVisible: false, sortable: true },
      { key: "payment_due_date", label: "付款截止日期", defaultVisible: false, sortable: true },
      { key: "fullpay_once", label: "一次付款", defaultVisible: false, sortable: false, isFullPayOnce: true },
    ];
  },

  /**
   * 渲染单元格内容
   */
  renderCell: (order, col, helpers) => {
    const { userAvatars, storeTagRules, onOpenFullpaySettlement } = helpers || {};

    const formatAmount = (amount, currency) => {
      if (!amount || amount <= 0) return "-";
      if (currency === "JPY") return `${Math.round(amount).toLocaleString()} yen`;
      if (currency === "CNY") return `${Math.round(amount)} yuan`;
      return `${currency} ${amount.toFixed(2)}`;
    };

    switch (col.key) {
      case "order_number": {
        const isSplitPending = order.has_split_marker && !order.parent_order_id && order.split_index !== -1;
        return <span className="font-mono text-xs text-gray-500">{order.order_number ? `${order.order_number}${isSplitPending ? " - 00" : ""}` : "-"}</span>;
      }
      case "user_name": {
        const profile = userAvatars?.[order.user_email] || {};
        const avatarUrl = profile.avatar_url || null;
        const displayName = profile.display_name || order.user_name || order.user_email || "?";
        return (
          <div className="flex items-center gap-2 min-w-0">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100" />
              : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs text-gray-500 font-medium">
                  {displayName[0].toUpperCase()}
                </div>
            }
            <span className="text-sm text-gray-800 truncate">{displayName}</span>
          </div>
        );
      }
      case "product_name":
        return <span className="text-sm font-medium text-gray-900 truncate">{order.product_name}</span>;
      
      case "estimated_jpy":
        return <span className="text-sm text-gray-700">{order.estimated_jpy ? `${Math.round(order.estimated_jpy).toLocaleString()} yen` : "-"}</span>;
      
      case "prepayment_amount": {
        const amt = order.prepayment_amount;
        const cur = order.prepayment_currency || "JPY";
        const jpyAmt = order.prepayment_amount_jpy || (cur === "JPY" ? amt : null) || order.paid_amount || null;
        const isNonJpy = cur && cur !== "JPY" && amt > 0;

        const mainDisplay = jpyAmt
          ? `${Math.round(jpyAmt).toLocaleString()} yen`
          : formatAmount(amt, cur);

        if (col.showActualOnly && isNonJpy) {
          const actualDisplay = cur === "CNY" ? `${Math.round(amt)} 元` : `${cur} ${Number(amt).toFixed(2)}`;
          return <span className="text-sm text-gray-700">{actualDisplay}</span>;
        }
        if (col.showActual && isNonJpy) {
          const actualSub = cur === "CNY" ? `实付 ${Math.round(amt)} 元` : `实付 ${cur} ${Number(amt).toFixed(2)}`;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-gray-700">{mainDisplay}</span>
              <span className="text-[11px] text-gray-400">{actualSub}</span>
            </div>
          );
        }
        return <span className="text-sm text-gray-700">{mainDisplay}</span>;
      }
      
      case "weight_g":
        return <span className="text-sm text-gray-700">{order.weight_g ? `${order.weight_g}g` : "-"}</span>;
      
      case "order_status":
        return (
          <div className="flex flex-col gap-0.5">
            <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
              {getStatusLabel(order.order_status, "admin")}
            </Badge>
            {order.order_status === "shipping_fee_pending" && (
              <Badge className="text-xs bg-orange-100 text-orange-700 w-fit">待付运费</Badge>
            )}
          </div>
        );
      
      case "product_image_url": {
        const imgW = col.imageWidth || 40;
        return order.product_image_url
          ? <ImageWithViewer src={order.product_image_url} alt={order.product_name}>
              <img src={order.product_image_url} alt="" style={{ maxWidth: imgW, maxHeight: imgW, width: "100%", height: "auto" }} className="rounded object-cover border border-gray-100 cursor-pointer" />
            </ImageWithViewer>
          : <span className="text-xs text-gray-300">-</span>;
      }
      
      case "arrival_photo_url": {
        const imgW = col.imageWidth || 40;
        return order.arrival_photo_url
          ? <ImageWithViewer src={order.arrival_photo_url} alt="入库图片">
              <img src={order.arrival_photo_url} alt="" style={{ maxWidth: imgW, maxHeight: imgW, width: "100%", height: "auto" }} className="rounded object-cover border border-gray-100 cursor-pointer" />
            </ImageWithViewer>
          : <span className="text-xs text-gray-300">-</span>;
      }
      
      case "product_description":
        return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.product_description || "-"}</span>;
      
      case "admin_note":
        return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.admin_note || "-"}</span>;
      
      case "user_note":
        return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.user_note || "-"}</span>;
      
      case "payment_due_date":
        return <span className="text-xs text-gray-700">{order.payment_due_date || "-"}</span>;
      
      case "reply_status": {
        const hasUnread = (order.unread_roles || []).includes("admin");
        const hasMsgs = (order.messages || []).length > 0;
        if (hasUnread) return <Badge className="text-xs bg-red-100 text-red-700">有新消息</Badge>;
        if (hasMsgs) return <Badge className="text-xs bg-gray-100 text-gray-500">有留言</Badge>;
        return <Badge className="text-xs bg-gray-100 text-gray-400">无留言</Badge>;
      }
      
      case "created_date":
      case "submit_date":
        return <span className="text-xs text-gray-700">{order.created_date ? new Date(order.created_date).toLocaleDateString("zh-CN") : "-"}</span>;
      
      case "purchased_date":
        return <span className="text-xs text-gray-700">{order.purchased_date ? new Date(order.purchased_date).toLocaleDateString("zh-CN") : "-"}</span>;
      
      case "in_warehouse_date":
        return <span className="text-xs text-gray-700">{order.in_warehouse_date ? new Date(order.in_warehouse_date).toLocaleDateString("zh-CN") : "-"}</span>;
      
      case "shipped_date":
        return <span className="text-xs text-gray-700">{order.shipped_date ? new Date(order.shipped_date).toLocaleDateString("zh-CN") : "-"}</span>;
      
      case "fullpay_once": {
        const isFullpayOnce = order.payment_mode === "fullpay_once";
        const config = order.fullpay_once_config;
        
        if (!isFullpayOnce || !config) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        
        const estimatedWeight = config.user_estimated_weight_g || 0;
        const actualWeight = order.weight_g || 0;
        const estimatedFee = config.estimated_shipping_fee_jpy || 0;
        const weightDiff = actualWeight - estimatedWeight;
        const settlementStatus = config.settlement_status || "pending";
        
        const statusColors = {
          pending: "bg-gray-100 text-gray-600",
          needs_supplement: "bg-orange-100 text-orange-700",
          needs_refund: "bg-blue-100 text-blue-700",
          settled: "bg-green-100 text-green-700"
        };
        
        const statusLabels = {
          pending: "待结算",
          needs_supplement: "待补款",
          needs_refund: "待退款",
          settled: "已结算"
        };
        
        return (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <div className="flex items-center gap-1">
              <Badge className={`text-xs w-fit ${statusColors[settlementStatus]}`}>
                {statusLabels[settlementStatus] || settlementStatus}
              </Badge>
              {settlementStatus === 'pending' && actualWeight === 0 && (
                <button
                  onClick={() => onOpenFullpaySettlement?.(order, {
                    estimatedWeight,
                    estimatedFee,
                    weightDiff: 0,
                    feeDiff: 0
                  })}
                  className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                >
                  结算
                </button>
              )}
            </div>
            <div className="text-[10px] text-gray-600 space-y-0.5">
              <div className="flex justify-between gap-2">
                <span>预估:</span>
                <span>{estimatedWeight}g / ¥{estimatedFee.toLocaleString()}</span>
              </div>
              {actualWeight > 0 && (
                <div className="flex justify-between gap-2">
                  <span>实际:</span>
                  <span>{actualWeight}g</span>
                </div>
              )}
              {weightDiff !== 0 && actualWeight > 0 && (
                <div className={`flex justify-between gap-2 ${weightDiff > 0 ? 'text-orange-600 font-medium' : 'text-blue-600 font-medium'}`}>
                  <span>差异:</span>
                  <span>{weightDiff > 0 ? '+' : ''}{weightDiff}g</span>
                </div>
              )}
            </div>
          </div>
        );
      }
      
      case "online_store_tag": {
        const tagRules = col._rules || [];
        const firstUrl = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
        const tagResult = matchStoreTagResult(firstUrl, tagRules);
        return <Badge className={`text-xs ${tagResult.tag_color}`}>{tagResult.tag_label}</Badge>;
      }
      
      default:
        return "-";
    }
  },

  /**
   * 数据过滤逻辑
   */
  filterData: (orders, filters) => {
    const { statusFilter, search, userProfileMap, showArchived } = filters || {};
    
    return orders.filter(o => {
      // 存档过滤
      if (showArchived ? !o.is_archived : !!o.is_archived) return false;
      // 隐藏已拆分的父订单
      if (o.split_index === -1) return false;
      
      // 状态过滤
      const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
      
      // 搜索过滤
      const q = search?.toLowerCase() || "";
      const displayName = (userProfileMap?.[o.user_email]?.display_name || o.user_name || "").toLowerCase();
      const matchSearch = !q ||
        (o.product_name || "").toLowerCase().includes(q) ||
        (o.order_number || "").toLowerCase().includes(q) ||
        (o.user_email || "").toLowerCase().includes(q) ||
        (o.user_name || "").toLowerCase().includes(q) ||
        displayName.includes(q);
      
      return matchStatus && matchSearch;
    });
  },

  /**
   * 获取详情弹窗组件（暂时返回 null，由 AdminOrders 统一处理）
   */
  getDetailModal: () => null,
};