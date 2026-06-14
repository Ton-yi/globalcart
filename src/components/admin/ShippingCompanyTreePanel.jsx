/**
 * ShippingCompanyTreePanel
 * 右侧：运输公司 + 本地运输方式 树状排序面板
 * 操作：上移/下移/缩进（设为子项）/提级/隐藏
 * 点击方式条目 → 触发 onSelectMethod
 */
import { useState } from "react";
import {
  Plus, ChevronUp, ChevronDown, EyeOff, Eye,
  ArrowRight, ArrowLeft, Trash2, Building2, Truck, Edit2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ──────────────────────────────────────────────
// Flat tree helpers
// ──────────────────────────────────────────────

/**
 * treeItems shape:
 * [
 *   { type: 'company', id, name, logo_url, description, is_active, sort_order },
 *   { type: 'method',  id, name, fee_jpy, trackable, is_active, company_id, sort_order, indent },
 *   ...
 * ]
 * We keep a flat ordered array for easy manipulation.
 * company_id on a method = which company it's grouped under (null = ungrouped)
 * indent on a method = 0 (top-level under company) | 1 (sub-item)
 */

export default function ShippingCompanyTreePanel({
  companies = [],
  methods = [],
  activeMethodId,
  onSelectMethod,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
  onAddMethod,
  onMethodsChange,   // (newMethods) => void
  onCompaniesChange, // (newCompanies) => void
}) {
  // Build display tree: companies in order, methods nested under their company
  const sortedCompanies = [...companies].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const ungrouped = methods.filter(m => !m.company_id);
  const sortedUngrouped = [...ungrouped].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const getCompanyMethods = (cid) =>
    [...methods.filter(m => m.company_id === cid)].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // ── Method move helpers ───────────────────────────────────
  const reorderMethods = (methodId, direction) => {
    const m = methods.find(x => x.id === methodId);
    if (!m) return;
    const siblings = [...methods.filter(x => x.company_id === m.company_id)]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = siblings.findIndex(x => x.id === methodId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const updatedMethods = methods.map(x => {
      if (x.id === siblings[idx].id) return { ...x, sort_order: siblings[swapIdx].sort_order ?? swapIdx };
      if (x.id === siblings[swapIdx].id) return { ...x, sort_order: siblings[idx].sort_order ?? idx };
      return x;
    });
    // Recalculate clean sort_order for affected group
    const recalc = updatedMethods
      .filter(x => x.company_id === m.company_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((x, i) => ({ ...x, sort_order: i }));
    onMethodsChange(updatedMethods.map(x => recalc.find(r => r.id === x.id) || x));
  };

  const indentMethod = (methodId) => {
    // Make it a sub-item of the previous method's company sibling — we reuse indent field
    const m = methods.find(x => x.id === methodId);
    if (!m) return;
    onMethodsChange(methods.map(x => x.id === methodId ? { ...x, indent: 1 } : x));
  };

  const outdentMethod = (methodId) => {
    const m = methods.find(x => x.id === methodId);
    if (!m) return;
    onMethodsChange(methods.map(x => x.id === methodId ? { ...x, indent: 0 } : x));
  };

  const toggleMethodVisibility = (methodId) => {
    onMethodsChange(methods.map(x => x.id === methodId ? { ...x, is_active: !(x.is_active !== false) } : x));
  };

  // ── Company move helpers ──────────────────────────────────
  const reorderCompany = (companyId, direction) => {
    const sorted = [...companies].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex(x => x.id === companyId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const recalc = sorted.map((x, i) => {
      if (i === idx) return { ...x, sort_order: swapIdx };
      if (i === swapIdx) return { ...x, sort_order: idx };
      return { ...x, sort_order: i };
    }).sort((a, b) => a.sort_order - b.sort_order)
      .map((x, i) => ({ ...x, sort_order: i }));
    onCompaniesChange(recalc);
  };

  // ── Render ────────────────────────────────────────────────
  const renderMethod = (m, siblingsCount, siblingIdx) => {
    const isActive = m.is_active !== false;
    const isSelected = m.id === activeMethodId;
    const indent = m.indent === 1;

    return (
      <div
        key={m.id}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group
          ${isSelected ? "bg-orange-50 border border-orange-300" : "hover:bg-gray-50 border border-transparent"}
          ${!isActive ? "opacity-50" : ""}
          ${indent ? "ml-5" : "ml-0"}
        `}
        onClick={() => onSelectMethod(m)}
      >
        <Truck className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
        <span className={`flex-1 text-xs truncate ${isSelected ? "font-semibold text-orange-700" : "text-gray-700"}`}>
          {m.name || <span className="text-gray-400 italic">未命名</span>}
        </span>
        {m.fee_jpy > 0 && (
          <span className="text-xs text-orange-500 flex-shrink-0">¥{m.fee_jpy}</span>
        )}
        {/* action buttons — show on hover */}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30"
            disabled={siblingIdx === 0}
            onClick={() => reorderMethods(m.id, "up")}
            title="上移"
          ><ChevronUp className="w-3 h-3" /></button>
          <button
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30"
            disabled={siblingIdx === siblingsCount - 1}
            onClick={() => reorderMethods(m.id, "down")}
            title="下移"
          ><ChevronDown className="w-3 h-3" /></button>
          {!indent ? (
            <button
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
              onClick={() => indentMethod(m.id)}
              title="设为子项"
            ><ArrowRight className="w-3 h-3" /></button>
          ) : (
            <button
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
              onClick={() => outdentMethod(m.id)}
              title="提升一级"
            ><ArrowLeft className="w-3 h-3" /></button>
          )}
          <button
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
            onClick={() => toggleMethodVisibility(m.id)}
            title={isActive ? "隐藏" : "显示"}
          >{isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">运输公司 & 方式排序</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddCompany}>
          <Plus className="w-3 h-3 mr-1" />添加运输公司
        </Button>
      </div>

      {/* Companies */}
      {sortedCompanies.length === 0 && sortedUngrouped.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-4">暂无运输公司，点击"添加运输公司"新建</p>
      )}

      {sortedCompanies.map((company, cIdx) => {
        const companyMethods = getCompanyMethods(company.id);
        return (
          <div key={company.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Company header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 group">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-6 h-6 object-contain rounded flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                </div>
              )}
              <span className="flex-1 text-xs font-semibold text-gray-800 truncate">{company.name}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  disabled={cIdx === 0}
                  onClick={() => reorderCompany(company.id, "up")}
                  title="上移"
                ><ChevronUp className="w-3.5 h-3.5" /></button>
                <button
                  className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  disabled={cIdx === sortedCompanies.length - 1}
                  onClick={() => reorderCompany(company.id, "down")}
                  title="下移"
                ><ChevronDown className="w-3.5 h-3.5" /></button>
                <button
                  className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600"
                  onClick={() => onEditCompany(company)}
                  title="编辑"
                ><Edit2 className="w-3.5 h-3.5" /></button>
                <button
                  className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  onClick={() => onDeleteCompany(company.id)}
                  title="删除"
                ><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            {/* Methods under company */}
            <div className="px-2 py-1.5 space-y-0.5 bg-white min-h-[32px]">
              {companyMethods.length === 0 ? (
                <p className="text-xs text-gray-300 italic px-2 py-1">暂无运输方式</p>
              ) : (
                companyMethods.map((m, i) => renderMethod(m, companyMethods.length, i))
              )}
              <button
                className="w-full text-left text-xs text-gray-400 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50 transition-colors flex items-center gap-1"
                onClick={() => onAddMethod(company.id)}
              >
                <Plus className="w-3 h-3" />添加运输方式
              </button>
            </div>
          </div>
        );
      })}

      {/* Ungrouped methods */}
      {sortedUngrouped.length > 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">未分组</span>
          </div>
          <div className="px-2 py-1.5 space-y-0.5 bg-white">
            {sortedUngrouped.map((m, i) => renderMethod(m, sortedUngrouped.length, i))}
          </div>
        </div>
      )}

      {/* Global add method button when no companies exist */}
      {sortedCompanies.length > 0 && (
        <button
          className="w-full text-xs text-gray-400 hover:text-orange-600 py-2 rounded-lg border border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1"
          onClick={() => onAddMethod(null)}
        >
          <Plus className="w-3 h-3" />添加本地运输方式（不分组）
        </button>
      )}
    </div>
  );
}