import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

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

export default function ReportFilters({
    startDate, endDate, dimension, granularity, compare,
    onStartDate, onEndDate, onDimension, onGranularity, onCompare,
    showDimension = true,
}) {
    return (
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
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}