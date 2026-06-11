import React, { useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";

export default function DataQualityBanner({ summary }) {
    const [collapsed, setCollapsed] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    const issues = [];

    if (summary?.orders_missing_cost_data > 0) {
        issues.push({
            field: "下单收入字段",
            count: summary.orders_missing_cost_data,
            desc: `有 ${summary.orders_missing_cost_data} 笔订单缺少 order_stage_payment_jpy，系统已降级使用 paid_amount 估算，金额可能偏差`
        });
    }

    // 运费成本缺失：运费有收入但成本为0，可能未录入
    const hasShippingIncomeButNoCost =
        (summary?.shipping_stage_income_jpy > 0) &&
        (summary?.actual_international_shipping_cost_jpy === 0);
    if (hasShippingIncomeButNoCost) {
        issues.push({
            field: "运费成本",
            desc: "检测到运费收入但国际运费成本为零，请确认是否已在发货池录入实际国际运费支出"
        });
    }

    // 外箱成本缺失
    const hasBoxChargeButNoCost =
        (summary?.box_charge_jpy > 0) &&
        (summary?.box_actual_cost_jpy === 0);
    if (hasBoxChargeButNoCost) {
        issues.push({
            field: "外箱成本",
            desc: "检测到外箱收费但外箱成本为零，请确认是否已录入外箱实际采购成本"
        });
    }

    if (issues.length === 0) return null;

    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-amber-800">
                                数据完整性提醒（{issues.length} 项）
                            </p>
                            <button onClick={() => setCollapsed(!collapsed)}
                                className="text-amber-600 hover:text-amber-800 transition-colors">
                                {collapsed
                                    ? <ChevronDown className="w-3.5 h-3.5" />
                                    : <ChevronUp className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        {!collapsed && (
                            <ul className="mt-1.5 space-y-1">
                                {issues.map((issue, i) => (
                                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                                        <span className="font-medium shrink-0">[{issue.field}]</span>
                                        <span>{issue.desc}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                <button onClick={() => setDismissed(true)}
                    className="text-amber-500 hover:text-amber-700 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}