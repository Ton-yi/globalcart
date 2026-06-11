import React from "react";
import { Info } from "lucide-react";

export default function CrossPeriodNote() {
    return (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
                <p><strong>时间归属说明：</strong>
                    订单按「提交日期」归属，发货池按「创建日期」归属。
                    跨期订单（如5月下单、6月发货）的下单利润计入5月，运费利润计入6月，单月报表可能不含完整利润。
                    如需查看完整利润，建议拉取含订单下单到发货全过程的较长时间范围。
                </p>
            </div>
        </div>
    );
}