import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Save, LayoutDashboard } from "lucide-react";

const GROUP_DEFS = [
  { key: "action_required", defaultLabel: "需要操作", colorClass: "text-red-600" },
  { key: "in_progress",     defaultLabel: "处理中",   colorClass: "text-blue-600" },
  { key: "shipping",        defaultLabel: "运输中",   colorClass: "text-indigo-600" },
  { key: "done",            defaultLabel: "已完成",   colorClass: "text-green-600" },
];

const DEFAULT_CONFIG = {
  title: "物流状态看板",
  groups: {
    action_required: { hidden: false, label: "需要操作", max_items: 3 },
    in_progress:     { hidden: false, label: "处理中",   max_items: 3 },
    shipping:        { hidden: false, label: "运输中",   max_items: 3 },
    done:            { hidden: false, label: "已完成",   max_items: 3 },
  },
};

export default function LogisticsStatusBoardManager({ settings, onReload }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_status_board");
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        // merge with defaults to ensure all keys exist
        setConfig({
          ...DEFAULT_CONFIG,
          ...parsed,
          groups: {
            ...DEFAULT_CONFIG.groups,
            ...(parsed.groups || {}),
          },
        });
      } catch {
        setConfig(DEFAULT_CONFIG);
      }
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const existing = (settings || []).find(s => s.key === "home_status_board");
    const value = JSON.stringify(config);
    if (existing?.id) {
      await tenantEntity.update("SiteSettings", existing.id, { value });
    } else {
      await tenantEntity.create("SiteSettings", {
        key: "home_status_board", value,
        description: "主页物流状态看板配置（JSON）", category: "general",
      });
    }
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateGroup = (key, field, val) => {
    setConfig(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [key]: { ...prev.groups[key], [field]: val },
      },
    }));
  };

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-indigo-500" />
            <CardTitle className="text-sm font-semibold text-gray-700">物流状态看板配置</CardTitle>
          </div>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">配置主页物流看板的标题、各区块名称、显示条数及显示/隐藏。</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 整体标题 */}
        <div>
          <Label className="text-xs text-gray-500">看板标题</Label>
          <Input className="h-7 text-xs mt-0.5" value={config.title}
            onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
            placeholder="物流状态看板" />
        </div>

        {/* 各分组设置 */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 block">分组设置</Label>
          {GROUP_DEFS.map(({ key, defaultLabel, colorClass }) => {
            const grp = config.groups[key] || {};
            return (
              <div key={key} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  {/* 显示/隐藏 */}
                  <Switch
                    checked={!grp.hidden}
                    onCheckedChange={v => updateGroup(key, "hidden", !v)}
                  />
                  <span className={`text-xs font-semibold ${colorClass} w-14 flex-shrink-0`}>{defaultLabel}</span>

                  {/* 自定义名称 */}
                  <div className="flex-1">
                    <Input
                      className="h-7 text-xs"
                      value={grp.label || defaultLabel}
                      onChange={e => updateGroup(key, "label", e.target.value)}
                      placeholder={defaultLabel}
                      disabled={grp.hidden}
                    />
                  </div>

                  {/* 最大条数 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">最多显示</span>
                    <Input
                      type="number"
                      min={1} max={10}
                      className="h-7 text-xs w-14 text-center"
                      value={grp.max_items ?? 3}
                      onChange={e => updateGroup(key, "max_items", Math.max(1, Math.min(10, Number(e.target.value))))}
                      disabled={grp.hidden}
                    />
                    <span className="text-xs text-gray-400">条</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}