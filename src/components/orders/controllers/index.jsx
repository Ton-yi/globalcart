/**
 * 订单控制器自动注册
 * 
 * 在应用启动时自动注册所有订单类型控制器
 */

import { orderRegistry } from "@/lib/orderRegistry";
import { PhysicalOrderController } from "@/components/orders/controllers/PhysicalOrderController";
import { TicketOrderController } from "@/components/orders/controllers/TicketOrderController";

// 自动注册所有控制器
orderRegistry.register('physical', PhysicalOrderController);
orderRegistry.register('ticket', TicketOrderController);

// 未来新增订单类型只需添加一行：
// import { GroupBuyOrderController } from "@/components/orders/controllers/GroupBuyOrderController";
// orderRegistry.register('group_buy', GroupBuyOrderController);

export { orderRegistry };