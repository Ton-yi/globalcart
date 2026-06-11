# MetricCard 尺寸规格说明

## 概述

`MetricCard` 组件现已支持三种尺寸规格，通过 `size` 属性控制：

- **小卡片（sm）** - 紧凑布局
- **中卡片（md）** - 标准布局（默认）
- **大卡片（lg）** - 突出显示

## 使用方式

```jsx
import MetricCard from "@/components/reports/MetricCard";

// 小卡片
<MetricCard size="sm" title="订单数" value={150} isCount />

// 中卡片（默认）
<MetricCard size="md" title="订单数" value={150} isCount />
<MetricCard title="订单数" value={150} isCount /> {/* 默认 md */}

// 大卡片
<MetricCard size="lg" title="订单数" value={150} isCount />
```

## 尺寸规格对比

### 小卡片（sm）

**特点**：
- 标题字号：`text-xs`（12px）
- 数值字号：`text-lg`（20px）
- 图标大小：`h-3 w-3`
- 副标题字号：`text-[10px]`
- 内边距：`pb-1`

**适用场景**：
- 数据概览页面
- 紧凑布局
- 移动端优先
- 每行显示 4-6 个卡片

**示例**：
```jsx
<MetricCard
  size="sm"
  title="订单总数"
  value={150}
  isCount
  subtitle="昨日：120"
  trend={0.25}
  icon={Package}
/>
```

### 中卡片（md）- 默认

**特点**：
- 标题字号：`text-sm`（14px）
- 数值字号：`text-2xl`（24px）
- 图标大小：`h-4 w-4`
- 副标题字号：`text-xs`
- 内边距：`pb-2`

**适用场景**：
- 标准报表页面
- 大多数业务场景
- 每行显示 3-4 个卡片

**示例**：
```jsx
<MetricCard
  size="md"
  title="总收入"
  value={1500000}
  subtitle="环比 +15%"
  trend={0.15}
  icon={DollarSign}
  description="包含所有订单收入"
/>
```

### 大卡片（lg）

**特点**：
- 标题字号：`text-base`（16px）
- 数值字号：`text-3xl`（30px）
- 图标大小：`h-5 w-5`
- 副标题字号：`text-sm`
- 内边距：`pb-3`

**适用场景**：
- 关键指标突出显示
- 首页总览
- 数据展示
- 每行显示 1-2 个卡片

**示例**：
```jsx
<MetricCard
  size="lg"
  title="本月总利润"
  value={450000}
  subtitle="较上月 +12.5%"
  trend={0.125}
  icon={TrendingUp}
  colorClass="text-green-600"
  description="包含订单利润和发货利润"
/>
```

## 完整属性列表

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 卡片尺寸 |
| `title` | `string` | 必填 | 指标标题 |
| `value` | `number \| string` | 必填 | 指标数值 |
| `icon` | `LucideIcon` | - | 图标组件 |
| `subtitle` | `string` | - | 副标题/趋势说明 |
| `trend` | `number` | - | 趋势值（正数显示向上箭头，负数显示向下箭头） |
| `isCount` | `boolean` | `false` | 是否为计数（不使用货币格式） |
| `raw` | `boolean` | `false` | 是否显示原始值（不格式化） |
| `colorClass` | `string` | - | 数值颜色类名 |
| `description` | `string` | - | 说明文字（显示在 tooltip 中） |

## 尺寸选择建议

### 选择小卡片（sm）当：
- 需要在一屏内展示大量指标
- 移动端用户占比较高
- 作为次要指标的展示
- 需要节省垂直空间

### 选择中卡片（md）当：
- 标准报表页面
- 需要平衡信息密度和可读性
- 不确定选择哪个尺寸时（最安全的选择）

### 选择大卡片（lg）当：
- 突出显示关键业务指标（KPI）
- 首页或仪表盘的顶部总览
- 数据展示为主，不需要太多指标
- 需要更强的视觉冲击力

## 响应式布局建议

```jsx
// 小卡片 - 每行 4-6 个
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
  <MetricCard size="sm" ... />
</div>

// 中卡片 - 每行 3-4 个
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  <MetricCard size="md" ... />
</div>

// 大卡片 - 每行 1-2 个
<div className="grid gap-4 md:grid-cols-2">
  <MetricCard size="lg" ... />
</div>
```

## 混合使用示例

在同一页面混合使用不同尺寸，突出重点指标：

```jsx
<div className="space-y-6">
  {/* 关键指标 - 大卡片 */}
  <div className="grid gap-4 md:grid-cols-2">
    <MetricCard size="lg" title="本月总利润" value={450000} ... />
    <MetricCard size="lg" title="年度累计收入" value={15000000} ... />
  </div>

  {/* 详细指标 - 中卡片 */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <MetricCard size="md" title="订单数" value={150} ... />
    <MetricCard size="md" title="客户数" value={45} ... />
    <MetricCard size="md" title="收入" value={1500000} ... />
    <MetricCard size="md" title="利润率" value="32.5%" raw ... />
  </div>

  {/* 次要指标 - 小卡片 */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
    <MetricCard size="sm" title="待付款" value={12} ... />
    <MetricCard size="sm" title="待采购" value={8} ... />
    <MetricCard size="sm" title="待发货" value={5} ... />
    <MetricCard size="sm" title="已完成" value={125} ... />
    <MetricCard size="sm" title="已取消" value={3} ... />
    <MetricCard size="sm" title="退款" value={2} ... />
  </div>
</div>
```

## 演示页面

访问 `/MetricCardSizesDemo` 查看三种尺寸的实际效果对比。

---

**更新日期**: 2026-06-11  
**版本**: v1.0