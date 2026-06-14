/**
 * ShippingCompanyTreePanel
 * 单列平铺排序面板 — 参照导航栏布局设置设计理念。
 * 所有运输公司、运输方式在同一列，可自由调整位置。
 * 运输公司可缩进形成层级；运输方式只能是顶级或公司子级（不可再缩进）。
 * 排序操作在前端完成，点击「保存排序」才实际写入后端。
 */
import { useState, useEffect } from "react";
import {
  Building2, Truck, Eye, EyeOff, ArrowUp, ArrowDown,
  IndentIncrease, IndentDecrease, Plus, Trash2, Edit2, X, Save, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import RichTextInput from "@/components/common/RichTextInput";

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function buildFlatList(companies, methods) {
  return [
    ...companies.map(c => ({ ...c, _type: "company", _depth: 0 })),
    ...methods.map(m => ({ ...m, _type: "method", _depth: m.indent === 1 ? 1 : 0 })),
  ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function flatListToEntities(flatList) {
  const companies = [], methods = [];
  flatList.forEach((item, idx) => {
    const { _type, _depth, ...rest } = item;
    if (_type === "company") {
      companies.push({ ...rest, sort_order: idx });
    } else {
      methods.push({ ...rest, sort_order: idx, indent: _depth > 0 ? 1 : 0 });
    }
  });
  return { companies, methods };
}

function subtreeSize(flatList, idx) {
  const baseDepth = flatList[idx]._depth;
  let count = 0;
  for (let i = idx + 1; i < flatList.length; i++) {
    if (flatList[i]._depth > baseDepth) count++;
    else break;
  }
  return count;
}

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
  saving: externalSaving = false,
}) {
  const [flatList, setFlatList] = useState(() => buildFlatList(companies, methods));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addCompanyForm, setAddCompanyForm] = useState(null);

  // Sync when external data changes (e.g. after add/delete)
  useEffect(() => {
    setFlatList(buildFlatList(companies, methods));
    setDirty(false);
  }, [companies, methods]);

  const mutate = (fn) => {
    setFlatList(prev => {
      const next = clone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const move = (idx, dir) => mutate(list => {
    const subSize = subtreeSize(list, idx);
    const block = list.splice(idx, 1 + subSize);
    const insertAt = dir === -1 ? idx + dir : idx - subSize + dir;
    list.splice(Math.max(0, insertAt), 0, ...block);
  });

  const indent = (idx) => mutate(list => {
    const item = list[idx];
    if (item._depth >= 2) return;
    // Only companies can be indented; methods blocked at call site
    let prevSiblingIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (list[i]._depth === item._depth) { prevSiblingIdx = i; break; }
      if (list[i]._depth < item._depth) break;
    }
    if (prevSiblingIdx === -1) return;
    list[idx]._depth = item._depth + 1;
  });

  const outdent = (idx) => mutate(list => {
    if (list[idx]._depth === 0) return;
    list[idx]._depth = list[idx]._depth - 1;
  });

  const toggleVisibility = (idx) => mutate(list => {
    list[idx].is_active = !(list[idx].is_active !== false);
  });

  const handleDeleteItem = (idx) => {
    const item = flatList[idx];
    if (item._type === "company") {
      onDeleteCompany(item.id);
    } else {
      mutate(list => list.splice(idx, 1));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { companies: newC, methods: newM } = flatListToEntities(flatList);
    await Promise.all([
      onCompaniesChange(newC),
      onMethodsChange(newM),
    ]);
    setDirty(false);
    setSaving(false);
  };

  const handleAddCompanySave = () => {
    if (!addCompanyForm?.name?.trim()) return;
    onAddCompany(addCompanyForm);
    setAddCompanyForm(null);
  };

  const canMoveUp = (idx) => idx > 0;
  const canMoveDown = (idx) => (idx + subtreeSize(flatList, idx)) < flatList.length - 1;
  const canIndent = (idx) => {
    const item = flatList[idx];
    if (item._type === "method") return false; // methods cannot be indented further
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
          {dirty && (
            <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              保存排序
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddMethod(null)}>
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
              disabled={!addCompanyForm.name.trim()} onClick={handleAddCompanySave}>
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
          const isActive = item.is_active !== false;
          const isSelected = item._type === "method" && item.id === activeMethodId;

          return (
            <div
              key={item._type + item.id}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border transition-colors
                ${isSelected ? "border-orange-300 bg-orange-50" : isActive ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}
                ${item._type === "method" ? "cursor-pointer hover:border-orange-200 hover:bg-orange-50/50" : ""}
              `}
              style={{ marginLeft: item._depth * 24 }}
              onClick={item._type === "method" ? () => onSelectMethod(item) : undefined}
            >
              {isCompany ? (
                item.logo_url
                  ? <img src={item.logo_url} alt={item.name} className="w-5 h-5 object-contain rounded flex-shrink-0" />
                  : <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Truck className="w-4 h-4 text-orange-400 flex-shrink-0" />
              )}

              <span className={`flex-1 text-xs truncate
                ${isCompany ? "font-semibold text-gray-800" : isSelected ? "font-semibold text-orange-700" : "text-gray-700"}
              `}>
                {item.name || <span className="text-gray-400 italic">未命名</span>}
              </span>

              {item._type === "method" && item.fee_jpy > 0 && (
                <span className="text-xs text-orange-500 flex-shrink-0">¥{item.fee_jpy}</span>
              )}

              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                {isCompany && (
                  <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                    onClick={() => onEditCompany(item)} title="编辑公司">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  onClick={() => toggleVisibility(idx)} title={isActive ? "隐藏" : "显示"}>
                  {isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canMoveUp(idx)} onClick={() => move(idx, -1)} title="上移">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canMoveDown(idx)} onClick={() => move(idx, 1)} title="下移">
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canIndent(idx)} onClick={() => indent(idx)} title="设为子级">
                  <IndentIncrease className="w-3 h-3" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={item._depth === 0} onClick={() => outdent(idx)} title="提升一级">
                  <IndentDecrease className="w-3 h-3" />
                </button>
                <button className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  onClick={() => handleDeleteItem(idx)} title="删除">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}