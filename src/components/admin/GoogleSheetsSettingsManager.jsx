import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Sheet, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// Toggle component
function Toggle({ enabled, onToggle, color = "bg-emerald-600" }) {
  return (
    <button 
      type="button" 
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? color : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function GoogleSheetsSettingsManager({ onReload }) {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [settings, setSettings] = useState(null);

  const loadSettings = async () => {
    try {
      const gsSetting = await base44.functions.invoke('getTenantGoogleSheetsSettings');
      if (gsSetting.success) {
        const data = gsSetting.settings || {};
        setIsEnabled(data.google_sheets_enabled === 'true');
        setSettings(data);
      }
    } catch (error) {
      console.error('加载 Google Sheets 设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleToggle = async () => {
    setSaving(true);
    try {
      const newValue = isEnabled ? 'false' : 'true';
      const response = await base44.functions.invoke('manageTenantGoogleSheetsSettings', {
        google_sheets_enabled: newValue
      });

      if (response.success) {
        setIsEnabled(!isEnabled);
        toast.success(isEnabled ? 'Google Sheets 同步已关闭' : 'Google Sheets 同步已开启');
        if (onReload) await onReload();
      } else {
        toast.error('操作失败：' + (response.error || '未知错误'));
      }
    } catch (error) {
      toast.error('操作失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">加载中...</div>;
  }

  return (
    <Card className="border-emerald-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Sheet className="w-4 h-4 text-emerald-500" />
          Google Sheets 订单归档
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">自动化同步已发货订单到 Google Sheets 表格进行归档管理</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <span className="text-sm font-medium">启用订单归档</span>
            <p className="text-xs text-gray-400 mt-0.5">开启后自动同步发货订单到 Google Sheets</p>
          </div>
          <Toggle enabled={isEnabled} onToggle={handleToggle} color="bg-emerald-600" />
        </div>

        {isEnabled && (
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
            <p className="text-xs text-emerald-800">
              <strong>✅ 自动化已启用</strong><br/>
              每当订单状态变更为「已发货」时，系统会自动将订单信息同步到 Google Sheets 归档表。<br/>
              同步字段包括：订单编号、用户信息、商品详情、费用明细、运输信息、发货日期等。
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <div>📊 表格名称：<code className="bg-gray-100 px-1 rounded">订单归档表</code></div>
          <div>🔄 同步时机：订单状态变更为 <code className="bg-gray-100 px-1 rounded">shipped</code> 时</div>
          <div>📧 数据位置：Google Drive → 我的云端硬盘 → 订单归档表</div>
        </div>

        {!isEnabled && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 ml-2">
              <strong>⚠ 功能已关闭</strong><br/>
              开启后将自动同步新发货的订单到 Google Sheets 进行归档管理
            </AlertDescription>
          </Alert>
        )}

        {isEnabled && settings?.last_sync_date && (
          <div className="text-xs text-gray-500 pt-2 border-t">
            <div>📅 最后同步时间：<code className="bg-gray-100 px-1 rounded">{settings.last_sync_date}</code></div>
            {settings.sync_count !== undefined && (
              <div>📊 累计同步订单数：<code className="bg-gray-100 px-1 rounded">{settings.sync_count}</code></div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}