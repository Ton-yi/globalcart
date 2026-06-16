/**
 * OnlineStoreTagRuleDetail
 * Left-side detail panel for editing store tag rules.
 */
import { useState } from "react";
import { Save, X, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const PRESET_COLORS = [
  { label: "灰色", value: "bg-gray-100 text-gray-700" },
  { label: "蓝色", value: "bg-blue-100 text-blue-700" },
  { label: "红色", value: "bg-red-100 text-red-700" },
  { label: "绿色", value: "bg-green-100 text-green-700" },
  { label: "黄色", value: "bg-yellow-100 text-yellow-700" },
  { label: "紫色", value: "bg-purple-100 text-purple-700" },
  { label: "橙色", value: "bg-orange-100 text-orange-700" },
  { label: "粉色", value: "bg-pink-100 text-pink-700" },
];

const BLANK_RULE = {
  keyword: "",
  tag_label: "",
  tag_color: "bg-gray-100 text-gray-700",
  priority: 0,
  is_active: true,
};

export default function OnlineStoreTagRuleDetail({ state }) {
  const {
    isFormOpen, formMode, form, setForm, saving,
    handleSaveForm, handleDeleteRule, handleCancel,
  } = state;

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [customColor, setCustomColor] = useState("");

  if (!isFormOpen) {
    return (
      <div className="space-y-3">
        <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3">
          <p className="text-xs text-gray-400">点击右侧规则条目进行编辑</p>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 h-7 text-xs"
            onClick={() => state.handleAddRule()}>
            <Plus className="w-3 h-3 mr-1" />新增规则
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          {formMode === "add" ? "新增规则" : "编辑规则"}
        </p>
        <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-gray-500">关键字 *</Label>
          <Input className="mt-1 h-8 text-sm" value={form.keyword || ""}
            onChange={e => f("keyword", e.target.value)} placeholder="例：suruga-ya.jp" />
          <p className="text-xs text-gray-400 mt-1">URL 中包含此关键字时应用此标签</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">优先级</Label>
          <Input type="number" className="mt-1 h-8 text-sm"
            value={form.priority ?? 0}
            onChange={e => f("priority", parseInt(e.target.value) || 0)}
            placeholder="0" />
          <p className="text-xs text-gray-400 mt-1">数字越大优先级越高</p>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">标签名称 *</Label>
        <Input className="mt-1 h-8 text-sm" value={form.tag_label || ""}
          onChange={e => f("tag_label", e.target.value)} placeholder="例：駿河屋" />
      </div>

      <div>
        <Label className="text-xs text-gray-500 mb-1.5 block">标签颜色</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                form.tag_color === c.value
                  ? "ring-2 ring-orange-400 ring-offset-1"
                  : "hover:opacity-80"
              } ${c.value}`}
              onClick={() => f("tag_color", c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Input
            className="h-7 text-xs flex-1"
            value={customColor}
            onChange={e => setCustomColor(e.target.value)}
            placeholder="或输入自定义颜色类名..."
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => customColor && f("tag_color", customColor)}
            disabled={!customColor.trim()}
          >
            应用
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">预览：</span>
          <Badge className={form.tag_color || "bg-gray-100 text-gray-700"}>
            {form.tag_label || "标签预览"}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-500 flex-shrink-0">启用规则</Label>
        <Switch checked={form.is_active !== false} onCheckedChange={v => f("is_active", v)} />
        <span className="text-xs text-gray-400">{form.is_active !== false ? "已启用" : "已禁用"}</span>
      </div>

      <div className="flex gap-2 justify-between pt-1">
        {formMode === "edit" && (
          <button className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
            onClick={handleDeleteRule}>
            <Trash2 className="w-3 h-3" />删除规则
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
  );
}