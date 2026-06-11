# 报表系统使用指南

## 📖 快速开始

### 1. 查询报表数据

```javascript
import { base44 } from "@/api/base44Client";

// 基础查询
const response = await base44.functions.invoke('getReportData', {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    dimension: 'order_status',      // 分析维度
    granularity: 'day',             // 时间粒度
});

console.log(response.data);
```

### 2. 高级查询选项

```javascript
// 带筛选条件
const response = await base44.functions.invoke('getReportData', {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    dimension: 'shipping_method',
    granularity: 'week',
    filters: {
        order_status: ['paid', 'shipped'],
        shipping_method: ['EMS', 'DHL']
    }
});

// 带同比分析
const response = await base44.functions.invoke('getReportData', {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    dimension: 'order_status',
    granularity: 'day',
    compare: 'yoy'  // yoy=同比，mom=环比
});
```

### 3. 可用维度

- `order_status` - 订单状态
- `payment_status` - 支付状态
- `shipping_method` - 运输方式
- `country` / `destination_country` - 目的地国家
- `online_store_tag` - 网店标签
- `payment_method` - 支付方式
- `is_refunded` - 是否退款
- `item_size_title` - 物品尺寸
- `user_email` - 用户邮箱
- `addon_type` - 增值服务类型
- `transit_location` - 中转地

### 4. 时间粒度

- `day` - 按天
- `week` - 按周
- `month` - 按月
- `quarter` - 按季度
- `year` - 按年

## 📊 返回数据结构

```javascript
{
  success: true,
  data: {
    summary: {
      total_orders: 150,
      total_customers: 45,
      order_stage_payment_jpy: 1500000,
      goods_cost_jpy: 1200000,
      service_fee_revenue_jpy: 150000,
      order_stage_profit_jpy: 300000,
      shipping_stage_income_jpy: 200000,
      shipping_stage_profit_jpy: 150000,
      total_profit_jpy: 450000,
      // ... 更多指标
    },
    byDimension: {
      "paid": { order_count: 100, total_profit_jpy: 200000, ... },
      "shipped": { order_count: 50, total_profit_jpy: 100000, ... }
    },
    timeSeries: [
      { period: "2026-06-01", order_count: 5, revenue_jpy: 50000, ... },
      { period: "2026-06-02", order_count: 8, revenue_jpy: 80000, ... }
    ],
    topCustomers: [
      { email: "user@example.com", revenue_jpy: 500000, order_count: 10 }
    ],
    compareSummary: { ... },  // 对比期数据（如果指定了 compare）
    dataQualityWarnings: [...]  // 数据质量警告
  },
  date_range: { startDate: "2026-06-01", endDate: "2026-06-30" },
  dimension: "order_status",
  granularity: "day"
}
```

## 🔒 安全限制

### 1. 查询范围限制
- 最大查询范围：**365 天**
- 超过限制将返回错误

### 2. 白名单校验
- 维度必须在白名单内
- 筛选条件值必须在白名单内
- 时间粒度必须在允许范围内

### 3. 权限要求
仅以下角色可访问：
- `admin`
- `platform_admin`
- `tenant_admin`
- `staff`

### 4. 租户隔离
- 自动从登录用户获取租户上下文
- 不信任客户端传入的 `tenant_id`
- 平台管理员可指定 `tenant_id` 查询其他租户

## ⚡ 性能优化

### 汇总数据使用
- **查询范围 ≤ 7 天**: 使用原始订单/发货池数据
- **查询范围 > 7 天**: 优先使用 DailyReportSummary 汇总数据
- **性能提升**: 10-100 倍（取决于数据量）

### 数据更新频率
- **汇总数据**: T+1 更新（次日凌晨 2 点东京时间）
- **实时数据**: 查询时从原始数据计算

## 📈 监控和日志

### 定时任务日志
- 路径：Dashboard → Code → Functions → generateDailyReportSummary
- 查看每日汇总任务执行情况

### 查询日志
- 路径：Dashboard → Code → Functions → getReportData
- 查看报表查询性能和错误

## 🛠️ 常见问题

### Q: 为什么查询结果中没有当天的数据？
A: 汇总数据是 T+1 更新的，当天的数据会在次日凌晨 2 点聚合。如果需要实时数据，请使用较短的查询范围（≤7 天），系统会自动使用原始数据计算。

### Q: 如何手动触发生成日报？
A: 调用 `generateDailyReportSummary` 函数：
```javascript
const response = await base44.functions.invoke('generateDailyReportSummary', {});
```

### Q: 查询返回"无效的筛选值"错误？
A: 筛选条件必须在白名单内。例如 `order_status` 只能使用预定义的状态值：
- `pending_confirmation`, `payment_pending`, `paid`, `pending_purchase`, `purchased`, `in_warehouse`, `in_storage`, `notified_shipment`, `ready_to_ship`, `shipped`, `transit_shipped`, `delivered`, `cancelled`

### Q: 如何查看某个租户的报表？
A: 只有平台管理员可以查看其他租户的报表：
```javascript
const response = await base44.functions.invoke('getReportData', {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    tenant_id: 'TARGET_TENANT_ID',  // 仅平台管理员可用
    dimension: 'order_status',
    granularity: 'day'
});
```

## 📞 技术支持

如遇到问题，请查看：
1. 函数日志（Dashboard → Code → Functions）
2. 错误消息详情
3. 数据质量警告（返回数据中的 `dataQualityWarnings` 字段）

---

**文档版本**: v1.0  
**更新日期**: 2026-06-11  
**状态**: 生产就绪 ✅