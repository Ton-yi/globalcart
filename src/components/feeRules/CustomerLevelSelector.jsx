/**
 * 客户等级选择器 — 从 MemberTier 和 Role 中选取，支持多选+优先级排序
 * value: [{type:'tier'|'role', id, name, rate?, fixed_fee?}]  （按优先级排列）
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

export default function CustomerLevelSelector({ value = [], onChange, showRateFields = false }) {
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
      setRoles(r.data?.roles || []);
      setLoading(false);
    });
  }, []);

  const allOptions = [
    ...tiers.map(t => ({ type: 'tier', id: t.id, name: t.name, color: t.color })),
    ...roles.filter(r => !r.is_global && !r.is_archived).map(r => ({ type: 'role', id: r.id, name: r.name, color: r.color })),
  ];

  const selectedIds = new Set(value.map(v => v.id));

  const addItem = (opt) => {
    if (selectedIds.has(opt.id)) return;
    onChange([...value, { type: opt.type, id: opt.id, name: opt.name, rate: 8, fixed_fee: 0 }]);
    setOpen(false);
  };

  const removeItem = (id) => onChange(value.filter(v => v.id !== id));

  const moveItem = (idx, dir) => {
    const arr = [...value];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  };

  const updateItem = (idx, key, val) => {
    const arr = value.map((v, i) => i === idx ? { ...v, [key]: val } : v);
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">客户等级过滤（按优先级，未配置=匹配所有）</span>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(v => !v)}>
          <Plus className="w-3 h-3 mr-1" />添加等级
        </Button>
      </div>

      {/* Dropdown picker */}
      {open && (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
          {loading ? (
            <div className="text-xs text-gray-400 text-center py-3">加载中...</div>
          ) : allOptions.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">暂无可选等级</div>
          ) : (
            <>
              {tiers.length > 0 && (
                <div className="px-2 py-1.5 text-xs text-gray-400 font-medium bg-gray-50">会员阶级</div>
              )}
              {tiers.map(t => (
                <button key={t.id} type="button" onClick={() => addItem({ type: 'tier', id: t.id, name: t.name })}
                  disabled={selectedIds.has(t.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${t.color || 'bg-gray-100 text-gray-700'}`}>{t.name}</span>
                  <span className="text-xs text-gray-400 ml-1">会员阶级</span>
                </button>
              ))}
              {roles.filter(r => !r.is_global && !r.is_archived).length > 0 && (
                <div className="px-2 py-1.5 text-xs text-gray-400 font-medium bg-gray-50 border-t border-gray-100">角色标签</div>
              )}
              {roles.filter(r => !r.is_global && !r.is_archived).map(r => (
                <button key={r.id} type="button" onClick={() => addItem({ type: 'role', id: r.id, name: r.name })}
                  disabled={selectedIds.has(r.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="text-xs font-medium text-gray-700">{r.name}</span>
                  <span className="text-xs text-gray-400">角色标签</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Selected items with priority order */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === value.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <span className="text-xs text-gray-400 w-5 text-center font-mono">#{idx + 1}</span>
              <Badge className={`text-xs flex-shrink-0 ${item.type === 'tier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                {item.name}
              </Badge>
              <span className="text-xs text-gray-400">{item.type === 'tier' ? '会员' : '角色'}</span>

              {showRateFields && (
                <>
                  <div className="flex items-center gap-1 ml-auto">
                    <Input className="h-7 w-16 text-xs" type="number" step="0.1" value={item.rate ?? 8}
                      onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)} placeholder="费率%" />
                    <span className="text-xs text-gray-400">%</span>
                    <span className="text-xs text-gray-300">+</span>
                    <Input className="h-7 w-16 text-xs" type="number" value={item.fixed_fee ?? 0}
                      onChange={e => updateItem(idx, 'fixed_fee', parseFloat(e.target.value) || 0)} placeholder="固定¥" />
                    <span className="text-xs text-gray-400">¥</span>
                  </div>
                </>
              )}

              <button type="button" onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 ml-auto flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-400">序号越小优先级越高，匹配到第一个符合的等级后生效</p>
        </div>
      )}
    </div>
  );
}