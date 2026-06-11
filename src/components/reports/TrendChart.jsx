import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const tickFmt = v => `¥${(v / 1000).toFixed(0)}k`;
const ttFmt   = v => `¥${Number(v).toLocaleString('ja-JP')}`;

export function TrendLineChart({ title, data = [], lines = [] }) {
    const hasData = data.length > 0;
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={tickFmt} width={52} />
                            <Tooltip formatter={(v, name) => [ttFmt(v), name]} labelStyle={{ fontSize: 11 }} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            {lines.map(l => (
                                <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                                    stroke={l.color || '#3b82f6'}
                                    strokeWidth={l.dashed ? 1.5 : 2}
                                    strokeDasharray={l.dashed ? '4 3' : undefined}
                                    dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

export function TrendBarChart({ title, data = [], bars = [], stacked = false }) {
    const hasData = data.length > 0;
    const isRevenue = bars.some(b => b.key.includes('jpy'));
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无数据</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10 }}
                                tickFormatter={isRevenue ? tickFmt : v => v}
                                width={isRevenue ? 52 : 32} />
                            <Tooltip
                                formatter={(v, name) => [isRevenue ? ttFmt(v) : v, name]}
                                labelStyle={{ fontSize: 11 }} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            {bars.map(b => (
                                <Bar key={b.key} dataKey={b.key} name={b.name}
                                    fill={b.color || '#6366f1'}
                                    stackId={stacked ? 'stack' : undefined} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}