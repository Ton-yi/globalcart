import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function formatCurrency(amount) {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount || 0);
}

export function formatNumber(n) {
    return new Intl.NumberFormat('ja-JP').format(n || 0);
}

export default function MetricCard({ title, value, icon: Icon, subtitle, trend, isCount = false, colorClass, raw = false, description, size = 'md' }) {
    // size: 'sm' | 'md' | 'lg'
    // raw=true: 直接显示原始值（字符串/数字均可，如 "3 天", "85.2%"）
    const displayValue = raw
        ? (value ?? '—')
        : isCount
            ? formatNumber(value)
            : typeof value === 'number' ? formatCurrency(value) : (value ?? '—');
    const trendIcon = trend > 0 ? <TrendingUp className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-green-500`} />
        : trend < 0 ? <TrendingDown className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-red-500`} />
        : trend === 0 ? <Minus className={`${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-gray-400`} /> : null;

    // 尺寸配置
    const sizeConfig = {
        sm: {
            titleClass: 'text-xs font-medium',
            valueClass: 'text-lg font-bold',
            subtitleClass: 'text-[10px]',
            iconClass: 'h-3 w-3',
            headerGap: 'gap-1',
            padding: 'pb-1',
        },
        md: {
            titleClass: 'text-sm font-medium',
            valueClass: 'text-2xl font-bold',
            subtitleClass: 'text-xs',
            iconClass: 'h-4 w-4',
            headerGap: 'gap-1.5',
            padding: 'pb-2',
        },
        lg: {
            titleClass: 'text-base font-medium',
            valueClass: 'text-3xl font-bold',
            subtitleClass: 'text-sm',
            iconClass: 'h-5 w-5',
            headerGap: 'gap-2',
            padding: 'pb-3',
        },
    };

    const config = sizeConfig[size] || sizeConfig.md;

    return (
        <TooltipProvider>
            <Card>
                <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${config.padding}`}>
                    <div className={`flex items-center ${config.headerGap}`}>
                        <CardTitle className={`${config.titleClass} text-muted-foreground`}>{title}</CardTitle>
                        {description && (
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className={`${config.iconClass} text-muted-foreground hover:text-foreground cursor-help`} />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-xs">{description}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                    {Icon && <Icon className={`${config.iconClass} text-muted-foreground`} />}
                </CardHeader>
                <CardContent>
                    <div className={`${config.valueClass} ${colorClass || ''}`}>{displayValue}</div>
                    {(subtitle || trendIcon) && (
                        <p className={`${config.subtitleClass} text-muted-foreground mt-1 flex items-center gap-1`}>
                            {trendIcon}{subtitle}
                        </p>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}