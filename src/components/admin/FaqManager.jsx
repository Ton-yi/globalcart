import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, HelpCircle, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

function genId() { return `faq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

const DEFAULT_FAQ = {
  unified: true,
  guest:  { visible: true, title: "常见问题", items: [] },
  user:   { visible: true, title: "常见问题", items: [] },
  admin:  { visible: false, title: "常见问题", items: [] },
};

const AUDIENCE_TABS = [
  { key: "guest", label: "未登录用户" },
  { key: "user",  label: "登录用户" },
  { key: "admin", label: "管理员" },
];

function migrateConfig(raw) {
  if (!raw) return DEFAULT_FAQ;
  if ("guest" in raw || "user" in raw || "admin" in raw) {
    return {
      unified: raw.unified ?? false,
      guest: { ...DEFAULT_FAQ.guest, ...(raw.guest || {}) },
      user:  { ...DEFAULT_FAQ.user,  ...(raw.user  || {}) },
      admin: { ...DEFAULT_FAQ.admin, ...(raw.admin || {}) },
    };
  }
  return DEFAULT_FAQ;
}

function FaqItemEditor({ item, idx, total, onChange, onDelete, onMoveUp, onMoveDown }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-500 flex-1 truncate">Q{idx + 1}：{item.question || "（无问题）"}</span>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={idx === total - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="p-0.5 text-gray-400 hover:text-gray-600">
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete} className="p-0.5 text-red-400 hover:text-red-600 ml-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-3 space-y-2">
          <div>
            <Label className="text-xs text-gray-500">问题</Label>
            <Input className="mt-0.5 h-8 text-sm" value={item.question || ""}
              onChange={e => onChange({ ...item, question: e.target.value })} placeholder="用户常见的问题…" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">答案</Label>
            <Textarea className="mt-0.5 text-sm" rows={3} value={item.answer || ""}
              onChange={e => onChange({ ...item, answer: e.target.value })} placeholder="详细解答…" />
          </div>
        </div>
      )}
    </div>
  );
}

function AudiencePanel({ form, onChange }) {
  const f = (k, v) => onChange({ ...form, [k]: v });

  const updateItem = (i, val) => {
    const items = form.items.map((it, idx) => idx === i ? val : it);
    f("items", items);
  };
  const addItem = () => f("items", [...(form.items || []), { _id: genId(), question: "", answer: "" }]);
  const removeItem = (i) => f("items", form.items.filter((_, idx) => idx !== i));
  const moveItem = (i, dir) => {
    const arr = [...(form.items || [])];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    f("items", arr);
  };

  return (
    <div className="space-y-4">
      {/* 显示开关 */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => f("visible", !form.visible)}>
        <Checkbox checked={!!form.visible} onCheckedChange={v => f("visible", !!v)} />
        <span className="text-xs text-gray-600 select-none">显示此区块</span>
      </div>

      {form.visible && (
        <>
          <div>
            <Label className="text-xs text-gray-500">区块标题</Label>
            <Input className="mt-0.5 h-8 text-sm" value={form.title || ""}
              onChange={e => f("title", e.target.value)} placeholder="常见问题" />
          </div>

          <div className="space-y-2">
            {(form.items || []).map((item, i) => (
              <FaqItemEditor
                key={item._id || i}
                item={item} idx={i} total={(form.items || []).length}
                onChange={val => updateItem(i, val)}
                onDelete={() => removeItem(i)}
                onMoveUp={() => moveItem(i, -1)}
                onMoveDown={() => moveItem(i, 1)}
              />
            ))}
            <Button size="sm" variant="outline" onClick={addItem}
              className="w-full h-8 text-xs border-dashed border-teal-300 text-teal-600 hover:bg-teal-50">
              <Plus className="w-3.5 h-3.5 mr-1" />新增问答
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function FaqManager({ settings, onReload }) {
  const [form, setForm] = useState(migrateConfig(null));
  const [activeTab, setActiveTab] = useState("guest");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_faq_config");
    if (setting?.value) {
      try { setForm(migrateConfig(JSON.parse(setting.value))); } catch { /* noop */ }
    }
  }, [settings]);

  const cloneAudience = (a) => ({ ...a, items: (a.items || []).map(it => ({ ...it })) });

  const handleSave = async () => {
    setSaving(true);
    const saveForm = form.unified
      ? { ...form, user: cloneAudience(form.guest), admin: cloneAudience(form.guest) }
      : form;
    const existing = (settings || []).find(s => s.key === "home_faq_config");
    const value = JSON.stringify(saveForm);
    if (existing?.id) {
      await tenantEntity.update("SiteSettings", existing.id, { value });
    } else {
      await tenantEntity.create("SiteSettings", { key: "home_faq_config", value, description: "主页常见问题区块配置（JSON）", category: "general" });
    }
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleUnified = (checked) => {
    if (checked) {
      setForm(prev => ({ ...prev, unified: true, user: cloneAudience(prev.guest), admin: cloneAudience(prev.guest) }));
    } else {
      setForm(prev => ({ ...prev, unified: false }));
    }
  };

  const currentAudience = form.unified ? "guest" : activeTab;

  return (
    <Card className="border-teal-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-teal-500" />
            <CardTitle className="text-sm font-semibold text-gray-700">常见问题（FAQ）自定义</CardTitle>
          </div>
          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">为主页添加常见问题区块，支持按受众分别配置显示内容。</p>

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 cursor-pointer"
          onClick={() => toggleUnified(!form.unified)}>
          <Checkbox checked={!!form.unified} onCheckedChange={toggleUnified} />
          <span className="text-xs text-gray-600 select-none">所有用户显示同一套配置</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!form.unified && (
          <div className="flex gap-1 border-b border-gray-200 pb-0">
            {AUDIENCE_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-t-lg transition-colors -mb-px border ${
                  activeTab === tab.key
                    ? "bg-white border-gray-200 border-b-white text-teal-700 font-semibold"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <AudiencePanel
          key={currentAudience}
          form={form[currentAudience]}
          onChange={val => setForm(prev => ({ ...prev, [currentAudience]: val }))}
        />
      </CardContent>
    </Card>
  );
}