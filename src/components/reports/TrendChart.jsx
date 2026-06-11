import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function formatCurrencyShort(v) {
    if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`;
    if (v >= 1000) return `¥${(v / 1000).toFixed(1)}千`;
    return `¥${v}`;
}

export function TrendLineChart({ title, data, lines, height = 260 }) {
    if (!data || data.length === 0) return (
        <Card>
            <CardHeader><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">暂无数据</CardContent>
        </Card>
    );
    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrencyShort} width={60} />
                        <Tooltip formatter={(v, name) => [`¥${v.toLocaleString('ja-JP')}`, name]} />
                        <Legend />
                        {lines.map(l => (
                            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                                stroke={l.color} strokeWidth={2} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

export function TrendBarChart({ title, data, bars, height = 260 }) {
    if (!data || data.length === 0) return (
        <Card>
            <CardHeader><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">暂无数据</CardContent>
        </Card>
    );
    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={40} />
                        <Tooltip />
                        <Legend />
                        {bars.map(b => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} />)}
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}