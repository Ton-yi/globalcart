/**
 * useLocalShipping — shared state hook for local shipping management
 * Used by LocalShippingMethodDetail and ShippingCompanyTreePanel in AdminSettings
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const genId = () => Math.random().toString(36).slice(2, 10);

export const BLANK_METHOD = {
  name: "", trackable: false, fee_jpy: 0,
  description: "", description_images: [],
  company_id: null,
  sort_order: 0, indent: 0, is_active: true
};

export const BLANK_COMPANY = { name: "", logo_url: "", description: "" };

export function useLocalShipping() {
  const [companies, setCompanies] = useState([]);
  const [methods, setMethods] = useState([]);
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detail panel state
  const [activeMethod, setActiveMethod] = useState(null);
  const [formMode, setFormMode] = useState("edit");
  const [form, setForm] = useState({ ...BLANK_METHOD });

  // Company modal state
  const [companyModal, setCompanyModal] = useState(null);

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

  const persistCompany = async (company) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageLocalShipping", { action: "saveCompany", company });
      const saved = res.data.company;
      setCompanies(prev =>
        prev.find(c => c.id === saved.id)
          ? prev.map(c => c.id === saved.id ? saved : c)
          : [...prev, saved]
      );
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
      const updated = methods.map(m => m.company_id === companyId ? { ...m, company_id: null } : m);
      setMethods(updated);
      await base44.functions.invoke("manageLocalShipping", { action: "saveMethods", methods: updated, settingId });
      toast.success("运输公司已删除");
    } catch (e) {
      toast.error("删除失败: " + e.message);
    }
    setSaving(false);
  };

  const handleSelectMethod = (m) => {
    setActiveMethod(m.id);
    setForm({ ...BLANK_METHOD, ...m });
    setFormMode("edit");
  };

  const handleAddMethod = (companyId) => {
    setActiveMethod(null);
    // New methods start at sort_order -1 so they float to the top of their group
    setForm({ ...BLANK_METHOD, company_id: companyId, sort_order: -1 });
    setFormMode("add");
  };

  const handleSaveForm = async (formData) => {
    if (!formData.name?.trim()) { toast.error("请填写名称"); return; }
    let updatedMethods;
    if (formMode === "add") {
      updatedMethods = [...methods, { ...formData, id: genId() }];
    } else {
      updatedMethods = methods.map(m => m.id === activeMethod ? { ...formData } : m);
    }
    await persistMethods(updatedMethods);
    setActiveMethod(null);
    setForm({ ...BLANK_METHOD });
  };

  const handleDeleteMethod = async () => {
    if (!activeMethod) return;
    if (!confirm("确认删除此运输方式？")) return;
    await persistMethods(methods.filter(m => m.id !== activeMethod));
    setActiveMethod(null);
    setForm({ ...BLANK_METHOD });
  };

  const handleCancel = () => {
    setActiveMethod(null);
    setFormMode("edit");
    setForm({ ...BLANK_METHOD });
  };

  const handleMethodsChange = (newMethods) => {
    setMethods(newMethods);
    persistMethods(newMethods);
  };

  const handleCompaniesChange = async (newCompanies) => {
    setSaving(true);
    try {
      // Use bulk save — save all companies in parallel
      await Promise.all(newCompanies.map(c =>
        base44.functions.invoke("manageLocalShipping", { action: "saveCompany", company: c })
      ));
      setCompanies(newCompanies);
    } catch (e) {
      toast.error("排序保存失败: " + e.message);
    }
    setSaving(false);
  };

  /**
   * Called by ShippingCompanyTreePanel when the flat list changes (both companies and methods
   * may change together, e.g. after a reorder that spans both types).
   */
  const handleFlatListChange = async (newCompanies, newMethods) => {
    setSaving(true);
    try {
      await Promise.all([
        Promise.all(newCompanies.map(c =>
          base44.functions.invoke("manageLocalShipping", { action: "saveCompany", company: c })
        )),
        base44.functions.invoke("manageLocalShipping", { action: "saveMethods", methods: newMethods, settingId }),
      ]);
      setCompanies(newCompanies);
      setMethods(newMethods);
    } catch (e) {
      toast.error("排序保存失败: " + e.message);
    }
    setSaving(false);
  };

  return {
    companies, methods, loading, saving,
    activeMethod, formMode, form, setForm,
    companyModal, setCompanyModal,
    handleSelectMethod, handleAddMethod,
    handleSaveForm, handleDeleteMethod, handleCancel,
    handleMethodsChange, handleCompaniesChange, handleFlatListChange,
    persistCompany, deleteCompany,
    isFormOpen: activeMethod !== null || formMode === "add",
  };
}