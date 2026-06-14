/**
 * LocalShippingMethodManager — Master-Detail Layout
 *
 * 左侧（Detail）：本地运输方式详细编辑表单（点击右侧条目后激活）
 * 右侧（Master）：运输公司树状排序面板（ShippingCompanyTreePanel）
 *
 * 数据通过 manageLocalShipping 后端函数统一管理（tenant-safe）
 * 运输方式通过 SiteSettings 存储，运输公司通过 ShippingCompany 实体存储
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Plus, Trash2, MapPin, Save, X, Building2, ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import RichTextInput from "@/components/common/RichTextInput";
import ShippingCompanyTreePanel from "@/components/admin/ShippingCompanyTreePanel";

const genId = () => Math.random().toString(36).slice(2, 10);
const BLANK_METHOD = { name: "", trackable: false, fee_jpy: 0, description: "", description_images: [], pickup_locations: [], company_id: null, sort_order: 0, indent: 0, is_active: true };
const BLANK_COMPANY = { name: "", logo_url: "", description: "" };

// ─── 自提地点编辑行 ──────────────────────────────────────────
function PickupLocationRow({ loc, onChange, onDelete }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-500">地点名称 *</Label>
          <Input
            className="mt-1 h-7 text-xs"
            value={loc.name || ""}
            onChange={e => onChange({ ...loc, name: e.target.value })}
            placeholder="东京自取点"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">费用（JPY）</Label>
          <Input
            type="number"
            className="mt-1 h-7 text-xs"
            value={loc.fee_jpy === 0 ? "" : (loc.fee_jpy ?? "")}
            onChange={e => onChange({ ...loc, fee_jpy: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-500">描述（可添加图片）</Label>
        <div className="mt-1">
          <RichTextInput
            value={loc.description || ""}
            onChange={v => onChange({ ...loc, description: v })}
            imageUrls={loc.description_images || []}
            onImageUrls={urls => onChange({ ...loc, description_images: urls })}
            placeholder="地点说明、交通方式、营业时间..."
            rows={2}
            maxImages={3}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onDelete} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600">
          <Trash2 className="w-3 h-3" />删除此地点
        </button>
      </div>
    </div>
  );
}

// ─── 运输公司录入弹窗 ─────────────────────────────────────────
function CompanyFormModal({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({ ...BLANK_COMPANY, ...initial });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // If user pastes an image url via name RichTextInput, extract it as logo
  const handleNameChange = (val) => {
    // val might be plain text; logo handled via separate uploader
    f("name", val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            {initial?.id ? "编辑运输公司" : "添加运输公司"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">公司名称 *</Label>
            <Input
              className="h-8 text-sm"
              value={form.name}
              onChange={e => f("name", e.target.value)}
              placeholder="ヤマト運輸"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Logo URL（可选）</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs flex-1"
                value={form.logo_url || ""}
                onChange={e => f("logo_url", e.target.value)}
                placeholder="https://..."
              />
              {form.logo_url && (
                <img src={form.logo_url} alt="logo" className="w-8 h-8 object-contain rounded border border-gray-200 flex-shrink-0" />
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">描述（纯文本）</Label>
            <Textarea
              className="text-sm resize-none"
              rows={3}
              value={form.description || ""}
              onChange={e => f("description", e.target.value)}
              placeholder="运输公司简介..."
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!form.name.trim() || saving}
            onClick={() => onSave(form)}
          >
            {initial?.id ? "保存更改" : "创建"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────
export default function LocalShippingMethodManager() {
  const [companies, setCompanies] = useState([]);
  const [methods, setMethods] = useState([]);
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detail panel state
  const [activeMethod, setActiveMethod] = useState(null); // null = collapsed
  const [formMode, setFormMode] = useState("edit"); // "edit" | "add"
  const [form, setForm] = useState({ ...BLANK_METHOD });

  // Company modal state
  const [companyModal, setCompanyModal] = useState(null); // null | { initial }

  // ── Load ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageLocalShipping", { action: "listAll" });
      setCompanies(res.data.companies || []);
      setMethods(res.data.methods || []);
      setSettingId(res.data.settingId || null);
    } catch (e) {
      toast.error("加载失败: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Persist methods ───────────────────────────────────────
  const persistMethods = async (updatedMethods) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageLocalShipping", {
        action: "saveMethods",
        methods: updatedMethods,
        settingId
      });
      if (res.data.settingId && !settingId) setSettingId(res.data.settingId);
      setMethods(updatedMethods);
      toast.success("运输方式已保存");
    } catch (e) {
      toast.error("保存失败: " + e.message);
    }
    setSaving(false);
  };

  // ── Persist companies ─────────────────────────────────────
  const persistCompany = async (company) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageLocalShipping", { action: "saveCompany", company });
      const saved = res.data.company;
      setCompanies(prev => {
        if (prev.find(c => c.id === saved.id)) return prev.map(c => c.id === saved.id ? saved : c);
        return [...prev, saved];
      });
      toast.success("运输公司已保存");
      setCompanyModal(null);
    } catch (e) {
      toast.error("保存失败: " + e.message);
    }
    setSaving(false);
  };

  const deleteCompany = async (companyId) => {
    if (!confirm("确认删除此运输公司？其下的运输方式将变为未分组。")) return;
    setSaving(true);
    try {
      await base44.functions.invoke("manageLocalShipping", { action: "deleteCompany", companyId });
      setCompanies(prev => prev.filter(c => c.id !== companyId));
      // Ungroup methods under this company
      const updated = methods.map(m => m.company_id === companyId ? { ...m, company_id: null } : m);
      setMethods(updated);
      await base44.functions.invoke("manageLocalShipping", { action: "saveMethods", methods: updated, settingId });
      toast.success("运输公司已删除");
    } catch (e) {
      toast.error("删除失败: " + e.message);
    }
    setSaving(false);
  };

  // ── Detail form actions ───────────────────────────────────
  const handleSelectMethod = (m) => {
    setActiveMethod(m.id);
    setForm({ ...BLANK_METHOD, ...m });
    setFormMode("edit");
  };

  const handleAddMethod = (companyId) => {
    setActiveMethod(null);
    setForm({ ...BLANK_METHOD, company_id: companyId });
    setFormMode("add");
  };

  const handleSaveForm = async () => {
    if (!form.name?.trim()) { toast.error("请填写名称"); return; }
    let updatedMethods;
    if (formMode === "add") {
      const created = { ...form, id: genId() };
      updatedMethods = [...methods, created];
    } else {
      updatedMethods = methods.map(m => m.id === activeMethod ? { ...form } : m);
    }
    await persistMethods(updatedMethods);
    setActiveMethod(null);
    setForm({ ...BLANK_METHOD });
  };

  const handleDeleteMethod = async () => {
    if (!activeMethod) return;
    if (!confirm("确认删除此运输方式？")) return;
    const updatedMethods = methods.filter(m => m.id !== activeMethod);
    await persistMethods(updatedMethods);
    setActiveMethod(null);
    setForm({ ...BLANK_METHOD });
  };

  const handleCancel = () => {
    setActiveMethod(null);
    setForm({ ...BLANK_METHOD });
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addPickupLocation = () => {
    f("pickup_locations", [
      ...(form.pickup_locations || []),
      { id: genId(), name: "", fee_jpy: 0, description: "", description_images: [] }
    ]);
  };

  const updatePickupLocation = (idx, updated) => {
    const arr = [...(form.pickup_locations || [])];
    arr[idx] = updated;
    f("pickup_locations", arr);
  };

  const deletePickupLocation = (idx) => {
    f("pickup_locations", (form.pickup_locations || []).filter((_, i) => i !== idx));
  };

  // ── Handle tree panel method/company changes ──────────────
  const handleMethodsChange = (newMethods) => {
    setMethods(newMethods);
    // Immediate persist for tree operations
    persistMethods(newMethods);
  };

  const handleCompaniesChange = async (newCompanies) => {
    // Persist sort_order changes for all companies
    setSaving(true);
    try {
      await Promise.all(newCompanies.map(c =>
        base44.functions.invoke("manageLocalShipping", { action: "saveCompany", company: c })
      ));
      setCompanies(newCompanies);
    } catch (e) {
      toast.error("排序保存失败: " + e.message);
    }
    setSaving(false);
  };

  const isFormOpen = activeMethod !== null || formMode === "add";

  if (loading) {
    return <div className="py-8 text-center text-xs text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-700">日本本地运输方式</p>
        <p className="text-xs text-gray-400 mt-0.5">配置运输公司、宅配、自取等本地配送选项及排序分组</p>
      </div>

      <div className="grid grid-cols-5 gap-4 items-start">
        {/* ── 左侧：Detail 编辑表单 ── */}
        <div className="col-span-2">
          {!isFormOpen ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-2">
              <p className="text-xs text-gray-400">点击右侧运输方式条目进行编辑，</p>
              <p className="text-xs text-gray-400">或点击"＋添加运输方式"新建</p>
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

              {/* 两列基本信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">名称 *</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={form.name || ""}
                    onChange={e => f("name", e.target.value)}
                    placeholder="宅急便"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">料金（JPY）</Label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={form.fee_jpy === 0 ? "" : (form.fee_jpy ?? "")}
                    onChange={e => f("fee_jpy", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
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
                <RichTextInput
                  value={form.description || ""}
                  onChange={v => f("description", v)}
                  imageUrls={form.description_images || []}
                  onImageUrls={urls => f("description_images", urls)}
                  placeholder="运输方式说明..."
                  rows={2}
                  maxImages={3}
                />
              </div>

              {/* 自提地点 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-500" />自提地点设定
                  </Label>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={addPickupLocation}>
                    <Plus className="w-3 h-3 mr-1" />添加地点
                  </Button>
                </div>
                {(form.pickup_locations || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1">暂无自提地点</p>
                ) : (
                  (form.pickup_locations || []).map((loc, idx) => (
                    <PickupLocationRow
                      key={loc.id || idx}
                      loc={loc}
                      onChange={updated => updatePickupLocation(idx, updated)}
                      onDelete={() => deletePickupLocation(idx)}
                    />
                  ))
                )}
              </div>

              <div className="flex gap-2 justify-between pt-1">
                {formMode === "edit" && (
                  <button
                    className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    onClick={handleDeleteMethod}
                  >
                    <Trash2 className="w-3 h-3" />删除
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={handleCancel}>取消</Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleSaveForm}
                    disabled={saving}
                  >
                    <Save className="w-3 h-3 mr-1" />保存
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 右侧：Master 树状面板 ── */}
        <div className="col-span-3">
          <ShippingCompanyTreePanel
            companies={companies}
            methods={methods}
            activeMethodId={activeMethod}
            onSelectMethod={handleSelectMethod}
            onAddCompany={() => setCompanyModal({ initial: { ...BLANK_COMPANY } })}
            onEditCompany={(company) => setCompanyModal({ initial: { ...company } })}
            onDeleteCompany={deleteCompany}
            onAddMethod={handleAddMethod}
            onMethodsChange={handleMethodsChange}
            onCompaniesChange={handleCompaniesChange}
          />
        </div>
      </div>

      {/* 运输公司 Modal */}
      {companyModal && (
        <CompanyFormModal
          initial={companyModal.initial}
          onSave={persistCompany}
          onClose={() => setCompanyModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}