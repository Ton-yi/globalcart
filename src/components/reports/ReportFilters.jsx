import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const PRESETS = [
    { label: "今日",   getValue: () => { const d = new Date().toISOString().split('T')[0]; return [d, d]; } },
    { label: "本周",   getValue: () => {
        const t = new Date(); const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
        return [mon.toISOString().split('T')[0], t.toISOString().split('T')[0]];
    }},
    { label: "本月",   getValue: () => {
        const t = new Date(); const first = new Date(t.getFullYear(), t.getMonth(), 1);
        return [first.toISOString().split('T')[0], t.toISOString().split('T')[0]];
    }},
    { label: "本季度", getValue: () => {
        const t = new Date(); const q = Math.floor(t.getMonth() / 3);
        const first = new Date(t.getFullYear(), q * 3, 1);
        return [first.toISOString().split('T')[0], t.toISOString().split('T')[0]];
    }},
    { label: "近30天", getValue: () => {
        const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29);
        return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]];
    }},
    { label: "近90天", getValue: () => {
        const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 89);
        return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]];
    }},
    { label: "今年",   getValue: () => {
        const t = new Date();
        return [`${t.getFullYear()}-01-01`, t.toISOString().split('T')[0]];
    }},
    { label: "去年",   getValue: () => {
        const y = new Date().getFullYear() - 1;
        return [`${y}-01-01`, `${y}-12-31`];
    }},
];

const DIMENSIONS = [
    { value: "order_status",        label: "订单状态" },
    { value: "payment_status",      label: "支付状态" },
    { value: "payment_method",      label: "支付方式" },
    { value: "shipping_method",     label: "运输方式" },
    { value: "destination_country", label: "目的地国家" },
    { value: "online_store_tag",    label: "下单网站" },
    { value: "item_size_title",     label: "入库尺寸" },
    { value: "transit_location",    label: "中转地" },
    { value: "addon_type",          label: "增值服务" },
    { value: "currency",            label: "币种" },
    { value: "is_refunded",         label: "是否退款" },
    { value: "user_email",          label: "客户" },
];

// 筛选条件选项（部分常用维度）
const FILTER_OPTIONS = {
    order_status: [
        { value: 'pending_confirmation', label: '待确认' },
        { value: 'payment_pending', label: '待付款' },
        { value: 'paid', label: '已付款' },
        { value: 'pending_purchase', label: '待采购' },
        { value: 'purchased', label: '已采购' },
        { value: 'in_warehouse', label: '已入库' },
        { value: 'ready_to_ship', label: '待发货' },
        { value: 'shipped', label: '已发货' },
        { value: 'delivered', label: '已送达' },
        { value: 'cancelled', label: '已取消' },
    ],
    payment_status: [
        { value: 'pending', label: '待确认' },
        { value: 'awaiting_payment', label: '待付款' },
        { value: 'paid', label: '已付款' },
        { value: 'confirmed', label: '已确认' },
    ],
    shipping_method: [
        { value: 'EMS', label: 'EMS' },
        { value: 'DHL', label: 'DHL' },
        { value: 'FedEx', label: 'FedEx' },
        { value: 'SAL', label: 'SAL' },
        { value: 'surface', label: '海运' },
    ],
    is_refunded: [
        { value: 'true', label: '已退款' },
        { value: 'false', label: '未退款' },
    ],
};

export default function ReportFilters({
    startDate, endDate, dimension, granularity, compare,
    onStartDate, onEndDate, onDimension, onGranularity, onCompare,
    showDimension = true,
    filters = {},
    onFiltersChange,
}) {
    const [showFilters, setShowFilters] = useState(false);
    const availableFilters = FILTER_OPTIONS[dimension] || [];

    const handleFilterToggle = (value, checked) => {
        const current = filters[dimension] || [];
        const updated = checked
            ? [...current, value]
            : current.filter(v => v !== value);
        onFiltersChange?.({ ...filters, [dimension]: updated });
    };

    const clearFilters = () => {
        onFiltersChange?.({});
    };

    const hasActiveFilters = Object.keys(filters).some(k => filters[k]?.length > 0);
    return (
        <div className="space-y-2">
            <Card>
                <CardContent className="pt-4 pb-3">
                    <div className="flex flex-wrap items-end gap-2">
                        {/* 快捷预设 */}
                        <div className="flex gap-1 flex-wrap">
                            {PRESETS.map(p => (
                                <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs px-2"
                                    onClick={() => { const [s, e] = p.getValue(); onStartDate(s); onEndDate(e); }}>
                                    {p.label}
                                </Button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 ml-auto flex-wrap">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center gap-1">
                                <Input type="date" value={startDate} onChange={e => onStartDate(e.target.value)} className="h-8 text-sm w-36" />
                                <span className="text-muted-foreground text-sm">—</span>
                                <Input type="date" value={endDate} onChange={e => onEndDate(e.target.value)} className="h-8 text-sm w-36" />
                            </div>

                            {/* 粒度 */}
                            <Select value={granularity} onValueChange={onGranularity}>
                                <SelectTrigger className="h-8 text-sm w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">按日</SelectItem>
                                    <SelectItem value="week">按周</SelectItem>
                                    <SelectItem value="month">按月</SelectItem>
                                    <SelectItem value="quarter">按季度</SelectItem>
                                    <SelectItem value="year">按年</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* 对比 */}
                            {onCompare && (
                                <Select value={compare || 'none'} onValueChange={v => onCompare(v === 'none' ? null : v)}>
                                    <SelectTrigger className="h-8 text-sm w-28"><SelectValue placeholder="对比" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">不对比</SelectItem>
                                        <SelectItem value="mom">环比</SelectItem>
                                        <SelectItem value="yoy">同比</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}

                            {/* 维度 */}
                            {showDimension && (
                                <Select value={dimension} onValueChange={onDimension}>
                                    <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DIMENSIONS.map(d => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* 筛选按钮 */}
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                                onClick={() => setShowFilters(!showFilters)}>
                                <Filter className="w-3 h-3" />
                                筛选
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                                        {Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)}
                                    </Badge>
                                )}
                            </Button>

                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
                                    <X className="w-3 h-3" />
                                    清除
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 筛选面板 */}
            {showFilters && availableFilters.length > 0 && (
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap gap-3">
                            {availableFilters.map(opt => (
                                <div key={opt.value} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`${dimension}-${opt.value}`}
                                        checked={(filters[dimension] || []).includes(opt.value)}
                                        onCheckedChange={(checked) => handleFilterToggle(opt.value, checked)}
                                    />
                                    <label
                                        htmlFor={`${dimension}-${opt.value}`}
                                        className="text-sm cursor-pointer select-none"
                                    >
                                        {opt.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}