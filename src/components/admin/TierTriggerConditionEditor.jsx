/**
 * TierTriggerConditionEditor - 会员阶级触发条件可视化编辑器
 * 编辑 MemberTier.trigger_condition 条件树（指标 + 运算符 + 数值，AND/OR 组合）
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const METRIC_FIELDS = [
  { value: "total_paid_jpy", label: "累计实付总额", unit: "JPY" },
  { value: "total_goods_jpy", label: "累计货款总额", unit: "JPY" },
  { value: "total_service_fee_jpy", label: "累计服务费", unit: "JPY" },
  { value: "avg_order_value_jpy", label: "平均订单金额", unit: "JPY" },
  { value: "max_order_value_jpy", label: "最高单笔金额", unit: "JPY" },
  { value: "order_count_total", label: "历史订单总数", unit: "笔" },
  { value: "order_count_active", label: "有效订单数", unit: "笔" },
  { value: "order_count_30d", label: "近30天订单数", unit: "笔" },
  { value: "order_count_90d", label: "近90天订单数", unit: "笔" },
  { value: "order_count_365d", label: "近365天订单数", unit: "笔" },
  { value: "refund_count", label: "退款次数", unit: "次" },
  { value: "refund_rate_pct", label: "退款率", unit: "%" },
  { value: "days_since_last_order", label: "距最近下单天数", unit: "天" },
  { value: "account_age_days", label: "注册天数", unit: "天" },
  { value: "pool_count", label: "参与发货池次数", unit: "次" },
  { value: "consolidation_count", label: "参与拼邮次数", unit: "次" },
  { value: "group_buy_order_count", label: "拼单订单数", unit: "笔" },
  { value: "deferred_order_count", label: "后付订单数", unit: "笔" },
  { value: "credit_order_count", label: "记账订单数", unit: "笔" },
  { value: "storage_overdue_count", label: "仓储超期订单数", unit: "笔" },
];

const OPERATORS = [
  { value: "gte", label: "≥ 大于等于" },
  { value: "gt", label: "> 大于" },
  { value: "lte", label: "≤ 小于等于" },
  { value: "lt", label: "< 小于" },
  { value: "eq", label: "= 等于" },
  { value: "neq", label: "≠ 不等于" },
];

export default function TierTriggerConditionEditor({ value, onChange }) {
  const cond = value && Array.isArray(value.conditions)
    ? value
    : { logic: "and", conditions: [] };

  const update = (next) => onChange({ logic: cond.logic || "and", conditions: cond.conditions, ...next });
  const setRow = (i, patch) => {
    const rows = [...cond.conditions];
    rows[i] = { ...rows[i], ...patch };
    update({ conditions: rows });
  };
  const addRow = () => update({
    conditions: [...cond.conditions, { field: "total_paid_jpy", operator: "gte", value: 0 }],
  });
  const removeRow = (i) => update({ conditions: cond.conditions.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-2">
      {cond.conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">条件组合方式</span>
          <Select value={cond.logic || "and"} onValueChange={(v) => update({ logic: v })}>
            <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="and">满足全部条件（AND）</SelectItem>
              <SelectItem value="or">满足任一条件（OR）</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {cond.conditions.map((row, i) => {
        const metric = METRIC_FIELDS.find((m) => m.value === row.field);
        return (
          <div key={i} className="flex items-center gap-2">
            <Select value={row.field} onValueChange={(v) => setRow(i, { field: v })}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRIC_FIELDS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}（{m.unit}）</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.operator} onValueChange={(v) => setRow(i, { operator: v })}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-32">
              <Input
                type="number"
                className="h-8 text-xs pr-10"
                value={row.value ?? ""}
                onChange={(e) => setRow(i, { value: e.target.value === "" ? "" : Number(e.target.value) })}
              />
              {metric && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{metric.unit}</span>
              )}
            </div>
            <button onClick={() => removeRow(i)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {cond.conditions.length === 0 && (
        <p className="text-xs text-gray-400">尚未添加条件，未配置条件时此阶级不参与自动触发。</p>
      )}

      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
        <Plus className="w-3 h-3 mr-1" />添加条件
      </Button>
    </div>
  );
}