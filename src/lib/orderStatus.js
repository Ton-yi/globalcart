// Central order status definitions
// Admin and user see different labels for some statuses

export const ORDER_STATUS_CONFIG = {
  pending_confirmation: {
    admin: "后付款待确认",
    user: "已提交",
    adminColor: "bg-purple-100 text-purple-700",
    userColor: "bg-blue-100 text-blue-700",
  },
  awaiting_reply: {
    admin: "待回复",
    user: "已回复",
    adminColor: "bg-orange-100 text-orange-700",
    userColor: "bg-yellow-100 text-yellow-700",
  },
  admin_replied: {
    admin: "已回复",
    user: "待回复",
    adminColor: "bg-yellow-100 text-yellow-700",
    userColor: "bg-orange-100 text-orange-700",
  },
  payment_pending: {
    admin: "待付款",
    user: "待付款",
    adminColor: "bg-orange-100 text-orange-700",
    userColor: "bg-orange-100 text-orange-700",
  },
  paid: {
    admin: "待下单",
    user: "已付款",
    adminColor: "bg-indigo-100 text-indigo-700",
    userColor: "bg-green-100 text-green-700",
  },
  pending_purchase: {
    admin: "待下单",
    user: "已付款",
    adminColor: "bg-indigo-100 text-indigo-700",
    userColor: "bg-green-100 text-green-700",
  },
  purchased: {
    admin: "已下单",
    user: "已下单",
    adminColor: "bg-blue-100 text-blue-800",
    userColor: "bg-blue-100 text-blue-800",
  },
  in_warehouse: {
    admin: "已入库",
    user: "已入库",
    adminColor: "bg-teal-100 text-teal-700",
    userColor: "bg-teal-100 text-teal-700",
  },
  notified_shipment: {
    admin: "待出货",
    user: "已通知出货",
    adminColor: "bg-cyan-100 text-cyan-700",
    userColor: "bg-cyan-100 text-cyan-700",
  },
  shipping_fee_pending: {
    admin: "已付运费",
    user: "待发货",
    adminColor: "bg-lime-100 text-lime-700",
    userColor: "bg-amber-100 text-amber-700",
  },
  ready_to_ship: {
    admin: "已付运费",
    user: "待发货",
    adminColor: "bg-lime-100 text-lime-700",
    userColor: "bg-amber-100 text-amber-700",
  },
  shipped: {
    admin: "已发出",
    user: "已发出",
    adminColor: "bg-green-100 text-green-700",
    userColor: "bg-green-100 text-green-700",
  },
  delivered: {
    admin: "已收货",
    user: "已收货",
    adminColor: "bg-emerald-100 text-emerald-700",
    userColor: "bg-emerald-100 text-emerald-700",
  },
  cancelled: {
    admin: "已取消",
    user: "已取消",
    adminColor: "bg-red-100 text-red-700",
    userColor: "bg-red-100 text-red-700",
  },
};

export function getStatusLabel(status, role = "user") {
  return ORDER_STATUS_CONFIG[status]?.[role] || status;
}

export function getStatusColor(status, role = "user") {
  const key = role === "admin" ? "adminColor" : "userColor";
  return ORDER_STATUS_CONFIG[status]?.[key] || "bg-gray-100 text-gray-600";
}

// Which statuses show a "pay" button for the user
export const USER_CAN_PAY_STATUSES = ["payment_pending"];

// Which statuses show "notify shipment" for user
export const USER_CAN_NOTIFY_SHIP_STATUSES = ["in_warehouse"];

// Completed orders
export const COMPLETED_STATUSES = ["delivered"];

// Active (non-terminal) statuses
export const ACTIVE_STATUSES = [
  "pending_confirmation", "awaiting_reply", "payment_pending",
  "paid", "pending_purchase", "purchased", "in_warehouse",
  "notified_shipment", "shipping_fee_pending", "ready_to_ship", "shipped"
];