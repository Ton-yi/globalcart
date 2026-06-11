import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "./MetricCard";

const ORDER_STATUS_LABELS = {
    pending_confirmation: '待确认', payment_pending: '待付款', paid: '已付款',
    pending_purchase: '待采购', purchased: '已采购', in_warehouse: '已入库',
    in_storage: '仓储中', notified_shipment: '已通知发货', ready_to_ship: '待发货',
    shipped: '已发货', transit_shipped: '中转已发', delivered: '已送达', cancelled: '已取消', unknown: '未知'
};

export default function DimensionTable({ title, data, dimension }) {
    const entries = Object.entries(data || {})
        .sort((a, b) => (b[1].total_profit_jpy || 0) - (a[1].total_profit_jpy || 0));

    const labelFor = (key) => {
        if (dimension === 'order_status') return ORDER_STATUS_LABELS[key] || key;
        return key;
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{title || '维度分析'}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">分类</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">订单数</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">收入</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">退款</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">下单利润</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">运费利润</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">总利润</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(([key, d]) => (
                                <tr key={key} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="py-2 px-3 font-medium">{labelFor(key)}</td>
                                    <td className="text-right py-2 px-3">{d.order_count || 0}</td>
                                    <td className="text-right py-2 px-3">{formatCurrency(d.order_stage_payment_jpy)}</td>
                                    <td className="text-right py-2 px-3 text-red-500">{d.refund_amount_jpy > 0 ? `-${formatCurrency(d.refund_amount_jpy)}` : '—'}</td>
                                    <td className="text-right py-2 px-3">
                                        <span className={(d.order_stage_profit_jpy || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatCurrency(d.order_stage_profit_jpy)}
                                        </span>
                                    </td>
                                    <td className="text-right py-2 px-3">
                                        <span className={(d.shipping_stage_profit_jpy || 0) >= 0 ? 'text-green-600' : 'text-red-500'}>
                                            {(d.shipping_stage_profit_jpy || 0) !== 0 ? formatCurrency(d.shipping_stage_profit_jpy) : '—'}
                                        </span>
                                    </td>
                                    <td className="text-right py-2 px-3">
                                        <span className={(d.total_profit_jpy || 0) >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                            {formatCurrency(d.total_profit_jpy)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}