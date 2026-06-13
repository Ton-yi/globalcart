import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save, HelpCircle, ExternalLink, Settings, MessageCirclePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const DEFAULT_FAQ = {
  unified: true,
  guest:  { visible: true, title: "常见问题", selected_category_ids: [], display_limit: 6 },
  user:   { visible: true, title: "常见问题", selected_category_ids: [], display_limit: 6 },
  admin:  { visible: false, title: "常见问题", selected_category_ids: [], display_limit: 6 },
};

const AUDIENCE_TABS = [
  { key: "guest", label: "未登录用户" },
  { key: "user",  label: "登录用户" },
  { key: "admin", label: "管理员" },
];

function migrateConfig(raw) {
  if (!raw) return DEFAULT_FAQ;
  const base = {
    unified: raw.unified ?? true,
    guest: { ...DEFAULT_FAQ.guest, ...(raw.guest || {}) },
    user:  { ...DEFAULT_FAQ.user,  ...(raw.user  || {}) },
    admin: { ...DEFAULT_FAQ.admin, ...(raw.admin || {}) },
  };
  return base;
}

function AudiencePanel({ form, onChange, categories }) {
  const f = (k, v) => onChange({ ...form, [k]: v });

  const toggleCategory = (id) => {
    const ids = form.selected_category_ids || [];
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    f("selected_category_ids", next);
  };

  const selectedIds = form.selected_category_ids || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => f("visible", !form.visible)}>
        <Checkbox checked={!!form.visible} onCheckedChange={v => f("visible", !!v)} />
        <span className="text-xs text-gray-600 select-none">显示此区块</span>
      </div>

      {form.visible && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">区块标题</Label>
              <Input className="mt-0.5 h-8 text-sm" value={form.title || ""}
                onChange={e => f("title", e.target.value)} placeholder="常见问题" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">最多展示条数</Label>
              <Input type="number" min="1" max="20" className="mt-0.5 h-8 text-sm"
                value={form.display_limit || 6}
                onChange={e => f("display_limit", Number(e.target.value))} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500 block mb-2">选择展示的问答分类</Label>
            {categories.length === 0 ? (
              <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-3 text-center">
                尚无问答分类，请先前往「帮助中心管理」创建
              </div>
            ) : (
              <div className="space-y-1.5">
                {categories.map(cat => (
                  <div key={cat.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedIds.includes(cat.id) ? "border-teal-300 bg-teal-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedIds.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                      <span className="text-sm">{cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.title}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{(cat.items || []).length} 条</Badge>
                  </div>
                ))}
              </div>
            )}
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
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_faq_config");
    const allowSetting = (settings || []).find(s => s.key === "faq_allow_user_questions");
    const allowUserQuestions = allowSetting?.value === 'true';
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        setForm({ ...migrateConfig(parsed), allow_user_questions: allowUserQuestions });
      } catch { setForm(prev => ({ ...prev, allow_user_questions: allowUserQuestions })); }
    } else {
      setForm(prev => ({ ...prev, allow_user_questions: allowUserQuestions }));
    }
  }, [settings]);

  useEffect(() => {
    base44.functions.invoke('manageFaqCategories', { action: 'list' })
      .then(r => setCategories((r.data?.categories || []).filter(c => c.is_active !== false)))
      .catch(() => {});
  }, []);

  const cloneAudience = (a) => ({ ...a });

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
    // Sync allow_user_questions to separate setting key
    const allowSetting = (settings || []).find(s => s.key === "faq_allow_user_questions");
    const allowValue = form.allow_user_questions ? 'true' : 'false';
    if (allowSetting?.id) {
      await tenantEntity.update("SiteSettings", allowSetting.id, { value: allowValue });
    } else {
      await tenantEntity.create("SiteSettings", { key: "faq_allow_user_questions", value: allowValue, description: "是否允许用户在帮助中心提问", category: "general" });
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
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("AdminFaq")}>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Settings className="w-3 h-3 mr-1" />管理问答内容
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
            <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">选择要在主页展示的问答分类。在「管理问答内容」中维护分类和问题。</p>

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 cursor-pointer"
          onClick={() => toggleUnified(!form.unified)}>
          <Checkbox checked={!!form.unified} onCheckedChange={toggleUnified} />
          <span className="text-xs text-gray-600 select-none">所有用户显示同一套配置</span>
        </div>
        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-100 cursor-pointer"
          onClick={() => setForm(prev => ({ ...prev, allow_user_questions: !prev.allow_user_questions }))}>
          <Checkbox className="mt-0.5 flex-shrink-0" checked={!!form.allow_user_questions} onCheckedChange={v => setForm(prev => ({ ...prev, allow_user_questions: !!v }))} />
          <div>
            <div className="flex items-center gap-1.5">
              <MessageCirclePlus className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-xs text-gray-600 select-none">允许用户在帮助中心提问（用户提问后通知管理员）</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 select-none">可在角色标签中为特定角色添加「常见问题——可提问」权限进一步控制；或用阻断权限 <code className="bg-gray-100 px-1 rounded">block_faq:ask_question</code> 禁止特定角色提问。</p>
          </div>
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
          categories={categories}
          onChange={val => setForm(prev => ({ ...prev, [currentAudience]: val }))}
        />
      </CardContent>
    </Card>
  );
}