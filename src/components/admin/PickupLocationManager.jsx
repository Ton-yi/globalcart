/**
 * PickupLocationManager
 * 自提地点管理 — Master-Detail 两列布局
 * 左侧：编辑表单  右侧：排序列表
 */
import { Plus, Trash2, Save, X, MapPin, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import RichTextInput from "@/components/common/RichTextInput";
import { usePickupLocations } from "@/hooks/usePickupLocations";

// ─── 左侧：编辑表单 ──────────────────────────────────────────
function PickupDetail({ state }) {
  const {
    isFormOpen, formMode, form, setForm, saving,
    handleSave, handleDelete, handleCancel,
    handleAdd,
  } = state;

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      {!isFormOpen ? (
        <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3">
          <p className="text-xs text-gray-400">点击右侧自提地点条目进行编辑</p>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 h-7 text-xs" onClick={handleAdd}>
            <Plus className="w-3 h-3 mr-1" />新增自提地点
          </Button>
        </div>
      ) : (
        <div className="border border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              {formMode === "add" ? "新增自提地点" : "编辑自提地点"}
            </p>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">地点名称 *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.name || ""}
                onChange={e => f("name", e.target.value)} placeholder="东京自取点" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">手续费（JPY）</Label>
              <Input type="number" className="mt-1 h-8 text-sm"
                value={form.fee_jpy === 0 ? "" : (form.fee_jpy ?? "")}
                onChange={e => f("fee_jpy", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                placeholder="0" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500 flex-shrink-0">启用</Label>
            <Switch checked={form.is_active !== false} onCheckedChange={v => f("is_active", v)} />
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">描述（可添加图片）</Label>
            <RichTextInput
              value={form.description || ""}
              onChange={v => f("description", v)}
              imageUrls={form.description_images || []}
              onImageUrls={urls => f("description_images", urls)}
              placeholder="地点说明、交通方式、营业时间..."
              rows={2}
              maxImages={3}
            />
          </div>

          <div className="flex gap-2 justify-between pt-1">
            {formMode === "edit" && (
              <button className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                onClick={handleDelete}>
                <Trash2 className="w-3 h-3" />删除
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handleCancel}>取消</Button>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700"
                onClick={() => handleSave(form)} disabled={saving}>
                <Save className="w-3 h-3 mr-1" />保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── 右侧：排序列表 ──────────────────────────────────────────
function PickupTree({ state }) {
  const { locations, activeId, handleSelect, handleAdd, handleReorder, handleToggleVisibility } = state;

  const sorted = [...locations].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-purple-500" />自提地点排序
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAdd}>
          <Plus className="w-3 h-3 mr-1" />新增
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-6 border border-dashed border-gray-200 rounded-xl">
          暂无自提地点
        </p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {sorted.map((loc, idx) => {
            const isActive = loc.is_active !== false;
            const isSelected = loc.id === activeId;
            return (
              <div
                key={loc.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group border-b last:border-b-0 border-gray-100
                  ${isSelected ? "bg-purple-50 border-purple-200" : "hover:bg-gray-50"}
                  ${!isActive ? "opacity-50" : ""}
                `}
                onClick={() => handleSelect(loc)}
              >
                <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className={`flex-1 text-xs truncate ${isSelected ? "font-semibold text-purple-700" : "text-gray-700"}`}>
                  {loc.name || <span className="text-gray-400 italic">未命名</span>}
                </span>
                {loc.fee_jpy > 0 && (
                  <span className="text-xs text-purple-500 flex-shrink-0">¥{loc.fee_jpy}</span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => handleReorder(loc.id, "up")}
                    title="上移"
                  ><ChevronUp className="w-3 h-3" /></button>
                  <button
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    disabled={idx === sorted.length - 1}
                    onClick={() => handleReorder(loc.id, "down")}
                    title="下移"
                  ><ChevronDown className="w-3 h-3" /></button>
                  <button
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                    onClick={() => handleToggleVisibility(loc.id)}
                    title={isActive ? "隐藏" : "显示"}
                  >{isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 默认导出：两列布局 ──────────────────────────────────────
export default function PickupLocationManager() {
  const state = usePickupLocations();

  if (state.loading) {
    return <p className="text-xs text-gray-400 py-4 text-center">加载中...</p>;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0">
        <PickupDetail state={state} />
      </div>
      <div className="flex-1 min-w-0">
        <PickupTree state={state} />
      </div>
    </div>
  );
}