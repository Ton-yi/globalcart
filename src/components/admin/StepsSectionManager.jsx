import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, List } from "lucide-react";

const AUDIENCE_TABS = [
  { key: "guest", label: "未登录用户可见" },
  { key: "user",  label: "仅登录用户可见" },
  { key: "admin", label: "仅管理员可见" },
];

const DEFAULT_STEPS = [
  { title: "提交购买需求", desc: "填写商品链接、数量，系统自动估算预付款" },
  { title: "确认付款",     desc: "选择支付方式完成预付款，管理员审核确认" },
  { title: "采购进行中",   desc: "我们在日本为您采购商品，实时更新状态" },
  { title: "提交发货需求", desc: "填写收货地址，选运输方式，余额自动抵扣运费" },
];

const DEFAULT_AUDIENCE = {
  visible: true,
  heading: "代购流程",
  steps: DEFAULT_STEPS.map(s => ({ ...s })),
};

function migrateConfig(raw) {
  const def = () => ({
    unified: true,
    guest: { ...DEFAULT_AUDIENCE, steps: DEFAULT_STEPS.map(s => ({ ...s })) },
    user:  { ...DEFAULT_AUDIENCE, steps: DEFAULT_STEPS.map(s => ({ ...s })) },
    admin: { ...DEFAULT_AUDIENCE, steps: DEFAULT_STEPS.map(s => ({ ...s })) },
  });
  if (!raw) return def();
  if ("guest" in raw || "user" in raw || "admin" in raw) {
    return {
      unified: raw.unified ?? false,
      guest: { ...DEFAULT_AUDIENCE, ...(raw.guest || {}) },
      user:  { ...DEFAULT_AUDIENCE, ...(raw.user  || {}) },
      admin: { ...DEFAULT_AUDIENCE, ...(raw.admin || {}) },
    };
  }
  return def();
}

function AudiencePanel({ form, onChange }) {
  const f = (k, v) => onChange({ ...form, [k]: v });
  const updateStep = (i, field, val) => {
    const steps = form.steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    f("steps", steps);
  };

  return (
    <div className="space-y-4">
      {/* Visibility */}
      <div className="flex items-center gap-2">
        <Checkbox id="step-visible" checked={!!form.visible} onCheckedChange={v => f("visible", !!v)} />
        <label htmlFor="step-visible" className="text-xs text-gray-600 cursor-pointer select-none">显示此区块</label>
      </div>

      {form.visible && (
        <>
          {/* Section heading */}
          <div>
            <Label className="text-xs text-gray-500">区块标题</Label>
            <Input className="mt-0.5 h-8 text-sm" value={form.heading || ""} onChange={e => f("heading", e.target.value)} placeholder="代购流程" />
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">步骤列表（4 步）</Label>
            {(form.steps || []).map((step, i) => (
              <div key={i} className="grid grid-cols-1 gap-1.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold text-gray-400">Step {i + 1}</span>
                </div>
                <div>
                  <Label className="text-xs text-gray-400">标题</Label>
                  <Input className="mt-0.5 h-7 text-xs" value={step.title || ""} onChange={e => updateStep(i, "title", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-400">描述</Label>
                  <Input className="mt-0.5 h-7 text-xs" value={step.desc || ""} onChange={e => updateStep(i, "desc", e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function StepsSectionManager({ settings, onReload }) {
  const [form, setForm] = useState(migrateConfig(null));
  const [activeTab, setActiveTab] = useState("guest");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_steps_config");
    if (setting?.value) {
      try { setForm(migrateConfig(JSON.parse(setting.value))); } catch { /* noop */ }
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const saveForm = form.unified
      ? { ...form, user: { ...form.guest }, admin: { ...form.guest } }
      : form;
    const existing = (settings || []).find(s => s.key === "home_steps_config");
    const value = JSON.stringify(saveForm);
    if (existing?.id) {
      await tenantEntity.update("SiteSettings", existing.id, { value });
    } else {
      await tenantEntity.create("SiteSettings", { key: "home_steps_config", value, description: "主页代购流程区块配置（JSON）", category: "general" });
    }
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleUnified = (checked) => {
    if (checked) {
      setForm(prev => ({ ...prev, unified: true, user: { ...prev.guest }, admin: { ...prev.guest } }));
    } else {
      setForm(prev => ({ ...prev, unified: false }));
    }
  };

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-indigo-500" />
            <CardTitle className="text-sm font-semibold text-gray-700">代购流程区块自定义</CardTitle>
          </div>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">为不同受众配置代购流程区块的显示内容与可见性。</p>

        {/* 统一模式开关 */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
          <Checkbox id="steps-unified" checked={!!form.unified} onCheckedChange={toggleUnified} />
          <label htmlFor="steps-unified" className="text-xs text-gray-600 cursor-pointer select-none">
            所有用户显示同一套配置（不区分登录状态与角色）
          </label>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Audience tabs */}
        {!form.unified && (
          <div className="flex gap-1 border-b border-gray-200 pb-0">
            {AUDIENCE_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-t-lg transition-colors -mb-px border ${
                  activeTab === tab.key
                    ? "bg-white border-gray-200 border-b-white text-indigo-700 font-semibold"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {form.unified ? (
          <AudiencePanel
            key="unified"
            form={form.guest}
            onChange={val => setForm(prev => ({ ...prev, guest: val }))}
          />
        ) : (
          <AudiencePanel
            key={activeTab}
            form={form[activeTab]}
            onChange={val => setForm(prev => ({ ...prev, [activeTab]: val }))}
          />
        )}
      </CardContent>
    </Card>
  );
}