import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

/**
 * 席种 - 数量 - 料金 明细编辑
 * 席种支持从预设列表快速选取，也可自行输入。
 * value: [{ seat_type, quantity, price_jpy }]
 */
export default function TicketSeatRows({ seats, onChange, seatPresets = [], required }) {
  const update = (idx, patch) => onChange(seats.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const add = () => onChange([...seats, { seat_type: "", quantity: 1, price_jpy: "" }]);
  const remove = (idx) => onChange(seats.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">席種 · 数量 · 料金{required && <span className="text-red-500 ml-0.5">*</span>}</Label>

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