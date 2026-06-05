/**
 * 下单网站选择器 — 从 OnlineStoreTagRule 中拉取标签，支持多选，默认包含"所有"项
 * value: [] 或 ['tag1', 'tag2', ...]  （空数组等同于"所有"）
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { X, ChevronDown } from "lucide-react";

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

  const isAll = value.length === 0;

  const toggleTag = (label) => {
    if (value.includes(label)) {
      onChange(value.filter(v => v !== label));
    } else {
      onChange([...value, label]);
    }
  };

  const setAll = () => { onChange([]); setOpen(false); };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:border-gray-300 text-sm transition-colors min-h-[36px]"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {isAll ? (
            <span className="text-gray-500 text-xs">所有网站</span>
          ) : (
            value.map(v => (
              <span key={v} className="inline-flex items-center gap-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 text-xs">
                {v}
                <button type="button" onClick={e => { e.stopPropagation(); toggleTag(v); }} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
          {/* All option */}
          <button type="button" onClick={setAll}
            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left ${isAll ? 'bg-blue-50' : ''}`}>
            <span className={`text-xs font-medium ${isAll ? 'text-blue-700' : 'text-gray-700'}`}>所有网站（默认）</span>
            {isAll && <span className="text-xs text-blue-500 ml-auto">✓ 已选</span>}
          </button>
          <div className="border-t border-gray-100" />
          {loading ? (
            <div className="text-xs text-gray-400 text-center py-3">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">暂无网站标签（请先在网站设置中配置）</div>
          ) : (
            tags.map(tag => (
              <button key={tag.keyword} type="button" onClick={() => toggleTag(tag.tag_label)}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-left ${value.includes(tag.tag_label) ? 'bg-orange-50' : ''}`}>
                <span className={`px-1.5 py-0.5 rounded text-xs ${tag.tag_color || 'bg-gray-100 text-gray-700'}`}>{tag.tag_label}</span>
                {value.includes(tag.tag_label) && <span className="text-xs text-orange-500 ml-auto">✓</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}