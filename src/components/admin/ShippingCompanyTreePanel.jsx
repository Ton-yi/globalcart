/**
 * ShippingCompanyTreePanel
 * 单列平铺排序面板 — 设计理念与导航栏布局设置完全一致：
 * 所有运输公司、运输方式在同一列，可自由调整位置、缩进层级。
 *
 * 内部数据结构：flatList = [{type:'company'|'method', id, ...item, depth: 0|1|2}]
 * depth 0 = 顶级，depth 1 = 子级，depth 2 = 孙级（最多3层）
 */
import { useState } from "react";
import { Building2, Truck, Eye, EyeOff, ArrowUp, ArrowDown, IndentIncrease, IndentDecrease, Plus, Trash2, Edit2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextInput from "@/components/common/RichTextInput";

// ── helpers ──────────────────────────────────────────────────
function clone(x) { return JSON.parse(JSON.stringify(x)); }

/**
 * Build a flat ordered list from companies + methods.
 * We store depth directly on each item (derived from company_id + indent fields).
 * companies are always depth 0.
 * methods: depth = indent (0 or 1), but when under a company we add 1 more.
 * For the flat list we normalise: item.depth = 0 (top) | 1 | 2
 */
function buildFlatList(companies, methods) {
  // Sort both by sort_order
  const sortedAll = [
    ...companies.map(c => ({ ...c, _type: "company", _depth: 0 })),
    ...methods.map(m => ({ ...m, _type: "method", _depth: m.indent === 1 ? 1 : 0 })),
  ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return sortedAll;
}

/**
 * Rebuild sort_order from flat list position, and write back depth → indent/company fields.
 * Returns { companies, methods }
 */
function flatListToEntities(flatList) {
  const companies = [];
  const methods = [];
  flatList.forEach((item, idx) => {
    if (item._type === "company") {
      const { _type, _depth, ...rest } = item;
      companies.push({ ...rest, sort_order: idx });
    } else {
      const { _type, _depth, ...rest } = item;
      methods.push({ ...rest, sort_order: idx, indent: _depth > 0 ? 1 : 0 });
    }
  });
  return { companies, methods };
}

function subtreeSize(flatList, idx) {
  // Count how many items after idx are children (depth > flatList[idx]._depth)
  const baseDepth = flatList[idx]._depth;
  let count = 0;
  for (let i = idx + 1; i < flatList.length; i++) {
    if (flatList[i]._depth > baseDepth) count++;
    else break;
  }
  return count;
}

// ── Component ─────────────────────────────────────────────────
export default function ShippingCompanyTreePanel({
  companies = [],
  methods = [],
  activeMethodId,
  onSelectMethod,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
  onAddMethod,
  onMethodsChange,
  onCompaniesChange,
}) {
  const [addCompanyForm, setAddCompanyForm] = useState(null);

  const flatList = buildFlatList(companies, methods);

  const commit = (newFlatList) => {
    const { companies: newC, methods: newM } = flatListToEntities(newFlatList);
    onCompaniesChange(newC);
    onMethodsChange(newM);
  };

  const move = (idx, dir) => {
    const list = clone(flatList);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    // Move the entire subtree together
    const subSize = subtreeSize(list, idx);
    const block = list.splice(idx, 1 + subSize);
    // Recalculate insertion point after splice
    const insertAt = dir === -1 ? j : j - subSize;
    list.splice(insertAt, 0, ...block);
    commit(list);
  };

  const indent = (idx) => {
    const list = clone(flatList);
    const item = list[idx];
    if (item._depth >= 2) return;
    // Can only indent if there's a previous sibling at the same level
    let prevSiblingIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (list[i]._depth === item._depth) { prevSiblingIdx = i; break; }
      if (list[i]._depth < item._depth) break;
    }
    if (prevSiblingIdx === -1) return;
    list[idx]._depth = item._depth + 1;
    commit(list);
  };

  const outdent = (idx) => {
    const list = clone(flatList);
    const item = list[idx];
    if (item._depth === 0) return;
    list[idx]._depth = item._depth - 1;
    commit(list);
  };

  const toggleVisibility = (idx) => {
    const list = clone(flatList);
    list[idx].is_active = !(list[idx].is_active !== false);
    commit(list);
  };

  const handleDeleteItem = (idx) => {
    const item = flatList[idx];
    if (item._type === "company") {
      onDeleteCompany(item.id);
      return;
    }
    const list = clone(flatList);
    list.splice(idx, 1);
    commit(list);
  };

  const handleAddCompanySave = () => {
    if (!addCompanyForm?.name?.trim()) return;
    onAddCompany(addCompanyForm);
    setAddCompanyForm(null);
  };

  // Determine if a move is disabled
  const canMoveUp = (idx) => idx > 0;
  const canMoveDown = (idx) => {
    const subSize = subtreeSize(flatList, idx);
    return (idx + subSize) < flatList.length - 1;
  };
  const canIndent = (idx) => {
    const item = flatList[idx];
    if (item._depth >= 2) return false;
    for (let i = idx - 1; i >= 0; i--) {
      if (flatList[i]._depth === item._depth) return true;
      if (flatList[i]._depth < item._depth) return false;
    }
    return false;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">运输公司 & 方式排序</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => onAddMethod(null)}>
            <Plus className="w-3 h-3 mr-1" />新增方式
          </Button>
          {!addCompanyForm && (
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => setAddCompanyForm({ name: "", logo_url: "", description: "" })}>
              <Plus className="w-3 h-3 mr-1" />新增公司
            </Button>
          )}
        </div>
      </div>

      {/* Inline add-company form */}
      {addCompanyForm && (
        <div className="border border-blue-200 rounded-xl p-3 space-y-2 bg-blue-50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />新增运输公司
            </p>
            <button onClick={() => setAddCompanyForm(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-500">公司名称（可粘贴图片作为 Logo）</p>
          <RichTextInput
            value={addCompanyForm.name}
            onChange={v => setAddCompanyForm(p => ({ ...p, name: v }))}
            imageUrls={addCompanyForm.logo_url ? [addCompanyForm.logo_url] : []}
            onImageUrls={urls => setAddCompanyForm(p => ({ ...p, logo_url: urls[0] || "" }))}
            placeholder="公司名称，可粘贴 Logo 图片..."
            rows={1}
            maxImages={1}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAddCompanyForm(null)}>取消</Button>
            <Button size="sm" className="h-6 text-xs bg-blue-600 hover:bg-blue-700"
              disabled={!addCompanyForm.name.trim()}
              onClick={handleAddCompanySave}>
              <Save className="w-3 h-3 mr-1" />创建
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {flatList.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-6 border border-dashed border-gray-200 rounded-xl">
          暂无内容，点击上方「新增方式」或「新增公司」
        </p>
      )}

      {/* Flat list */}
      <div className="space-y-1">
        {flatList.map((item, idx) => {
          const isCompany = item._type === "company";
          const isMethod = item._type === "method";
          const isActive = item.is_active !== false;
          const isSelected = isMethod && item.id === activeMethodId;

          return (
            <div
              key={item._type + item.id}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border transition-colors
                ${isSelected ? "border-orange-300 bg-orange-50" : isActive ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}
                ${isMethod ? "cursor-pointer hover:border-orange-200 hover:bg-orange-50/50" : ""}
              `}
              style={{ marginLeft: item._depth * 24 }}
              onClick={isMethod ? () => onSelectMethod(item) : undefined}
            >
              {/* Icon */}
              {isCompany ? (
                item.logo_url ? (
                  <img src={item.logo_url} alt={item.name} className="w-5 h-5 object-contain rounded flex-shrink-0" />
                ) : (
                  <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )
              ) : (
                <Truck className="w-4 h-4 text-orange-400 flex-shrink-0" />
              )}

              {/* Name */}
              <span className={`flex-1 text-xs truncate
                ${isCompany ? "font-semibold text-gray-800" : isSelected ? "font-semibold text-orange-700" : "text-gray-700"}
              `}>
                {item.name || <span className="text-gray-400 italic">未命名</span>}
              </span>

              {/* Fee badge for methods */}
              {isMethod && item.fee_jpy > 0 && (
                <span className="text-xs text-orange-500 flex-shrink-0">¥{item.fee_jpy}</span>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {isCompany && (
                  <button
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                    onClick={() => onEditCompany(item)}
                    title="编辑公司"
                  ><Edit2 className="w-3 h-3" /></button>
                )}
                <button
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  onClick={() => toggleVisibility(idx)}
                  title={isActive ? "隐藏" : "显示"}
                >{isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                <button
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canMoveUp(idx)}
                  onClick={() => move(idx, -1)}
                  title="上移"
                ><ArrowUp className="w-3 h-3" /></button>
                <button
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canMoveDown(idx)}
                  onClick={() => move(idx, 1)}
                  title="下移"
                ><ArrowDown className="w-3 h-3" /></button>
                <button
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canIndent(idx)}
                  onClick={() => indent(idx)}
                  title="设为子级"
                ><IndentIncrease className="w-3 h-3" /></button>
                <button
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={item._depth === 0}
                  onClick={() => outdent(idx)}
                  title="提升一级"
                ><IndentDecrease className="w-3 h-3" /></button>
                <button
                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  onClick={() => handleDeleteItem(idx)}
                  title="删除"
                ><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}