/**
 * usePickupLocations — 自提地点独立状态 hook
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const genId = () => Math.random().toString(36).slice(2, 10);

export const BLANK_PICKUP = {
  name: "", fee_jpy: 0,
  description: "", description_images: [],
  sort_order: 0, is_active: true
};

export function usePickupLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Detail panel state
  const [activeId, setActiveId] = useState(null);
  const [formMode, setFormMode] = useState("edit");
  const [form, setForm] = useState({ ...BLANK_PICKUP });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageLocalShipping", { action: "listPickupLocations" });
      setLocations(res.data.locations || []);
    } catch (e) {
      toast.error("加载自提地点失败: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = (loc) => {
    setActiveId(loc.id);
    setForm({ ...BLANK_PICKUP, ...loc });
    setFormMode("edit");
  };

  const handleAdd = () => {
    setActiveId(null);
    setForm({ ...BLANK_PICKUP, sort_order: -1 });
    setFormMode("add");
  };

  const handleCancel = () => {
    setActiveId(null);
    setFormMode("edit");
    setForm({ ...BLANK_PICKUP });
  };

  const handleSave = async (formData) => {
    if (!formData.name?.trim()) { toast.error("请填写地点名称"); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageLocalShipping", {
        action: "savePickupLocation",
        location: formMode === "add" ? formData : { ...formData, id: activeId }
      });
      const saved = res.data.location;
      setLocations(prev =>
        prev.find(l => l.id === saved.id)
          ? prev.map(l => l.id === saved.id ? saved : l)
          : [...prev, saved]
      );
      toast.success("自提地点已保存");
      setActiveId(null);
      setFormMode("edit");
      setForm({ ...BLANK_PICKUP });
    } catch (e) {
      toast.error("保存失败: " + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!activeId) return;
    if (!confirm("确认删除此自提地点？")) return;
    setSaving(true);
    try {
      await base44.functions.invoke("manageLocalShipping", { action: "deletePickupLocation", locationId: activeId });
      setLocations(prev => prev.filter(l => l.id !== activeId));
      toast.success("已删除");
      setActiveId(null);
      setFormMode("edit");
      setForm({ ...BLANK_PICKUP });
    } catch (e) {
      toast.error("删除失败: " + e.message);
    }
    setSaving(false);
  };

  const handleReorder = async (locationId, direction) => {
    const sorted = [...locations].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex(x => x.id === locationId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = sorted.map((x, i) => {
      if (i === idx) return { ...x, sort_order: swapIdx };
      if (i === swapIdx) return { ...x, sort_order: idx };
      return { ...x, sort_order: i };
    }).sort((a, b) => a.sort_order - b.sort_order).map((x, i) => ({ ...x, sort_order: i }));
    setLocations(reordered);
    setSaving(true);
    try {
      await Promise.all(reordered.map(l =>
        base44.functions.invoke("manageLocalShipping", { action: "savePickupLocation", location: l })
      ));
    } catch (e) {
      toast.error("排序保存失败: " + e.message);
      load();
    }
    setSaving(false);
  };

  const handleToggleVisibility = async (locationId) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return;
    const updated = { ...loc, is_active: !(loc.is_active !== false) };
    setLocations(prev => prev.map(l => l.id === locationId ? updated : l));
    await base44.functions.invoke("manageLocalShipping", { action: "savePickupLocation", location: updated });
  };

  return {
    locations, loading, saving,
    activeId, formMode, form, setForm,
    isFormOpen: activeId !== null || formMode === "add",
    handleSelect, handleAdd, handleCancel, handleSave, handleDelete,
    handleReorder, handleToggleVisibility,
  };
}