/**
 * WidgetCatalog — Widget 类型注册表和字段元数据
 */

export const WIDGET_CATALOG = [
    {
        type: 'metric_card',
        label: '指标卡片',
        description: '展示单个关键数字指标，支持趋势对比。',
        defaultConfig: { field: 'revenue_jpy', isCount: false },
    },
    {
        type: 'trend_line',
        label: '折线趋势图',
        description: '展示多条时间序列折线，适合对比多指标走势。',
        defaultConfig: { lines: [{ key: 'revenue_jpy', name: '收入', color: '#3b82f6' }] },
    },
    {
        type: 'trend_bar',
        label: '柱状趋势图',
        description: '按时间粒度展示柱状图，适合订单量等离散数据。',
        defaultConfig: { bars: [{ key: 'order_count', name: '订单数', color: '#6366f1' }] },
    },
    {
        type: 'pie_chart',
        label: '饼图分布',
        description: '展示订单状态、支付方式等分布比例。',
        defaultConfig: { dataSource: 'status_counts' },  // 与 PIE_SOURCES[0].value 保持一致
    },
    {
        type: 'dimension_table',
        label: '维度明细表',
        description: '按当前维度分组展示财务明细（含收入/利润/退款）。',
        defaultConfig: {},
    },
];

// summary 字段直接映射到后端 calcSummary 返回的实际字段名
export const METRIC_FIELDS = [
    { value: 'order_stage_payment_jpy',   label: '下单收入 (JPY)',       isCount: false },
    { value: 'shipping_stage_income_jpy', label: '发货收入 (JPY)',       isCount: false },
    { value: 'total_profit_jpy',          label: '总利润 (JPY)',         isCount: false },
    { value: 'order_stage_profit_jpy',    label: '下单利润 (JPY)',       isCount: false },
    { value: 'shipping_stage_profit_jpy', label: '发货利润 (JPY)',       isCount: false },
    { value: 'service_fee_revenue_jpy',   label: '服务费收入 (JPY)',     isCount: false },
    { value: 'addon_revenue_jpy',         label: '增值服务收入 (JPY)',   isCount: false },
    { value: 'refund_amount_jpy',         label: '退款合计 (JPY)',       isCount: false },
    { value: 'goods_cost_jpy',            label: '商品成本 (JPY)',       isCount: false },
    { value: 'total_orders',             label: '订单总数',              isCount: true  },
    { value: 'total_customers',          label: '活跃客户数',            isCount: true  },
    { value: 'new_customers',            label: '新客户数',              isCount: true  },
    { value: 'avg_order_value_jpy',      label: '平均订单金额 (JPY)',    isCount: false },
    { value: 'pending_payment_count',    label: '待付款订单数',          isCount: true  },
    { value: 'pending_purchase_count',   label: '待采购订单数',          isCount: true  },
    { value: 'pending_ship_count',       label: '待发货订单数',          isCount: true  },
    { value: 'avg_ship_days',            label: '平均发货天数',          isCount: false, raw: true },
];

// timeSeries 字段映射到后端 buildTimeSeries 返回的实际字段名
export const TIME_SERIES_FIELDS = [
    { value: 'revenue_jpy',          label: '收入 (JPY)'       },
    { value: 'profit_jpy',           label: '利润 (JPY)'       },
    { value: 'service_fee_jpy',      label: '服务费 (JPY)'     },
    { value: 'shipping_income_jpy',  label: '运费收入 (JPY)'   },
    { value: 'addon_revenue_jpy',    label: '增值服务 (JPY)'   },
    { value: 'order_count',          label: '订单数'           },
    { value: 'refund_jpy',           label: '退款 (JPY)'       },
];

// pie 数据源：summary 内的对象字段 或 reportData 顶层字段
// from: 'summary' | 'root'  表示数据在哪个层级
export const PIE_SOURCES = [
    { value: 'status_counts',              label: '订单状态分布',   from: 'summary' },
    { value: 'country_distribution',       label: '目的地国家分布', from: 'summary' },
    { value: 'shipping_method_distribution', label: '运输方式分布', from: 'summary' },
    { value: 'transit_location_distribution', label: '中转地分布', from: 'summary' },
    { value: 'addon_distribution',         label: '增值服务分布',   from: 'summary' },
    { value: 'storeTagCounts',             label: '来源店铺分布',   from: 'root'    },
];

export const COLOR_OPTIONS = [
    { value: '',                   label: '默认'   },
    { value: 'text-green-600',     label: '绿色'   },
    { value: 'text-blue-600',      label: '蓝色'   },
    { value: 'text-red-600',       label: '红色'   },
    { value: 'text-yellow-600',    label: '黄色'   },
    { value: 'text-purple-600',    label: '紫色'   },
];