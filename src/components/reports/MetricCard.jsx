import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function formatCurrency(amount) {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount || 0);
}

export function formatNumber(n) {
    return new Intl.NumberFormat('ja-JP').format(n || 0);
}

export default function MetricCard({ title, value, icon: Icon, subtitle, trend, isCount = false, colorClass }) {
    const displayValue = isCount ? formatNumber(value) : formatCurrency(value);
    const trendIcon = trend > 0 ? <TrendingUp className="w-3 h-3 text-green-500" />
        : trend < 0 ? <TrendingDown className="w-3 h-3 text-red-500" />
        : trend === 0 ? <Minus className="w-3 h-3 text-gray-400" /> : null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${colorClass || ''}`}>{displayValue}</div>
                {(subtitle || trendIcon) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        {trendIcon}{subtitle}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}