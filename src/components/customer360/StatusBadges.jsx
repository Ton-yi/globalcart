// Order Status Badge Component
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }) {
  const statusConfig = {
    pending_confirmation: { label: "待确认", color: "bg-gray-100 text-gray-700" },
    payment_pending: { label: "待付款", color: "bg-yellow-100 text-yellow-700" },
    paid: { label: "已付款", color: "bg-green-100 text-green-700" },
    pending_purchase: { label: "待采购", color: "bg-blue-100 text-blue-700" },
    purchased: { label: "已采购", color: "bg-indigo-100 text-indigo-700" },
    in_warehouse: { label: "已入库", color: "bg-purple-100 text-purple-700" },
    in_storage: { label: "仓储中", color: "bg-orange-100 text-orange-700" },
    ready_to_ship: { label: "待发货", color: "bg-red-100 text-red-700" },
    shipped: { label: "已发货", color: "bg-blue-100 text-blue-700" },
    delivered: { label: "已送达", color: "bg-green-100 text-green-700" },
    cancelled: { label: "已取消", color: "bg-gray-100 text-gray-500" },
    expired: { label: "已超期", color: "bg-red-100 text-red-700" },
  };
  
  const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-700" };
  return <Badge className={config.color}>{config.label}</Badge>;
}

// Payment Status Badge Component
export function PaymentStatusBadge({ status }) {
  const statusConfig = {
    pending: { label: "待处理", color: "bg-gray-100 text-gray-700" },
    awaiting_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-700" },
    awaiting_confirmation: { label: "待确认", color: "bg-blue-100 text-blue-700" },
    paid: { label: "已付款", color: "bg-green-100 text-green-700" },
    underpaid: { label: "未付足", color: "bg-orange-100 text-orange-700" },
    overpaid: { label: "多付款", color: "bg-purple-100 text-purple-700" },
    confirmed: { label: "已确认", color: "bg-green-100 text-green-700" },
  };
  
  const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-700" };
  return <Badge className={config.color}>{config.label}</Badge>;
}