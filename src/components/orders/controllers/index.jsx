/**
 * 订单控制器初始化
 * 
 * 在应用启动时注册所有订单类型的控制器
 */

import { orderRegistry } from '@/lib/orderRegistry';
import { PhysicalOrderController } from '@/components/orders/controllers/PhysicalOrderController';
import { TicketOrderController } from '@/components/orders/controllers/TicketOrderController';

/**
 * 初始化订单注册中心
 * 在应用启动时调用一次即可
 */
export function initializeOrderControllers() {
  try {
    // 注册实物订单控制器
    orderRegistry.register('physical', PhysicalOrderController);
    
    // 注册票务订单控制器
    orderRegistry.register('ticket', TicketOrderController);
    
    console.log('[OrderControllers] All controllers initialized successfully');
    console.log('[OrderControllers] Registered types:', orderRegistry.getTypes());
  } catch (error) {
    console.error('[OrderControllers] Failed to initialize:', error);
    throw error;
  }
}

// 自动初始化（当模块被导入时）
if (typeof window !== 'undefined') {
  initializeOrderControllers();
}