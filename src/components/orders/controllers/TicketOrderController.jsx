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

import { Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const TicketOrderController = {
  getLabel: () => "票务订单",
  getIcon: () => Ticket,

  /**
   * 获取表格列配置（票务订单简化视图）
   */
  getColumnConfig: () => {
    return [
      { key: "order_number", label: "订单号", defaultVisible: true, sortable: true },
      { key: "user_name", label: "用户名", defaultVisible: true, sortable: true },
      { key: "product_name", label: "演出名称", defaultVisible: true, sortable: true },
      { key: "ticket_prepaid_total_jpy", label: "预付总额", defaultVisible: true, sortable: true },
      { key: "ticket_status", label: "票务状态", defaultVisible: true, sortable: true },
      { key: "performance_datetime", label: "演出时间", defaultVisible: false, sortable: true },
      { key: "prefecture", label: "都道府县", defaultVisible: false, sortable: true },
      { key: "sales_method", label: "销售方式", defaultVisible: false, sortable: true },
      { key: "ticketing_method", label: "发券方式", defaultVisible: false, sortable: true },
      { key: "account_count", label: "账户数", defaultVisible: false, sortable: true },
      { key: "submit_date", label: "提交日", defaultVisible: false, sortable: true },
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
      
      default:
        return "-";
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