/**
 * LocalShippingMethodManager
 * 导出三个组件：
 *   - LocalShippingDetail  — 左侧编辑表单
 *   - LocalShippingTree    — 右侧运输公司树状面板
 *   - default              — 两者合并（兼容旧调用，内部两列布局）
 *
 * 调用方可通过 useLocalShipping() hook 共享状态，
 * 将两个面板分别放入独立 Card。
 */
import { useState } from "react";
import { Plus, Trash2, Save, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import RichTextInput from "@/components/common/RichTextInput";
import ShippingCompanyTreePanel from "@/components/admin/ShippingCompanyTreePanel";
import { useLocalShipping, BLANK_METHOD, BLANK_COMPANY } from "@/hooks/useLocalShipping";

// ─── 运输公司编辑弹窗（仅用于编辑已有公司）─────────────────────
export function CompanyFormModal({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({ ...BLANK_COMPANY, ...initial });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />编辑运输公司
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">公司名称（可粘贴图片作为 Logo）</Label>
            <RichTextInput
              value={form.name}
              onChange={v => f("name", v)}
              imageUrls={form.logo_url ? [form.logo_url] : []}
              onImageUrls={urls => f("logo_url", urls[0] || "")}
              placeholder="公司名称，可粘贴 Logo 图片..."
              rows={1}
              maxImages={1}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">描述（纯文本）</Label>
            <Textarea className="text-sm resize-none" rows={3} value={form.description || ""}
              onChange={e => f("description", e.target.value)} placeholder="运输公司简介..." />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
            disabled={!form.name.trim() || saving} onClick={() => onSave(form)}>
            保存更改
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 左侧：编辑表单面板 ───────────────────────────────────────
export function LocalShippingDetail({ state }) {
  const {
    isFormOpen, formMode, form, setForm, saving,
    handleSaveForm, handleDeleteMethod, handleCancel,
    companyModal, setCompanyModal, persistCompany,
  } = state;

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      {!isFormOpen ? (
        <div className="space-y-3">
          <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3">
            <p className="text-xs text-gray-400">点击右侧运输方式条目进行编辑</p>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 h-7 text-xs"
              onClick={() => state.handleAddMethod(null)}>
              <Plus className="w-3 h-3 mr-1" />新增运输方式
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              {formMode === "add" ? "新增运输方式" : "编辑运输方式"}
            </p>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">名称 *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.name || ""}
                onChange={e => f("name", e.target.value)} placeholder="宅急便" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">料金（JPY）</Label>
              <Input type="number" className="mt-1 h-8 text-sm"
                value={form.fee_jpy === 0 ? "" : (form.fee_jpy ?? "")}
                onChange={e => f("fee_jpy", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 flex-shrink-0">追跡可否</Label>
              <Switch checked={!!form.trackable} onCheckedChange={v => f("trackable", v)} />
              <span className="text-xs text-gray-400">{form.trackable ? "可" : "否"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 flex-shrink-0">启用</Label>
              <Switch checked={form.is_active !== false} onCheckedChange={v => f("is_active", v)} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">描述（可添加图片）</Label>
            <RichTextInput value={form.description || ""} onChange={v => f("description", v)}
              imageUrls={form.description_images || []} onImageUrls={urls => f("description_images", urls)}
              placeholder="运输方式说明..." rows={2} maxImages={3} />
          </div>

          <div className="flex gap-2 justify-between pt-1">
            {formMode === "edit" && (
              <button className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                onClick={handleDeleteMethod}>
                <Trash2 className="w-3 h-3" />删除
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handleCancel}>取消</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700"
                onClick={() => handleSaveForm(form)} disabled={saving}>
                <Save className="w-3 h-3 mr-1" />保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {companyModal && (
        <CompanyFormModal initial={companyModal.initial} onSave={persistCompany}
          onClose={() => setCompanyModal(null)} saving={saving} />
      )}
    </>
  );
}

// ─── 右侧：树状排序面板 ───────────────────────────────────────
export function LocalShippingTree({ state }) {
  const {
    companies, methods, activeMethod,
    handleSelectMethod, handleAddMethod,
    handleFlatListChange,
    deleteCompany, setCompanyModal, persistCompany,
  } = state;

  return (
    <ShippingCompanyTreePanel
      companies={companies}
      methods={methods}
      activeMethodId={activeMethod}
      onSelectMethod={handleSelectMethod}
      onAddCompany={(formData) => persistCompany(formData)}
      onEditCompany={(company) => setCompanyModal({ initial: { ...company } })}
      onDeleteCompany={deleteCompany}
      onAddMethod={handleAddMethod}
      onMethodsChange={(newMethods) => handleFlatListChange(companies, newMethods)}
      onCompaniesChange={(newCompanies) => handleFlatListChange(newCompanies, methods)}
    />
  );
}

// ─── 默认导出：兼容旧调用（独立使用时内置两列布局）────────────
export default function LocalShippingMethodManager() {
  const state = useLocalShipping();

  if (state.loading) {
    return <div className="py-8 text-center text-xs text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-700">日本本地运输方式</p>
        <p className="text-xs text-gray-400 mt-0.5">配置运输公司、宅配、自取等本地配送选项及排序分组</p>
      </div>
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0">
          <LocalShippingDetail state={state} />
        </div>
        <div className="flex-1 min-w-0">
          <LocalShippingTree state={state} />
        </div>
      </div>
    </div>
  );
}