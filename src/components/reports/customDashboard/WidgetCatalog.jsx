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
        defaultConfig: { dataSource: 'status_counts' },
    },
    {
        type: 'dimension_table',
        label: '维度明细表',
        description: '按当前维度分组展示财务明细（含收入/利润/退款）。',
        defaultConfig: {},
    },
];

export const METRIC_FIELDS = [
    { value: 'revenue_jpy',           label: '总收入 (JPY)',         isCount: false },
    { value: 'gross_profit_jpy',      label: '毛利润 (JPY)',         isCount: false },
    { value: 'service_fee_income_jpy',label: '服务费收入 (JPY)',     isCount: false },
    { value: 'shipping_income_jpy',   label: '运费收入 (JPY)',       isCount: false },
    { value: 'refund_jpy',            label: '退款合计 (JPY)',       isCount: false },
    { value: 'order_count',           label: '订单总数',             isCount: true  },
    { value: 'new_customer_count',    label: '新客户数',             isCount: true  },
    { value: 'active_customer_count', label: '活跃客户数',           isCount: true  },
    { value: 'avg_order_value_jpy',   label: '平均订单金额 (JPY)',   isCount: false },
    { value: 'shipped_count',         label: '已发货数',             isCount: true  },
    { value: 'delivered_count',       label: '已送达数',             isCount: true  },
    { value: 'cancelled_count',       label: '已取消数',             isCount: true  },
    { value: 'avg_fulfillment_days',  label: '平均履约天数',         isCount: false, raw: true },
];

export const TIME_SERIES_FIELDS = [
    { value: 'revenue_jpy',            label: '收入 (JPY)'       },
    { value: 'gross_profit_jpy',       label: '毛利润 (JPY)'     },
    { value: 'service_fee_income_jpy', label: '服务费收入 (JPY)' },
    { value: 'shipping_income_jpy',    label: '运费收入 (JPY)'   },
    { value: 'order_count',            label: '订单数'           },
    { value: 'new_customer_count',     label: '新客户数'         },
    { value: 'shipped_count',          label: '已发货数'         },
];

export const PIE_SOURCES = [
    { value: 'status_counts',          label: '订单状态分布'   },
    { value: 'payment_method_counts',  label: '支付方式分布'   },
    { value: 'store_tag_counts',       label: '来源店铺分布'   },
];

export const COLOR_OPTIONS = [
    { value: '',                   label: '默认'   },
    { value: 'text-green-600',     label: '绿色'   },
    { value: 'text-blue-600',      label: '蓝色'   },
    { value: 'text-red-600',       label: '红色'   },
    { value: 'text-yellow-600',    label: '黄色'   },
    { value: 'text-purple-600',    label: '紫色'   },
];