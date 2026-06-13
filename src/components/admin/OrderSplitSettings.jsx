/**
 * OrderSplitSettings
 * 拆单设置区块（订单管理 tab）：
 * - allow_order_split：允许用户拆单（下单时 --- 分隔标记）
 * - allow_order_split_after_warehouse：允许入库后申请拆单（需父开关开启才生效）
 * 即时保存。
 */
import { useState } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Scissors } from "lucide-react";

function Toggle({ enabled, onToggle, color = "bg-indigo-600", disabled = false }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${enabled ? color : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function OrderSplitSettings({ settings, onReload }) {
  const [saving, setSaving] = useState(false);

  const get = (key) => settings.find(s => s.key === key);

  const toggle = async (key, description) => {
    if (saving) return;
    setSaving(true);
    const s = get(key);
    const newVal = s?.value === 'true' ? 'false' : 'true';
    if (s?.id) {
      await tenantEntity.update('SiteSettings', s.id, { value: newVal });
    } else {
      await tenantEntity.create('SiteSettings', { key, value: newVal, description, category: 'general' });
    }
    await onReload();
    setSaving(false);
  };

  const splitEnabled = get('allow_order_split')?.value === 'true';
  const afterWarehouseEnabled = get('allow_order_split_after_warehouse')?.value === 'true';

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-indigo-500" />拆单
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">配置用户拆单相关功能，开关即时保存。</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <div>
            <Label className="text-sm">允许用户拆单</Label>
            <p className="text-xs text-gray-400 mt-0.5">开启后，用户在商品链接中用 <code className="bg-gray-100 px-1 rounded">---</code> 分隔多组链接，管理员下单后可自动拆分为多个子订单</p>
          </div>
          <Toggle enabled={splitEnabled} disabled={saving}
            onToggle={() => toggle('allow_order_split', '允许用户拆单')} />
        </div>

        <div className={`flex items-center justify-between pb-1 pl-4 border-l-2 ${splitEnabled ? 'border-l-indigo-200' : 'border-l-gray-200 opacity-60'}`}>
          <div>
            <Label className="text-sm text-indigo-700">允许入库后申请拆单</Label>
            <p className="text-xs text-gray-400 mt-0.5">开启后，已入库订单的用户可申请拆单（需管理员审批）</p>
            {!splitEnabled && (
              <p className="text-xs text-orange-500 mt-0.5">需先开启「允许用户拆单」才生效</p>
            )}
          </div>
          <Toggle enabled={afterWarehouseEnabled} color="bg-indigo-400" disabled={saving || !splitEnabled}
            onToggle={() => toggle('allow_order_split_after_warehouse', '允许入库后申请拆单')} />
        </div>
      </CardContent>
    </Card>
  );
}