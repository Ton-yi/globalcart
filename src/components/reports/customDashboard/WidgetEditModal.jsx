/**
 * WidgetEditModal — 新增/编辑单个 Widget 的配置弹窗
 */
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    WIDGET_CATALOG, METRIC_FIELDS, TIME_SERIES_FIELDS, PIE_SOURCES, COLOR_OPTIONS
} from "./WidgetCatalog";

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

export default function WidgetEditModal({ open, widget, onSave, onClose }) {
    const [type,   setType]   = useState('metric_card');
    const [title,  setTitle]  = useState('');
    const [config, setConfig] = useState({});

    useEffect(() => {
        if (widget) {
            setType(widget.type || 'metric_card');
            setTitle(widget.title || '');
            setConfig(widget.config || {});
        } else {
            const cat = WIDGET_CATALOG[0];
            setType(cat.type);
            setTitle('');
            setConfig({ ...cat.defaultConfig });
        }
    }, [widget, open]);

    const handleTypeChange = (t) => {
        setType(t);
        const cat = WIDGET_CATALOG.find(c => c.type === t);
        setConfig(cat ? { ...cat.defaultConfig } : {});
        setTitle('');
    };

    const handleSave = () => {
        onSave({ type, title, config });
    };

    const setC = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{widget ? '编辑组件' : '添加组件'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* 类型选择 */}
                    <div className="space-y-1.5">
                        <Label>组件类型</Label>
                        <Select value={type} onValueChange={handleTypeChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {WIDGET_CATALOG.map(c => (
                                    <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {WIDGET_CATALOG.find(c => c.type === type)?.description}
                        </p>
                    </div>

                    {/* 标题 */}
                    <div className="space-y-1.5">
                        <Label>标题（留空使用默认）</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="自定义标题..." />
                    </div>

                    {/* ── MetricCard 配置 ── */}
                    {type === 'metric_card' && (
                        <>
                            <div className="space-y-1.5">
                                <Label>数据字段</Label>
                                <Select value={config.field || ''} onValueChange={v => {
                                    const meta = METRIC_FIELDS.find(f => f.value === v);
                                    setConfig(prev => ({ ...prev, field: v, isCount: meta?.isCount ?? false }));
                                }}>
                                    <SelectTrigger><SelectValue placeholder="选择字段" /></SelectTrigger>
                                    <SelectContent>
                                        {METRIC_FIELDS.map(f => (
                                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>数值颜色</Label>
                                <Select value={config.colorClass || ''} onValueChange={v => setC('colorClass', v)}>
                                    <SelectTrigger><SelectValue placeholder="默认" /></SelectTrigger>
                                    <SelectContent>
                                        {COLOR_OPTIONS.map(c => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>副标题（可选）</Label>
                                <Input value={config.subtitle || ''} onChange={e => setC('subtitle', e.target.value)} placeholder="如：待采购 XX 单" />
                            </div>
                        </>
                    )}

                    {/* ── 折线图配置 ── */}
                    {type === 'trend_line' && (
                        <div className="space-y-2">
                            <Label>折线数据系列（最多4条）</Label>
                            {(config.lines || []).map((line, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <Select value={line.key} onValueChange={v => {
                                        const meta = TIME_SERIES_FIELDS.find(f => f.value === v);
                                        const newLines = [...(config.lines || [])];
                                        newLines[i] = { ...newLines[i], key: v, name: meta?.label || v };
                                        setC('lines', newLines);
                                    }}>
                                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {TIME_SERIES_FIELDS.map(f => (
                                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <input type="color" value={line.color || '#3b82f6'}
                                        onChange={e => {
                                            const newLines = [...(config.lines || [])];
                                            newLines[i] = { ...newLines[i], color: e.target.value };
                                            setC('lines', newLines);
                                        }}
                                        className="w-8 h-8 rounded border cursor-pointer" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                        onClick={() => setC('lines', config.lines.filter((_, j) => j !== i))}>✕</Button>
                                </div>
                            ))}
                            {(config.lines || []).length < 4 && (
                                <Button variant="outline" size="sm" className="w-full text-xs"
                                    onClick={() => setC('lines', [...(config.lines || []), { key: 'revenue_jpy', name: '收入', color: CHART_COLORS[(config.lines || []).length % CHART_COLORS.length] }])}>
                                    + 添加系列
                                </Button>
                            )}
                        </div>
                    )}

                    {/* ── 柱状图配置 ── */}
                    {type === 'trend_bar' && (
                        <div className="space-y-2">
                            <Label>柱状图字段</Label>
                            {(config.bars || []).map((bar, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <Select value={bar.key} onValueChange={v => {
                                        const meta = TIME_SERIES_FIELDS.find(f => f.value === v);
                                        const newBars = [...(config.bars || [])];
                                        newBars[i] = { ...newBars[i], key: v, name: meta?.label || v };
                                        setC('bars', newBars);
                                    }}>
                                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {TIME_SERIES_FIELDS.map(f => (
                                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <input type="color" value={bar.color || '#6366f1'}
                                        onChange={e => {
                                            const newBars = [...(config.bars || [])];
                                            newBars[i] = { ...newBars[i], color: e.target.value };
                                            setC('bars', newBars);
                                        }}
                                        className="w-8 h-8 rounded border cursor-pointer" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                        onClick={() => setC('bars', config.bars.filter((_, j) => j !== i))}>✕</Button>
                                </div>
                            ))}
                            {(config.bars || []).length < 3 && (
                                <Button variant="outline" size="sm" className="w-full text-xs"
                                    onClick={() => setC('bars', [...(config.bars || []), { key: 'order_count', name: '订单数', color: '#6366f1' }])}>
                                    + 添加柱
                                </Button>
                            )}
                        </div>
                    )}

                    {/* ── 饼图配置 ── */}
                    {type === 'pie_chart' && (
                        <div className="space-y-1.5">
                            <Label>数据来源</Label>
                            <Select value={config.dataSource || PIE_SOURCES[0].value} onValueChange={v => setC('dataSource', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PIE_SOURCES.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={handleSave}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}