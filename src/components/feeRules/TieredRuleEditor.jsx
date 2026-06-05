/**
 * 下单阶段阶梯费率编辑器
 * 每行：下限 | 上限 | 客户等级（多选） | 下单网站（多选） | 费率% | 固定费¥ | 删除
 * tiered_config 结构: [{from, to, customer_levels:[{type,id,name}], store_tags:[tag_label], rate, fixed_fee}]
 */
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, ChevronDown } from "lucide-react";

// Render a role badge using hex color
function RoleColorBadge({ name, color }) {
  if (!color) return <span className="px-1 py-0.5 rounded bg-gray-100 text-gray-700">{name}</span>;
  return (
    <span className="px-1 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}>
      {name}
    </span>
  );
}

// Inline multi-select for customer levels
function LevelPicker({ value = [], onChange, tiers, roles }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedIds = new Set(value.map(v => v.id));
  const allOptions = [
    ...tiers.map(t => ({ type: 'tier', id: t.id, name: t.name, color: t.color })),
    ...roles.map(r => ({ type: 'role', id: r.id, name: r.name, color: r.color })),
  ];

  const toggle = (opt) => {
    if (selectedIds.has(opt.id)) {
      onChange(value.filter(v => v.id !== opt.id));
    } else {
      onChange([...value, { type: opt.type, id: opt.id, name: opt.name }]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full min-h-[32px] flex flex-wrap gap-1 items-center px-2 py-1 border border-gray-200 rounded-md bg-white hover:border-blue-300 text-left">
        {value.length === 0
          ? <span className="text-xs text-gray-400">所有</span>
          : value.map(v => (
            <span key={v.id} className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded px-1 py-0.5 text-xs">
              {v.name}
              <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }} className="hover:text-red-500 ml-0.5"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))
        }
        <ChevronDown className="w-3 h-3 text-gray-300 ml-auto flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[150px] max-h-48 overflow-y-auto">
          <button type="button" onClick={() => { onChange([]); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 text-left text-xs border-b border-gray-100 ${value.length === 0 ? 'bg-gray-50 font-medium' : ''}`}>
            <span className="px-1 py-0.5 rounded bg-gray-100 text-gray-600">全部等级</span>
            {value.length === 0 && <span className="text-blue-500 ml-auto">✓</span>}
          </button>
          {allOptions.length === 0
            ? <div className="text-xs text-gray-400 text-center py-2">暂无等级</div>
            : <>
              {tiers.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50 font-medium sticky top-0">会员等级</div>
                  {tiers.map(opt => (
                    <button key={opt.id} type="button" onClick={() => toggle(opt)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 text-left text-xs ${selectedIds.has(opt.id) ? 'bg-blue-50' : ''}`}>
                      <span className={`px-1 py-0.5 rounded ${opt.color || 'bg-gray-100 text-gray-700'}`}>{opt.name}</span>
                      {selectedIds.has(opt.id) && <span className="text-blue-500 ml-auto">✓</span>}
                    </button>
                  ))}
                </>
              )}
              {roles.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50 font-medium sticky top-0">角色标签</div>
                  {roles.map(opt => (
                    <button key={opt.id} type="button" onClick={() => toggle({ type: 'role', id: opt.id, name: opt.name, color: opt.color })}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 text-left text-xs ${selectedIds.has(opt.id) ? 'bg-blue-50' : ''}`}>
                      <RoleColorBadge name={opt.name} color={opt.color} />
                      {selectedIds.has(opt.id) && <span className="text-blue-500 ml-auto">✓</span>}
                    </button>
                  ))}
                </>
              )}
            </>
          }
        </div>
      )}
    </div>
  );
}

// Inline multi-select for store tags
function TagPicker({ value = [], onChange, tags }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedSet = new Set(value);

  const toggle = (label) => {
    if (selectedSet.has(label)) onChange(value.filter(v => v !== label));
    else onChange([...value, label]);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full min-h-[32px] flex flex-wrap gap-1 items-center px-2 py-1 border border-gray-200 rounded-md bg-white hover:border-orange-300 text-left">
        {value.length === 0
          ? <span className="text-xs text-gray-400">所有</span>
          : value.map(v => (
            <span key={v} className="inline-flex items-center gap-0.5 bg-orange-50 text-orange-700 border border-orange-100 rounded px-1 py-0.5 text-xs">
              {v}
              <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }} className="hover:text-red-500 ml-0.5"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))
        }
        <ChevronDown className="w-3 h-3 text-gray-300 ml-auto flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px] max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50 font-medium">所有网站（空=不限）</div>
          {tags.length === 0
            ? <div className="text-xs text-gray-400 text-center py-2">暂无标签</div>
            : tags.map(tag => (
              <button key={tag.tag_label} type="button" onClick={() => toggle(tag.tag_label)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-orange-50 text-left text-xs ${selectedSet.has(tag.tag_label) ? 'bg-orange-50' : ''}`}>
                <span className={`px-1 py-0.5 rounded ${tag.tag_color || 'bg-gray-100 text-gray-700'}`}>{tag.tag_label}</span>
                {selectedSet.has(tag.tag_label) && <span className="text-orange-500 ml-auto">✓</span>}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default function TieredRuleEditor({ tiers, onChange }) {
  const [tiers_data, setTiersData] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tags, setTags] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_member_tiers' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_roles' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_store_tags' }),
    ]).then(([t, r, s]) => {
      setTiersData(t.data?.tiers || []);
      setRoles((r.data?.roles || []).filter(x => !x.is_global && !x.is_archived));
      setTags(s.data?.tags || []);
      setLoadingMeta(false);
    });
  }, []);

  const addRow = () => {
    const last = tiers[tiers.length - 1];
    const newFrom = last ? (parseFloat(last.to) || 0) : 0;
    onChange([...tiers, { from: newFrom, to: null, customer_levels: [], store_tags: [], rate: 8, fixed_fee: 0 }]);
  };

  const update = (i, key, val) => {
    onChange(tiers.map((t, idx) => idx === i ? { ...t, [key]: val } : t));
  };

  const updateNum = (i, key, val) => {
    const parsed = val === '' || val === null ? null : parseFloat(val);
    onChange(tiers.map((t, idx) => idx === i ? { ...t, [key]: parsed } : t));
  };

  const remove = (i) => onChange(tiers.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-2 text-xs text-gray-500 font-medium px-1" style={{gridTemplateColumns:'80px 80px 1fr 1fr 70px 70px 32px'}}>
        <span>下限 ¥</span>
        <span>上限 ¥</span>
        <span>客户等级</span>
        <span>下单网站</span>
        <span>费率 %</span>
        <span>固定费 ¥</span>
        <span></span>
      </div>

      {/* Rows */}
      {loadingMeta ? (
        <div className="text-xs text-gray-400 text-center py-3">加载选项...</div>
      ) : (
        tiers.map((tier, i) => (
          <div key={i} className="grid gap-2 items-start" style={{gridTemplateColumns:'80px 80px 1fr 1fr 70px 70px 32px'}}>
            <Input className="h-8 text-xs" type="number" value={tier.from ?? ''} onChange={e => updateNum(i, 'from', e.target.value)} placeholder="0" />
            <Input className="h-8 text-xs" type="number" value={tier.to ?? ''} onChange={e => updateNum(i, 'to', e.target.value || null)} placeholder="不限" />
            <LevelPicker
              value={tier.customer_levels || []}
              onChange={v => update(i, 'customer_levels', v)}
              tiers={tiers_data}
              roles={roles}
            />
            <TagPicker
              value={tier.store_tags || []}
              onChange={v => update(i, 'store_tags', v)}
              tags={tags}
            />
            <Input className="h-8 text-xs" type="number" step="0.1" value={tier.rate ?? ''} onChange={e => updateNum(i, 'rate', e.target.value)} placeholder="8" />
            <Input className="h-8 text-xs" type="number" value={tier.fixed_fee ?? ''} onChange={e => updateNum(i, 'fixed_fee', e.target.value)} placeholder="0" />
            <button type="button" onClick={() => remove(i)} className="mt-1 text-red-400 hover:text-red-600 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}

      {tiers.length === 0 && !loadingMeta && (
        <div className="text-xs text-gray-400 text-center py-3 border border-dashed rounded-lg">尚未添加阶梯，点击下方按钮添加</div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full">
        <Plus className="w-3.5 h-3.5 mr-1" />添加阶梯行
      </Button>
      <p className="text-xs text-gray-400">每行独立匹配：上限为空=不设上限；客户等级/下单网站为空=匹配所有。优先取最先匹配的行。</p>
    </div>
  );
}