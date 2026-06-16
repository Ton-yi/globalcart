/**
 * useOnlineStoreTagRules — shared state hook for online store tag rule management
 * Used by OnlineStoreTagRuleDetail and OnlineStoreTagRulePanel
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export const BLANK_RULE = {
  keyword: "",
  tag_label: "",
  tag_color: "bg-gray-100 text-gray-700",
  is_active: true,
  priority: 0,
};

export function useOnlineStoreTagRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detail panel state
  const [activeRule, setActiveRule] = useState(null);
  const [formMode, setFormMode] = useState("edit");
  const [form, setForm] = useState({ ...BLANK_RULE });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getTenantConfigData", {});
      const fetchedRules = res.data.storeTagRules || [];
      setRules(fetchedRules);
    } catch (e) {
      toast.error("加载失败：" + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const persistRules = async (updatedRules) => {
    setSaving(true);
    try {
      await base44.functions.invoke("manageOnlineStoreTagRules", { action: "save", rules: updatedRules });
      setRules(updatedRules);
      toast.success("规则已保存");
    } catch (e) {
      toast.error("保存失败：" + e.message);
    }
    setSaving(false);
  };

  const handleSelectRule = (rule) => {
    setActiveRule(rule.id);
    setForm({ ...BLANK_RULE, ...rule });
    setFormMode("edit");
  };

  const handleAddRule = () => {
    setActiveRule(null);
    setForm({ ...BLANK_RULE, priority: rules.length > 0 ? Math.max(...rules.map(r => r.priority || 0)) + 1 : 1 });
    setFormMode("add");
  };

  const handleSaveForm = async (formData) => {
    if (!formData.keyword?.trim() || !formData.tag_label?.trim()) {
      toast.error("请填写关键字和标签名称");
      return;
    }
    let updatedRules;
    if (formMode === "add") {
      updatedRules = [...rules, { ...formData, id: Math.random().toString(36).slice(2, 10) }];
    } else {
      updatedRules = rules.map(r => r.id === activeRule ? { ...formData } : r);
    }
    await persistRules(updatedRules);
    setActiveRule(null);
    setForm({ ...BLANK_RULE });
  };

  const handleDeleteRule = () => {
    if (!activeRule) return;
    if (!confirm("确认删除此规则？")) return;
    const updated = rules.filter(r => r.id !== activeRule);
    setRules(updated);
    setActiveRule(null);
    setForm({ ...BLANK_RULE });
  };

  const handleCancel = () => {
    setActiveRule(null);
    setFormMode("edit");
    setForm({ ...BLANK_RULE });
  };

  const handleToggleActive = (ruleId) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, is_active: !r.is_active } : r);
    setRules(updated);
  };

  const handleMoveRule = (index, direction) => {
    const newRules = [...rules];
    const temp = newRules[index];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newRules.length) return;
    
    // Swap priorities
    const tempPriority = temp.priority;
    temp.priority = newRules[swapIndex].priority;
    newRules[swapIndex].priority = tempPriority;
    
    // Reorder array
    newRules.splice(index, 1);
    newRules.splice(swapIndex, 0, temp);
    
    setRules(newRules);
  };

  return {
    rules, loading, saving,
    activeRule, formMode, form, setForm,
    handleSelectRule, handleAddRule,
    handleSaveForm, handleDeleteRule, handleDeleteRuleById: handleDeleteRule,
    handleCancel, handleToggleActive, handleMoveRule,
    isFormOpen: activeRule !== null || formMode === "add",
  };
}