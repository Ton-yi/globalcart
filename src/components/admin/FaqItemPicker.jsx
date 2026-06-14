import { useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";

/**
 * FaqItemPicker
 * Lets the admin pick individual FAQ items (from FaqCategory.items[]) across categories.
 * Props:
 *   categories  – array of FaqCategory records (already fetched by parent)
 *   selectedIds – array of item._id strings
 *   onChange    – (newIds: string[]) => void
 */
export default function FaqItemPicker({ categories = [], selectedIds = [], onChange }) {
  const [openCats, setOpenCats] = useState({});

  const toggleCat = (id) => setOpenCats(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleItem = (itemId) => {
    if (selectedIds.includes(itemId)) {
      onChange(selectedIds.filter(id => id !== itemId));
    } else {
      onChange([...selectedIds, itemId]);
    }
  };

  if (!categories.length) {
    return <p className="text-xs text-gray-400 italic">暂无 FAQ 分类，请先在「帮助中心」中创建分类和问答。</p>;
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto rounded border border-gray-200 bg-white p-1.5">
      {categories.map(cat => {
        const items = cat.items || [];
        const isOpen = !!openCats[cat.id];
        const selectedInCat = items.filter(it => selectedIds.includes(it._id)).length;

        return (
          <div key={cat.id} className="rounded-md border border-gray-100">
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCat(cat.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-gray-50 rounded-md"
            >
              {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
              <span className="text-xs font-medium text-gray-700 flex-1 truncate">{cat.title}</span>
              {selectedInCat > 0 && (
                <span className="text-xs text-teal-600 font-medium flex-shrink-0">已选 {selectedInCat}</span>
              )}
              <span className="text-xs text-gray-400 flex-shrink-0">{items.length} 条</span>
            </button>

            {/* Items */}
            {isOpen && (
              <div className="px-2 pb-1.5 space-y-0.5">
                {items.length === 0 && (
                  <p className="text-xs text-gray-400 italic pl-4">该分类暂无问答</p>
                )}
                {items.map(item => {
                  const checked = selectedIds.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => toggleItem(item._id)}
                      className={`w-full flex items-start gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                        checked ? "bg-teal-50 text-teal-800" : "hover:bg-gray-50 text-gray-600"
                      }`}
                    >
                      <span className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center ${
                        checked ? "bg-teal-500 border-teal-500 text-white" : "border-gray-300"
                      }`}>
                        {checked && <Check className="w-2.5 h-2.5" />}
                      </span>
                      <span className="truncate">{item.question || "（无标题）"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}