/**
 * 订单类型注册中心
 * 
 * 架构原则：
 * 1. AdminOrders 只负责调用控制器的方法，不包含任何业务判断
 * 2. 每个订单类型实现统一的接口协议
 * 3. 新增订单类型只需添加新控制器并注册，无需修改 AdminOrders
 */

import { Package, Ticket } from "lucide-react";

// 控制器存储映射
const controllers = {};

export const orderRegistry = {
  /**
   * 注册订单类型控制器
   * @param {string} type - 订单类型标识 (e.g., 'physical', 'ticket', 'group_buy')
   * @param {object} controller - 控制器对象，必须实现接口方法
   */
  register(type, controller) {
    if (!type || !controller) {
      throw new Error('OrderRegistry: type and controller are required');
    }
    controllers[type] = controller;
    console.log(`[OrderRegistry] Registered controller for type: ${type}`);
  },

  /**
   * 获取订单类型控制器
   * @param {string} type - 订单类型标识
   * @returns {object} 控制器对象
   */
  get(type) {
    return controllers[type] || controllers['physical'];
  },

  /**
   * 获取所有已注册的订单类型标签配置
   * @returns {array} [{ type, label, icon }]
   */
  getTabs() {
    return Object.entries(controllers).map(([type, controller]) => ({
      type,
      label: controller.getLabel?.() || type,
      icon: controller.getIcon?.() || Package,
    }));
  },

  /**
   * 获取所有已注册的订单类型
   * @returns {array} [type1, type2, ...]
   */
  getTypes() {
    return Object.keys(controllers);
  },
};

/**
 * 控制器接口协议（供参考）
 * 
 * const ExampleController = {
 *   // 基础信息
 *   getLabel: () => "实物订单",
 *   getIcon: () => Package,
 *   
 *   // 表格列配置
 *   getColumnConfig: (options) => [
 *     { key: "order_number", label: "订单号", defaultVisible: true, sortable: true },
 *     ...
 *   ],
 *   
 *   // 单元格渲染
 *   renderCell: (order, column, helpers) => JSX.Element,
 *   
 *   // 详情弹窗
 *   getDetailModal: (order, onClose) => JSX.Element,
 *   
 *   // 数据过滤
 *   filterData: (orders, filters) => filteredOrders,
 *   
 *   // 快捷操作（可选）
 *   getQuickActions: (order, permissions) => [...],
 * };
 */