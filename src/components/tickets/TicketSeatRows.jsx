import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, HelpCircle } from "lucide-react";

/**
 * 席种 - 数量 - 料金 明细编辑
 * 席种支持从预设列表快速选取，也可自行输入。
 * accountCount 和 onAccountCountChange 将账户数内联到标题行右侧
 */
export default function TicketSeatRows({
  seats, onChange, seatPresets = [], required,
  accountCount, onAccountCountChange, isLottery, showAccountCount,
}) {
  const update = (idx, patch) => onChange(seats.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const add = () => onChange([...seats, { seat_type: "", quantity: 1, price_jpy: "" }]);
  const remove = (idx) => onChange(seats.filter((_, i) => i !== idx));

  const placeholder = isLottery ? "期望抽票账户数（每账户各抽一次）" : "期望抢票人数（同时抢票）";

  return (
    <div className="space-y-2">
      {/* 标题行：席种标签 + 右侧账户数/抢票人数输入 */}
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium whitespace-nowrap">
          席種 · 数量 · 料金{required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {showAccountCount && onAccountCountChange && (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min="1"
              className="h-7 w-24 text-sm text-right"
              placeholder={placeholder}
              value={accountCount ?? 1}
              onChange={e => onAccountCountChange(e.target.value)}
            />
            <div className="group relative">
              <HelpCircle className="w-4 h-4 text-gray-400 cursor-help flex-shrink-0" />
              <div className="absolute right-0 top-6 w-56 bg-gray-800 text-white text-xs rounded-lg p-2.5 hidden group-hover:block z-50 shadow-lg leading-relaxed">
                {isLottery
                  ? "期望参与抽选的账户数量。每个账户将独立参与抽选，总预付金额 = 席种总价 × 账户数。"
                  : "同时参与抢票的人数。总预付金额 = 席种总价 × 人数。"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 席种预设快捷选取 */}
      {seatPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seatPresets.map((st) => (
            <button key={st} type="button"
              onClick={() => onChange([...seats, { seat_type: st, quantity: 1, price_jpy: "" }])}
              className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded hover:bg-violet-100">
              + {st}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {seats.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input className="flex-1 h-8 text-sm" placeholder="席种（如 S席）"
              value={s.seat_type} onChange={e => update(idx, { seat_type: e.target.value })} />
            <Input className="w-20 h-8 text-sm" type="number" min="1" placeholder="数量"
              value={s.quantity} onChange={e => update(idx, { quantity: e.target.value })} />
            <Input className="w-28 h-8 text-sm" type="number" min="0" placeholder="单价 ¥"
              value={s.price_jpy} onChange={e => update(idx, { price_jpy: e.target.value })} />
            <button type="button" onClick={() => remove(idx)} className="text-gray-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={add}>
        <Plus className="w-3 h-3 mr-1" />添加席种
      </Button>
    </div>
  );
}