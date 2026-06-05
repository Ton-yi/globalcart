/**
 * 下单网站费率配置 — 每个网站标签平行对应一套服务费率
 * value: [{tag_label, tag_color?, rate, fixed_fee}]  （空数组=不区分网站，使用全局费率）
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";

export default function StoreTagSelector({ value = [], onChange }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_store_tags' })
      .then(r => {
        setTags(r.data?.tags || []);
        setLoading(false);
      });
  }, []);

  const selectedLabels = new Set(value.map(v => v.tag_label));

  const addTag = (tag) => {
    if (selectedLabels.has(tag.tag_label)) return;
    onChange([...value, { tag_label: tag.tag_label, tag_color: tag.tag_color, rate: 8, fixed_fee: 0 }]);
    setOpen(false);
  };

  const removeTag = (label) => onChange(value.filter(v => v.tag_label !== label));

  const moveItem = (idx, dir) => {
    const arr = [...value];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    onChange(arr);
  };

  const updateItem = (idx, key, val) => {
    onChange(value.map((v, i) => i === idx ? { ...v, [key]: val } : v));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">下单网站 → 服务费率（未配置=使用全局费率）</span>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(v => !v)}>
          <Plus className="w-3 h-3 mr-1" />添加网站
        </Button>
      </div>

      {/* Dropdown picker */}
      {open && (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
          {loading ? (
            <div className="text-xs text-gray-400 text-center py-3">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">暂无网站标签（请先在网站设置中配置）</div>
          ) : (
            tags.map(tag => (
              <button key={tag.tag_label} type="button" onClick={() => addTag(tag)}
                disabled={selectedLabels.has(tag.tag_label)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-left disabled:opacity-40 disabled:cursor-not-allowed">
                <span className={`px-1.5 py-0.5 rounded text-xs ${tag.tag_color || 'bg-gray-100 text-gray-700'}`}>{tag.tag_label}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Rate table */}
      {value.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-2 text-xs text-gray-400 font-medium px-1 pt-1">
            <span className="col-span-2">网站标签</span>
            <span className="col-span-1 text-center">费率 %</span>
            <span className="col-span-1 text-center">固定费 ¥</span>
            <span className="col-span-1 text-center">排序</span>
            <span></span>
          </div>
          {value.map((item, idx) => (
            <div key={item.tag_label} className="grid grid-cols-6 gap-2 items-center bg-orange-50/50 border border-orange-100 rounded-lg px-2 py-1.5">
              <div className="col-span-2 flex items-center min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-xs truncate ${item.tag_color || 'bg-gray-100 text-gray-700'}`}>
                  {item.tag_label}
                </span>
              </div>
              <Input className="h-7 text-xs col-span-1" type="number" step="0.1" value={item.rate ?? 8}
                onChange={e => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)} placeholder="8" />
              <Input className="h-7 text-xs col-span-1" type="number" value={item.fixed_fee ?? 0}
                onChange={e => updateItem(idx, 'fixed_fee', parseFloat(e.target.value) || 0)} placeholder="0" />
              <div className="col-span-1 flex items-center gap-0.5 justify-center">
                <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === value.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <button type="button" onClick={() => removeTag(item.tag_label)} className="text-gray-300 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-1">每个网站对应独立费率。排序决定优先级（同订单多标签时取最高序）。</p>
        </div>
      )}
    </div>
  );
}