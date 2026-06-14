# 订单类型注册中心

## 架构说明

订单类型注册中心是一个插件化的架构设计，用于管理不同类型的订单（实物、票务、团购等）。

### 核心原则

1. **AdminOrders 只负责调用控制器** - 不包含任何业务判断逻辑
2. **每个订单类型实现统一的接口协议** - 确保行为一致性
3. **新增订单类型零侵入** - 只需添加新控制器并注册

## 文件结构

```
src/
├── lib/
│   └── orderRegistry.js              # 核心注册中心
├── components/
│   └── orders/
│       └── controllers/
│           ├── index.js              # 自动注册入口
│           ├── PhysicalOrderController.js  # 实物订单控制器
│           ├── TicketOrderController.js    # 票务订单控制器
│           └── OrderRegistryTest.jsx       # 测试组件
```

## 控制器接口协议

每个订单类型控制器必须实现以下方法：

```javascript
const ExampleController = {
  // 基础信息
  getLabel: () => "订单类型名称",
  getIcon: () => IconComponent,
  
  // 表格列配置
  getColumnConfig: () => [...],
  
  // 单元格渲染
  renderCell: (order, column, helpers) => JSX.Element,
  
  // 数据过滤
  filterData: (orders, filters) => filteredOrders,
  
  // 详情弹窗（可选）
  getDetailModal: (order, onClose) => JSX.Element,
};
```

## 注册新订单类型

### 步骤 1：创建控制器文件

```javascript
// components/orders/controllers/GroupBuyOrderController.js
export const GroupBuyOrderController = {
  getLabel: () => "团购订单",
  getIcon: () => Users,
  getColumnConfig: () => [...],
  renderCell: (order, col, helpers) => {...},
  filterData: (orders, filters) => {...},
};
```

### 步骤 2：在 index.js 中注册

```javascript
// components/orders/controllers/index.js
import { GroupBuyOrderController } from './GroupBuyOrderController';

export function initializeOrderControllers() {
  orderRegistry.register('physical', PhysicalOrderController);
  orderRegistry.register('ticket', TicketOrderController);
  orderRegistry.register('group_buy', GroupBuyOrderController); // 新增
}
```

### 步骤 3：在 AdminOrders 中使用

```javascript
// pages/AdminOrders.js
import { orderRegistry } from '@/lib/orderRegistry';

const tabs = orderRegistry.getTabs();
// 自动渲染所有已注册的订单类型标签
```

## 测试

访问 `/:locale/OrderRegistryTest` 页面测试注册中心是否正常工作。

测试项目包括：
- ✅ 控制器是否正确注册
- ✅ 控制器方法是否可调用
- ✅ 表格列配置是否正常返回
- ✅ 数据过滤功能是否正常

## 迁移计划

### 阶段 1：构建抽象层 ✅ 已完成
- [x] 创建 orderRegistry.js
- [x] 创建 PhysicalOrderController
- [x] 创建 TicketOrderController
- [x] 创建测试组件

### 阶段 2：AdminOrders 瘦身（下一步）
- [ ] 在 AdminOrders 中导入注册中心
- [ ] 将 TabsContent 替换为通用表格组件
- [ ] 移除硬编码的列定义和 CellValue
- [ ] 将票务 Tab 改为控制器模式

### 阶段 3：未来扩展
- [ ] 添加团购订单控制器
- [ ] 添加定制订单控制器
- [ ] 实现统一的详情弹窗系统

## 优势

1. **高度可扩展** - 新增订单类型只需写一个新组件
2. **职责清晰** - 每种订单类型的逻辑彻底隔离
3. **开发效率高** - 可分工处理不同类型订单
4. **零回归风险** - 修改票务不影响实物订单