/**
 * 票务订单控制器
 * 
 * 负责票务订单的：
 * - 表格列定义
 * - 单元格渲染逻辑
 * - 数据过滤规则
 * 
 * 注意：票务订单使用独立的 AdminTicketOrders 页面，
 * 此控制器为未来整合做准备
 */

import { Ticket, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const TicketOrderController = {
  getLabel: () => "票务订单",
  getIcon: () => Ticket,

  /**
   * 获取表格列配置（票务订单简化视图）
   */
  getColumnConfig: () => {
    return [
      { key: "order_number",             label: "订单号",       visible: true,  sortable: true },
      { key: "user_name",                label: "用户名",       visible: true,  sortable: true },
      { key: "product_name",             label: "演出名称",     visible: true,  sortable: true },
      { key: "ticket_status",            label: "票务状态",     visible: true,  sortable: true },
      { key: "ticket_prepaid_total_jpy", label: "订单金额",     visible: true,  sortable: true },
      { key: "sales_method",             label: "销售方式",     visible: true,  sortable: true },
      { key: "ticketing_method",         label: "发券方式",     visible: true,  sortable: true },
      { key: "sales_start_time",         label: "販売開始日",   visible: true,  sortable: true },
      { key: "sales_end_time",           label: "販売終了日",   visible: true,  sortable: true },
      { key: "lottery_result_time",      label: "結果発表日",   visible: true,  sortable: true },
      { key: "performance_datetime",     label: "開演日",       visible: false, sortable: true },
      { key: "prefecture",               label: "都道府県",     visible: false, sortable: true },
      { key: "sales_period",             label: "販売期間",     visible: false, sortable: false },
      { key: "submit_date",              label: "订单提交日",   visible: false, sortable: true },
      { key: "account_count",            label: "账户数",       visible: false, sortable: true },
      { key: "additional_fee_jpy",       label: "追加料金",     visible: false, sortable: true },
      { key: "lottery_win_bonus_jpy",    label: "抽中追加报酬", visible: false, sortable: true },
      { key: "purchase_link",            label: "购买链接",     visible: false, sortable: false },
      { key: "ticket_image_urls",        label: "演出图片",     visible: false, sortable: false, isImage: true },
      { key: "payment_method",           label: "付款方式",     visible: false, sortable: true },
    ];
  },

  /**
   * 渲染票务订单单元格
   */
  renderCell: (order, col, helpers) => {
    const { userAvatars } = helpers || {};

    const formatAmount = (amount) => {
      if (!amount || amount <= 0) return "-";
      return `${Math.round(amount).toLocaleString()} yen`;
    };

    const getTicketStatusLabel = (status) => {
      const labels = {
        pending_confirmation: "待确认",
        accepted: "已受理",
        awaiting_lottery_result: "待抽选结果",
        purchased_pending_warehouse: "已购买待入库",
        in_warehouse: "已入库",
        shipped: "已发货",
        delivered: "已收货",
        cancelled: "已取消",
      };
      return labels[status] || status;
    };

    const getTicketStatusColor = (status) => {
      const colors = {
        pending_confirmation: "bg-gray-100 text-gray-700",
        accepted: "bg-blue-100 text-blue-700",
        awaiting_lottery_result: "bg-yellow-100 text-yellow-700",
        purchased_pending_warehouse: "bg-purple-100 text-purple-700",
        in_warehouse: "bg-green-100 text-green-700",
        shipped: "bg-teal-100 text-teal-700",
        delivered: "bg-green-200 text-green-800",
        cancelled: "bg-red-100 text-red-700",
      };
      return colors[status] || "bg-gray-100 text-gray-700";
    };

    switch (col.key) {
      case "order_number":
        return <span className="font-mono text-xs text-gray-500">{order.order_number || "-"}</span>;
      
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
        return <span className="text-sm font-medium text-gray-900 truncate">{order.product_name || "-"}</span>;
      
      case "ticket_prepaid_total_jpy":
        return <span className="text-sm text-gray-700">{formatAmount(order.ticket_prepaid_total_jpy)}</span>;
      
      case "ticket_status":
        return (
          <Badge className={`text-xs ${getTicketStatusColor(order.ticket_status)}`}>
            {getTicketStatusLabel(order.ticket_status)}
          </Badge>
        );
      
      case "performance_datetime": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.performance_datetime ? new Date(td.performance_datetime).toLocaleDateString("zh-CN") : "-"}</span>;
      }
      
      case "prefecture": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.prefecture || "-"}</span>;
      }
      
      case "sales_method": {
        const td = order.ticket_data || {};
        const labels = {
          first_come: "先着",
          lottery: "抽选",
          other: "其它",
        };
        return <span className="text-xs text-gray-700">{td.sales_method ? labels[td.sales_method] || td.sales_method : "-"}</span>;
      }
      
      case "ticketing_method": {
        const td = order.ticket_data || {};
        const labels = {
          paper: "纸票",
          electronic: "电子票",
          ticket_number: "发券番号",
        };
        return <span className="text-xs text-gray-700">{td.ticketing_method ? labels[td.ticketing_method] || td.ticketing_method : "-"}</span>;
      }
      
      case "account_count": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.account_count || 1}</span>;
      }

      case "submit_date":
        return <span className="text-xs text-gray-700">{order.created_date ? new Date(order.created_date).toLocaleDateString("zh-CN") : "-"}</span>;

      case "sales_start_time": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.sales_start_time ? new Date(td.sales_start_time).toLocaleDateString("zh-CN") : "-"}</span>;
      }

      case "sales_end_time": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.sales_end_time ? new Date(td.sales_end_time).toLocaleDateString("zh-CN") : "-"}</span>;
      }

      case "sales_period": {
        const td = order.ticket_data || {};
        const start = td.sales_start_time ? new Date(td.sales_start_time).toLocaleDateString("zh-CN") : null;
        const end = td.sales_end_time ? new Date(td.sales_end_time).toLocaleDateString("zh-CN") : null;
        if (!start && !end) return <span className="text-xs text-gray-400">-</span>;
        return <span className="text-xs text-gray-700 whitespace-nowrap">{start || "?"} ~ {end || "?"}</span>;
      }

      case "lottery_result_time": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.lottery_result_time ? new Date(td.lottery_result_time).toLocaleDateString("zh-CN") : "-"}</span>;
      }

      case "additional_fee_jpy": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.additional_fee_jpy ? `${Number(td.additional_fee_jpy).toLocaleString()} yen` : "-"}</span>;
      }

      case "lottery_win_bonus_jpy": {
        const td = order.ticket_data || {};
        return <span className="text-xs text-gray-700">{td.lottery_win_bonus_jpy ? `${Number(td.lottery_win_bonus_jpy).toLocaleString()} yen` : "-"}</span>;
      }

      case "purchase_link": {
        const td = order.ticket_data || {};
        const url = td.purchase_link;
        if (!url) return <span className="text-xs text-gray-400">-</span>;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline max-w-[160px] truncate">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{url}</span>
          </a>
        );
      }

      case "ticket_image_urls": {
        const urls = order.ticket_image_urls || [];
        if (!urls.length) return <span className="text-xs text-gray-400">-</span>;
        const w = col.imageWidth || 40;
        return (
          <div className="flex gap-1 flex-wrap">
            {urls.slice(0, 3).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <img src={url} alt="" style={{ width: w, height: w }} className="rounded object-cover border border-gray-200 flex-shrink-0" />
              </a>
            ))}
          </div>
        );
      }

      case "payment_method": {
        const METHOD_LABELS = {
          alipay: "支付宝", wechatpay: "微信支付", paypay: "PayPay",
          paypal: "PayPal", credit_card: "信用卡", bank_transfer: "银行转账",
          credit: "记账", other: "其它",
        };
        const m = order.payment_method;
        return <span className="text-xs text-gray-700">{m ? (METHOD_LABELS[m] || m) : "-"}</span>;
      }

      default:
        return <span className="text-xs text-gray-400">-</span>;
    }
  },

  /**
   * 票务订单数据过滤
   */
  filterData: (orders, filters) => {
    const { statusFilter, search, userProfileMap, showArchived } = filters;
    
    return orders.filter(o => {
      if (showArchived ? !o.is_archived : !!o.is_archived) return false;
      
      const matchStatus = statusFilter === "all" || o.ticket_status === statusFilter;
      const q = search.toLowerCase();
      const displayName = (userProfileMap[o.user_email]?.display_name || o.user_name || "").toLowerCase();
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
   * 获取详情弹窗组件
   */
  getDetailModal: () => null,
};