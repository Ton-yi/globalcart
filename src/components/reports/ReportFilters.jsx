import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

const PRESETS = [
    { label: "今日", getValue: () => { const d = new Date().toISOString().split('T')[0]; return [d, d]; } },
    { label: "本周", getValue: () => {
        const today = new Date();
        const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
        return [mon.toISOString().split('T')[0], today.toISOString().split('T')[0]];
    }},
    { label: "本月", getValue: () => {
        const today = new Date();
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return [first.toISOString().split('T')[0], today.toISOString().split('T')[0]];
    }},
    { label: "近30天", getValue: () => {
        const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 29);
        return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
    }},
    { label: "近90天", getValue: () => {
        const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 89);
        return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
    }},
    { label: "今年", getValue: () => {
        const today = new Date();
        return [`${today.getFullYear()}-01-01`, today.toISOString().split('T')[0]];
    }},
];

export default function ReportFilters({ startDate, endDate, dimension, granularity, onStartDate, onEndDate, onDimension, onGranularity, showDimension = true }) {
    return (
        <Card>
            <CardContent className="pt-4">
                <div className="flex flex-wrap items-end gap-3">
                    {/* 快捷预设 */}
                    <div className="flex gap-1 flex-wrap">
                        {PRESETS.map(p => (
                            <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs"
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

                        <Select value={granularity} onValueChange={onGranularity}>
                            <SelectTrigger className="h-8 text-sm w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">按日</SelectItem>
                                <SelectItem value="week">按周</SelectItem>
                                <SelectItem value="month">按月</SelectItem>
                                <SelectItem value="quarter">按季度</SelectItem>
                                <SelectItem value="year">按年</SelectItem>
                            </SelectContent>
                        </Select>

                        {showDimension && (
                            <Select value={dimension} onValueChange={onDimension}>
                                <SelectTrigger className="h-8 text-sm w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="order_status">订单状态</SelectItem>
                                    <SelectItem value="payment_status">支付状态</SelectItem>
                                    <SelectItem value="shipping_method">运输方式</SelectItem>
                                    <SelectItem value="destination_country">目的地国家</SelectItem>
                                    <SelectItem value="online_store_tag">下单网站</SelectItem>
                                    <SelectItem value="payment_method">支付方式</SelectItem>
                                    <SelectItem value="item_size_title">入库尺寸</SelectItem>
                                    <SelectItem value="is_refunded">是否退款</SelectItem>
                                    <SelectItem value="user_email">客户</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}