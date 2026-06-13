import { useState, useEffect } from "react";
import { Save, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { tenantEntity } from "@/lib/tenantApi";

export default function AutoArchiveSettings({ settings, onReload }) {
  const getSetting = (key) => settings.find(s => s.key === key);

  const archiveSetting = getSetting('auto_archive_delivered_days');
  const [days, setDays] = useState('3');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDays(archiveSetting?.value ?? '3');
  }, [archiveSetting?.value]);

  const handleSave = async () => {
    setSaving(true);
    const val = String(Math.max(0, parseInt(days) || 0));
    if (archiveSetting?.id) {
      await tenantEntity.update('SiteSettings', archiveSetting.id, { value: val });
    } else {
      await tenantEntity.create('SiteSettings', {
        key: 'auto_archive_delivered_days',
        value: val,
        description: '已收货订单自动归档天数（0=立即归档）',
        category: 'general',
      });
    }
    await onReload();
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const daysNum = parseInt(days) || 0;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Archive className="w-4 h-4 text-gray-500" />订单自动归档
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">
          已收货订单在指定天数后自动归档（更新 is_archived=true）。设置 0 天表示订单变为已收货时立即归档。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-32">
            <Label className="text-xs text-gray-500 block mb-1">自动归档天数</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number" min="0" step="1" className="h-8 text-sm"
                value={days}
                onChange={e => setDays(e.target.value)}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">天</span>
            </div>
          </div>
          <div className="flex-1 pt-5">
            <p className="text-xs text-gray-500">
              {daysNum === 0
                ? '订单状态变为「已收货」时立即自动归档'
                : `订单「已收货」满 ${daysNum} 天后自动归档`}
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs text-gray-500">
          系统每天自动扫描已收货且未归档的订单，超过设定天数则自动归档。用户设置中的个人归档偏好优先级低于此全局设置（若已配置全局设置）。
        </div>

        <Button size="sm" className="h-7 text-xs bg-gray-800 hover:bg-gray-700" onClick={handleSave} disabled={saving}>
          <Save className="w-3 h-3 mr-1" />{saved ? '已保存 ✓' : saving ? '保存中...' : '保存'}
        </Button>
      </CardContent>
    </Card>
  );
}