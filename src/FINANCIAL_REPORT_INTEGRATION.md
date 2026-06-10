# 财务报表系统对接说明

## 📊 报表概述

财务报表提供订单利润与运费结算的多维度分析，帮助管理员了解业务盈利状况。

## 🔗 数据源对接

### 1. 订单实体（Order）

**用于计算下单阶段利润**

| 字段名 | 用途 | 优先级 | 说明 |
|--------|------|--------|------|
| `order_stage_payment_jpy` | 下单收入 | 第一优先级 | 用户下单实付金额（JPY） |
| `paid_amount` | 下单收入 | 第二优先级 | 实际支付金额（兼容旧数据） |
| `refund_amount_jpy` | 退款金额 | - | 退款金额（JPY） |
| `estimated_jpy` | 商品成本 | - | 日元货款金额（采购成本） |
| `order_status` | 维度分析 | - | 订单状态维度 |
| `payment_status` | 维度分析 | - | 支付状态维度 |
| `payment_method` | 维度分析 | - | 支付方式维度 |
| `online_store_tag` | 维度分析 | - | 下单网站维度 |
| `pre_shipment.address.country` | 维度分析 | 第一优先级 | 目的地国家（从预发货信息） |
| `destination_country` | 维度分析 | 第二优先级 | 目的地国家（备用字段） |
| `pre_shipment.shipping_method` | 维度分析 | 第一优先级 | 运输方式（从预发货信息） |
| `shipping_method` | 维度分析 | 第二优先级 | 运输方式（备用字段） |

**下单阶段利润计算公式：**
```
下单利润 = order_stage_payment_jpy（或 paid_amount） - refund_amount_jpy - estimated_jpy
```

### 2. 发货池实体（ShippingPool）

**用于计算运费结算利润**

| 字段名 | 用途 | 优先级 | 说明 |
|--------|------|--------|------|
| `shipping_stage_income_jpy` | 运费收入 | 第一优先级 | 用户支付的运费总额（JPY） |
| `shipping_fee_jpy` | 运费收入 | 第二优先级 | 运费金额（兼容旧数据） |
| `actual_international_shipping_cost_jpy` | 运费成本 | - | 实际支付给物流商的国际运费（JPY） |
| `box_charge_jpy_snapshot` | 外箱收入 | 第一优先级 | 向用户收取的外箱费用（JPY） |
| `box_price_jpy` | 外箱收入 | 第二优先级 | 外箱售价（兼容旧数据） |
| `box_actual_cost_jpy_snapshot` | 外箱成本 | - | 外箱实际采购成本（JPY） |
| `order_ids` | 关联订单 | - | 关联的订单 ID 列表 |

**运费结算利润计算公式：**
```
运费利润 = shipping_stage_income_jpy（或 shipping_fee_jpy） - actual_international_shipping_cost_jpy - box_actual_cost_jpy_snapshot
外箱利润 = box_charge_jpy_snapshot（或 box_price_jpy） - box_actual_cost_jpy_snapshot
```

**总利润计算公式：**
```
总利润 = 下单阶段利润 + 运费结算利润
```

## 📈 维度分析

支持以下维度进行利润分析：

1. **订单状态** (`order_status`) - 按订单状态分组
2. **支付状态** (`payment_status`) - 按支付状态分组
3. **支付方式** (`payment_method`) - 按支付方式分组
4. **下单网站** (`online_store_tag`) - 按购物网站分组
5. **目的地国家** (`country`) - 从预发货地址或订单目的地获取
6. **运输方式** (`shipping_method`) - 从预发货信息或订单获取
7. **是否退款** (`is_refunded`) - 按是否有退款金额分组

### 维度值获取逻辑

```javascript
// 国家维度
dimensionValue = order.pre_shipment?.address?.country || order.destination_country || 'unknown'

// 运输方式维度
dimensionValue = order.pre_shipment?.shipping_method || order.shipping_method || 'unknown'

// 是否退款维度
dimensionValue = (order.refund_amount_jpy && order.refund_amount_jpy > 0) ? '已退款' : '未退款'
```

## 🔐 权限控制

- **允许访问的角色**：`admin`、`tenant_admin`、`staff`、`platform_admin`
- **租户隔离**：所有查询都通过 `tenant_id` 进行数据隔离
- **平台管理员**：可以查看所有租户数据（`tenantId = null`）

## 📅 日期范围过滤

- **订单**：按 `submit_date`（下单日期）过滤
- **发货池**：按 `created_date`（创建日期）过滤

## ⚠️ 注意事项

### 1. 数据完整性

- **历史订单**：部分早期订单可能缺少 `order_stage_payment_jpy` 字段，系统会自动使用 `paid_amount` 作为备选
- **外箱成本**：早期发货池可能没有 `box_actual_cost_jpy_snapshot`，需要在发货结算时补录

### 2. 成本数据缺失检测

系统会统计缺少成本数据的订单数量：
```javascript
if (order.estimated_jpy && !order.order_stage_payment_jpy) {
    reportData.summary.orders_missing_cost_data += 1;
}
```

### 3. 发货利润分配

发货池的利润会按关联订单数量比例分配到各个维度：
- 通过 `order_ids` 关联订单
- 从关联订单获取维度值
- 按订单数比例分配发货利润

## 🎯 后端函数

**函数名称**：`getReportData`

**输入参数**：
```json
{
  "startDate": "2026-05-01",
  "endDate": "2026-06-10",
  "dimension": "order_status"
}
```

**返回数据结构**：
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_orders": 10,
      "total_shipping_pools": 5,
      "order_stage_payment_jpy": 10000,
      "refund_amount_jpy": 500,
      "goods_cost_jpy": 5000,
      "order_stage_profit_jpy": 4500,
      "shipping_stage_income_jpy": 3000,
      "actual_international_shipping_cost_jpy": 2000,
      "box_charge_jpy": 1500,
      "box_actual_cost_jpy": 1000,
      "box_profit_jpy": 500,
      "shipping_stage_profit_jpy": 500,
      "total_profit_jpy": 5000,
      "orders_missing_cost_data": 2
    },
    "byDimension": {
      "paid": {
        "order_count": 8,
        "order_stage_profit_jpy": 3600,
        "shipping_stage_profit_jpy": 400,
        "total_profit_jpy": 4000
      }
    }
  },
  "date_range": {
    "startDate": "2026-05-01",
    "endDate": "2026-06-10"
  },
  "dimension": "order_status"
}
```

## 📝 更新日志

- **2026-06-10**：优化字段优先级逻辑，支持多维度分析，改进发货利润分配算法
- **2026-06-10**：添加 `box_profit_jpy` 字段，单独统计外箱利润
- **初始版本**：基础报表功能