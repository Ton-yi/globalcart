/**
 * usePickupLocations — 自提地点独立状态 hook
 * 排序/显隐在前端操作，点击保存后才写入后端。
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
  const [locations, setLocations] = useState([]);       // authoritative (from server)
  const [localOrder, setLocalOrder] = useState([]);     // local draft for sorting
  const [orderDirty, setOrderDirty] = useState(false);
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
      const locs = res.data.locations || [];
      setLocations(locs);
      setLocalOrder([...locs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setOrderDirty(false);
    } catch (e) {
      toast.error("加载自提地点失败: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Detail form handlers ────────────────────────────────
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
      const newLocs = locations.find(l => l.id === saved.id)
        ? locations.map(l => l.id === saved.id ? saved : l)
        : [...locations, saved];
      setLocations(newLocs);
      setLocalOrder([...newLocs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setOrderDirty(false);
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
      const newLocs = locations.filter(l => l.id !== activeId);
      setLocations(newLocs);
      setLocalOrder([...newLocs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setOrderDirty(false);
      toast.success("已删除");
      setActiveId(null);
      setFormMode("edit");
      setForm({ ...BLANK_PICKUP });
    } catch (e) {
      toast.error("删除失败: " + e.message);
    }
    setSaving(false);
  };

  // ── Local-only sort/visibility (no backend call until saveOrder) ──
  const handleReorder = (locationId, direction) => {
    setLocalOrder(prev => {
      const list = [...prev];
      const idx = list.findIndex(x => x.id === locationId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return prev;
      [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
      return list.map((x, i) => ({ ...x, sort_order: i }));
    });
    setOrderDirty(true);
  };

  const handleToggleVisibility = (locationId) => {
    setLocalOrder(prev =>
      prev.map(l => l.id === locationId ? { ...l, is_active: !(l.is_active !== false) } : l)
    );
    setOrderDirty(true);
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      await Promise.all(localOrder.map(l =>
        base44.functions.invoke("manageLocalShipping", { action: "savePickupLocation", location: l })
      ));
      setLocations([...localOrder]);
      setOrderDirty(false);
      toast.success("排序已保存");
    } catch (e) {
      toast.error("排序保存失败: " + e.message);
      load();
    }
    setSaving(false);
  };

  return {
    locations: localOrder,
    loading, saving, orderDirty,
    activeId, formMode, form, setForm,
    isFormOpen: activeId !== null || formMode === "add",
    handleSelect, handleAdd, handleCancel, handleSave, handleDelete,
    handleReorder, handleToggleVisibility, handleSaveOrder,
  };
}