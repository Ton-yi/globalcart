/**
 * LocalShippingMethodManager — 日本本地运输方式 & 自提地点管理
 * 存储于 SiteSettings，key = "local_shipping_methods_config"
 * 数据结构：
 *   [{
 *     id, name, trackable, fee_jpy, description,
 *     pickup_locations: [{ id, name, fee_jpy, description }]
 *   }]
 */
import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Check, MapPin, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import RichTextInput from "@/components/common/RichTextInput";

const genId = () => Math.random().toString(36).slice(2, 10);

// ─── 自提地点编辑行 ──────────────────────────────────────────
function PickupLocationRow({ loc, onChange, onDelete }) {
  const [descImages, setDescImages] = useState([]);

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
            value={loc.fee_jpy ?? ""}
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

// ─── 运输方式卡片 ────────────────────────────────────────────
function MethodCard({ method, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...method });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error("请填写名称"); return; }
    onChange(form);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...method });
    setEditing(false);
  };

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

  // Keep form synced when parent changes (e.g. after reload)
  useEffect(() => {
    if (!editing) setForm({ ...method });
  }, [method]);

  const pickupCount = (method.pickup_locations || []).length;

  return (
    <div className={`border rounded-xl overflow-hidden ${method.is_active !== false ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold flex-shrink-0">
          {(method.name || "?")[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{method.name}</span>
            {method.fee_jpy > 0 && (
              <Badge className="text-xs bg-orange-100 text-orange-700">¥{method.fee_jpy} JPY</Badge>
            )}
            {method.fee_jpy === 0 && (
              <Badge className="text-xs bg-green-100 text-green-700">免费</Badge>
            )}
            <Badge className={`text-xs ${method.trackable ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
              {method.trackable ? "可追跡" : "不可追跡"}
            </Badge>
            {pickupCount > 0 && (
              <Badge className="text-xs bg-purple-100 text-purple-700">
                <MapPin className="w-2.5 h-2.5 mr-0.5" />{pickupCount} 个自提地点
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={method.is_active !== false}
            onCheckedChange={v => onChange({ ...method, is_active: v })}
          />
          <button
            onClick={() => { setEditing(!editing); setExpanded(true); }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(method.id)}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
          {editing ? (
            <>
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">名称 *</Label>
                  <Input className="mt-1 h-8 text-sm" value={form.name || ""} onChange={e => f("name", e.target.value)} placeholder="宅急便" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">料金（JPY）</Label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={form.fee_jpy ?? ""}
                    onChange={e => f("fee_jpy", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-xs text-gray-500">追跡可否</Label>
                <Switch checked={!!form.trackable} onCheckedChange={v => f("trackable", v)} />
                <span className="text-xs text-gray-500">{form.trackable ? "可追跡" : "不可追跡"}</span>
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
                  <p className="text-xs text-gray-400 italic py-1">暂无自提地点，点击"添加地点"新增</p>
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

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={handleCancel}>取消</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSave}>
                  <Save className="w-3 h-3 mr-1" />保存
                </Button>
              </div>
            </>
          ) : (
            // Read-only view
            <div className="space-y-2 text-sm text-gray-700">
              {method.description && (
                <p className="text-gray-600 text-xs whitespace-pre-wrap">{method.description}</p>
              )}
              {pickupCount > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">自提地点（{pickupCount}）</p>
                  <div className="space-y-1.5">
                    {(method.pickup_locations || []).map((loc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white border border-gray-100 rounded-lg px-3 py-2">
                        <MapPin className="w-3 h-3 text-purple-400 flex-shrink-0" />
                        <span className="font-medium text-gray-700">{loc.name}</span>
                        {loc.fee_jpy > 0
                          ? <Badge className="text-xs bg-orange-100 text-orange-700 ml-auto">¥{loc.fee_jpy}</Badge>
                          : <Badge className="text-xs bg-green-100 text-green-700 ml-auto">免费</Badge>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────
const SETTING_KEY = "local_shipping_methods_config";

export default function LocalShippingMethodManager({ settings = [], onReload }) {
  const [methods, setMethods] = useState([]);
  const [settingId, setSettingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", trackable: false, fee_jpy: 0, description: "", description_images: [], pickup_locations: [] });

  // Load from settings prop
  useEffect(() => {
    const s = settings.find(x => x.key === SETTING_KEY);
    if (s) {
      setSettingId(s.id);
      try {
        const parsed = JSON.parse(s.value);
        if (Array.isArray(parsed)) setMethods(parsed);
      } catch { setMethods([]); }
    } else {
      setSettingId(null);
      setMethods([]);
    }
  }, [settings]);

  const persist = async (updated) => {
    setSaving(true);
    const value = JSON.stringify(updated);
    try {
      if (settingId) {
        await tenantEntity.update('SiteSettings', settingId, { value });
      } else {
        const created = await tenantEntity.create('SiteSettings', {
          key: SETTING_KEY,
          value,
          description: '日本本地运输方式配置（JSON）',
          category: 'shipping'
        });
        setSettingId(created.id);
      }
      setMethods(updated);
      toast.success("保存成功");
    } catch {
      toast.error("保存失败，请重试");
    }
    setSaving(false);
  };

  const handleChange = (updated) => {
    const next = methods.map(m => m.id === updated.id ? updated : m);
    persist(next);
  };

  const handleDelete = (id) => {
    if (!confirm("确认删除此本地运输方式？")) return;
    persist(methods.filter(m => m.id !== id));
  };

  const handleAddNew = () => {
    if (!newForm.name?.trim()) { toast.error("请填写名称"); return; }
    const created = { ...newForm, id: genId() };
    persist([...methods, created]);
    setNewForm({ name: "", trackable: false, fee_jpy: 0, description: "", description_images: [], pickup_locations: [] });
    setShowAdd(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">日本本地运输方式</p>
          <p className="text-xs text-gray-400 mt-0.5">配置宅配、自取等本地配送选项，可在自提地点设置多个自取点</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />添加本地运输方式
        </Button>
      </div>

      {/* 新增表单 */}
      {showAdd && (
        <div className="border border-dashed border-orange-300 rounded-xl p-4 space-y-3 bg-orange-50">
          <p className="text-xs font-medium text-gray-600">新增本地运输方式</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">名称 *</Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={newForm.name}
                onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder="宅急便"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">料金（JPY）</Label>
              <Input
                type="number"
                className="mt-1 h-8 text-sm"
                value={newForm.fee_jpy}
                onChange={e => setNewForm(p => ({ ...p, fee_jpy: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs text-gray-500">追跡可否</Label>
            <Switch
              checked={newForm.trackable}
              onCheckedChange={v => setNewForm(p => ({ ...p, trackable: v }))}
            />
            <span className="text-xs text-gray-500">{newForm.trackable ? "可追跡" : "不可追跡"}</span>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>取消</Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleAddNew}
              disabled={!newForm.name.trim() || saving}
            >
              添加
            </Button>
          </div>
        </div>
      )}

      {methods.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400 italic py-3 text-center">暂无本地运输方式，点击"添加"新增</p>
      )}

      {methods.map(m => (
        <MethodCard
          key={m.id}
          method={m}
          onChange={handleChange}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}