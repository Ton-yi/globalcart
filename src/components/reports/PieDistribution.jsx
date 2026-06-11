import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'];

export default function PieDistribution({ title, data, nameKey = "name", valueKey = "value", height = 260 }) {
    if (!data || data.length === 0) return (
        <Card>
            <CardHeader><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">暂无数据</CardContent>
        </Card>
    );

    const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
    const withPercent = data.map(d => ({
        ...d,
        pct: total > 0 ? ((d[valueKey] / total) * 100).toFixed(1) : 0
    }));

    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie data={withPercent} dataKey={valueKey} nameKey={nameKey}
                            cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                            paddingAngle={2}>
                            {withPercent.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`${v} (${withPercent.find(d => d[nameKey] === name)?.pct}%)`, name]} />
                        <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}