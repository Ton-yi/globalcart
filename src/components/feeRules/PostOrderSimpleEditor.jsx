/**
 * 发货阶段简单比例编辑器
 * 配置：用户等级 → 运费费率 + 固定费
 * value: [{type:'all'|'tier'|'role', id?, name, rate, fixed_fee_jpy}]
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export default function PostOrderSimpleEditor({ value = [], onChange }) {
  const [tiers, setTiers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_member_tiers' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_roles' }),
    ]).then(([t, r]) => {
      setTiers(t.data?.tiers || []);
      setRoles((r.data?.roles || []).filter(x => !x.is_global && !x.is_archived));
      setLoading(false);
    });
  }, []);

  const allOptions = [
    { type: 'all', id: 'all', name: '所有用户（默认）' },
    ...tiers.map(t => ({ type: 'tier', id: t.id, name: t.name, color: t.color })),
    ...roles.map(r => ({ type: 'role', id: r.id, name: r.name })),
  ];

  const selectedIds = new Set(value.map(v => v.id || v.type));

  const addItem = (opt) => {
    const key = opt.id || opt.type;
    if (selectedIds.has(key)) return;
    onChange([...value, { type: opt.type, id: opt.id, name: opt.name, rate: 0, fixed_fee_jpy: 0 }]);
    setOpen(false);
  };

  const removeItem = (idx) => onChange(value.filter((_, i) => i !== idx));

  const moveItem = (idx, dir) => {
    const arr = [...value];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    onChange(arr);
  };

  const update = (idx, key, val) => {
    onChange(value.map((v, i) => i === idx ? { ...v, [key]: val } : v));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 font-medium px-1">
        <span className="col-span-2">客户等级</span>
        <span>运费费率 %</span>
        <span>固定费 ¥</span>
        <span></span>
      </div>

      {value.map((item, idx) => (
        <div key={idx} className="grid grid-cols-5 gap-2 items-center">
          <div className="col-span-2 flex items-center gap-1">
            <div className="flex flex-col gap-0.5 mr-1">
              <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === value.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <Badge className={`text-xs truncate max-w-full ${item.type === 'all' ? 'bg-gray-100 text-gray-600' : item.type === 'tier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
              {item.name}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Input className="h-8 text-xs" type="number" step="0.1" value={item.rate ?? 0}
              onChange={e => update(idx, 'rate', parseFloat(e.target.value) || 0)} placeholder="0" />
            <span className="text-xs text-gray-400">%</span>
          </div>
          <Input className="h-8 text-xs" type="number" value={item.fixed_fee_jpy ?? 0}
            onChange={e => update(idx, 'fixed_fee_jpy', parseFloat(e.target.value) || 0)} placeholder="0" />
          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {value.length === 0 && (
        <div className="text-xs text-gray-400 text-center py-3 border border-dashed rounded-lg">暂未配置，将对所有用户使用默认费率</div>
      )}

      {/* Add picker */}
      <div className="relative">
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" />添加客户等级配置
        </Button>
        {open && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
            {loading ? (
              <div className="text-xs text-gray-400 text-center py-3">加载中...</div>
            ) : allOptions.map(opt => (
              <button key={opt.id} type="button" onClick={() => addItem(opt)}
                disabled={selectedIds.has(opt.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left disabled:opacity-40 text-sm">
                <Badge className={`text-xs ${opt.type === 'all' ? 'bg-gray-100 text-gray-600' : opt.type === 'tier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                  {opt.name}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">费率乘算实际国际运费，固定费额外叠加。序号越小优先级越高，匹配到第一个符合等级即生效。</p>
    </div>
  );
}