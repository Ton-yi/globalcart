/**
 * 发货阶段阶梯费率编辑器
 * 每条规则：客户等级、收货国家、发货方式、是否中转、重量范围、入库尺寸 → 费率+固定费
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";
import { ALL_COUNTRIES } from "@/lib/countries";



function MultiChipSelect({ label, options, value = [], onChange, renderOption }) {
  const [open, setOpen] = useState(false);
  const isAll = value.length === 0;

  const toggle = (v) => {
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex flex-wrap gap-0.5 items-center px-2 py-1 border border-gray-200 rounded bg-white hover:border-gray-300 text-xs min-h-[30px]">
        {isAll ? (
          <span className="text-gray-400">{label}(全部)</span>
        ) : (
          value.map(v => (
            <span key={v} className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 rounded px-1 py-0.5">
              {renderOption ? renderOption(v) : v}
              <button type="button" onClick={e => { e.stopPropagation(); toggle(v); }} className="hover:text-red-500">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className="w-3 h-3 text-gray-300 ml-auto flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto min-w-[140px]">
          <button type="button" onClick={() => { onChange([]); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${isAll ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
            全部
          </button>
          {options.map(opt => (
            <button key={opt.value ?? opt} type="button"
              onClick={() => toggle(opt.value ?? opt)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${value.includes(opt.value ?? opt) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
              {opt.label ?? opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerLevelChips({ value = [], onChange, tiers, roles }) {
  const [open, setOpen] = useState(false);
  const allOptions = [
    ...tiers.map(t => ({ type: 'tier', id: t.id, name: t.name })),
    ...roles.map(r => ({ type: 'role', id: r.id, name: r.name })),
  ];
  const selectedIds = new Set(value.map(v => v.id));

  const add = (opt) => {
    if (selectedIds.has(opt.id)) return;
    onChange([...value, { type: opt.type, id: opt.id, name: opt.name }]);
    setOpen(false);
  };
  const remove = (id) => onChange(value.filter(v => v.id !== id));

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-0.5 items-center border border-gray-200 rounded px-2 py-1 bg-white cursor-pointer min-h-[30px]"
        onClick={() => setOpen(o => !o)}>
        {value.length === 0 ? (
          <span className="text-xs text-gray-400">等级(全部)</span>
        ) : (
          value.map(v => (
            <span key={v.id} className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs ${v.type === 'tier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
              {v.name}
              <button type="button" onClick={e => { e.stopPropagation(); remove(v.id); }} className="hover:text-red-500">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className="w-3 h-3 text-gray-300 ml-auto" />
      </div>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[160px]">
          <button type="button" onClick={() => { onChange([]); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-500">全部（不限等级）</button>
          {tiers.length > 0 && <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50">会员阶级</div>}
          {tiers.map(t => (
            <button key={t.id} type="button" onClick={() => add({ type: 'tier', id: t.id, name: t.name })}
              disabled={selectedIds.has(t.id)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 disabled:opacity-40">{t.name}</button>
          ))}
          {roles.length > 0 && <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">角色标签</div>}
          {roles.map(r => (
            <button key={r.id} type="button" onClick={() => add({ type: 'role', id: r.id, name: r.name })}
              disabled={selectedIds.has(r.id)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 disabled:opacity-40">{r.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_TIER = {
  customer_levels: [], countries: [], shipping_methods: [], has_transit: null,
  weight_from_g: null, weight_to_g: null, storage_sizes: [], rate: 0, fixed_fee_jpy: 0,
};

export default function PostOrderTieredEditor({ value = [], onChange }) {
  const [tiers, setTiers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [shippingMethodOptions, setShippingMethodOptions] = useState([]);
  const [sizeTemplateOptions, setSizeTemplateOptions] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_member_tiers' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_roles' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_shipping_methods' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_item_size_templates' }),
    ]).then(([t, r, sm, st]) => {
      setTiers(t.data?.tiers || []);
      setRoles((r.data?.roles || []).filter(x => !x.is_global && !x.is_archived));
      setShippingMethodOptions((sm.data?.methods || []).map(m => ({ value: m.code || m.name, label: m.name })));
      setSizeTemplateOptions((st.data?.templates || []).map(t => ({ value: t.id, label: t.title })));
    });
    const opts = ALL_COUNTRIES.map(c => ({ value: c.code, label: `${c.name}(${c.code})` }));
    setCountryOptions(opts);
  }, []);

  const addTier = () => onChange([...value, { ...EMPTY_TIER }]);
  const removeTier = (i) => onChange(value.filter((_, idx) => idx !== i));
  const updateTier = (i, key, val) => onChange(value.map((t, idx) => idx === i ? { ...t, [key]: val } : t));

  return (
    <div className="space-y-4">
      {value.map((tier, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">规则 #{i + 1}</span>
            <button type="button" onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 1: customer levels + countries */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-400 mb-1">客户等级</div>
              <CustomerLevelChips value={tier.customer_levels || []} onChange={v => updateTier(i, 'customer_levels', v)} tiers={tiers} roles={roles} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">收货国家</div>
              <MultiChipSelect label="国家" options={countryOptions} value={tier.countries || []}
                onChange={v => updateTier(i, 'countries', v)} renderOption={v => v} />
            </div>
          </div>

          {/* Row 2: shipping methods + transit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-400 mb-1">发货方式</div>
              <MultiChipSelect label="方式"
                options={shippingMethodOptions}
                value={tier.shipping_methods || []}
                onChange={v => updateTier(i, 'shipping_methods', v)}
                renderOption={v => shippingMethodOptions.find(o => o.value === v)?.label ?? v}
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">是否中转</div>
              <select value={tier.has_transit === null || tier.has_transit === undefined ? '' : String(tier.has_transit)}
                onChange={e => updateTier(i, 'has_transit', e.target.value === '' ? null : e.target.value === 'true')}
                className="w-full h-[30px] px-2 text-xs border border-gray-200 rounded bg-white">
                <option value="">不限</option>
                <option value="true">是（中转）</option>
                <option value="false">否（直发）</option>
              </select>
            </div>
          </div>

          {/* Row 3: weight range + storage size */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-gray-400 mb-1">重量下限(g)</div>
              <Input className="h-8 text-xs" type="number" value={tier.weight_from_g ?? ''}
                onChange={e => updateTier(i, 'weight_from_g', e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="不限" />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">重量上限(g)</div>
              <Input className="h-8 text-xs" type="number" value={tier.weight_to_g ?? ''}
                onChange={e => updateTier(i, 'weight_to_g', e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="不限" />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">入库尺寸</div>
              <MultiChipSelect label="尺寸"
                options={sizeTemplateOptions}
                value={tier.storage_sizes || []}
                onChange={v => updateTier(i, 'storage_sizes', v)}
                renderOption={v => sizeTemplateOptions.find(o => o.value === v)?.label ?? v}
              />
            </div>
          </div>

          {/* Row 4: rate + fixed fee */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-400 mb-1">运费费率 %（乘算国际运费）</div>
              <div className="flex items-center gap-1">
                <Input className="h-8 text-xs" type="number" step="0.1" value={tier.rate ?? 0}
                  onChange={e => updateTier(i, 'rate', parseFloat(e.target.value) || 0)} placeholder="0" />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">固定费 ¥</div>
              <Input className="h-8 text-xs" type="number" value={tier.fixed_fee_jpy ?? 0}
                onChange={e => updateTier(i, 'fixed_fee_jpy', parseFloat(e.target.value) || 0)} placeholder="0" />
            </div>
          </div>
        </div>
      ))}

      {value.length === 0 && (
        <div className="text-xs text-gray-400 text-center py-3 border border-dashed rounded-lg">尚未添加规则</div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full">
        <Plus className="w-3.5 h-3.5 mr-1" />添加阶梯规则
      </Button>
      <p className="text-xs text-gray-400">规则按顺序匹配，命中第一条即生效。字段为空=不限制该条件。</p>
    </div>
  );
}