/**
 * PaymentTimeoutSettings
 * 付款超时自动处理设置：
 * - 启用/禁用开关
 * - 规则列表（超过N小时 → 发送通知/取消订单）
 * 即时保存。
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, AlertTriangle } from "lucide-react";

function Toggle({ enabled, onToggle, disabled = false, color = "bg-amber-600" }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${enabled ? color : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

const DEFAULT_RULES = [
  { hours: 24, subtype: "order_payment_timeout", cancel: false },
  { hours: 168, subtype: "order_payment_cancel", cancel: true },
];

export default function PaymentTimeoutSettings({ settings, onReload, notificationTemplates = [] }) {
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState({ hours: 48, subtype: "order_payment_timeout", cancel: false });
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const enabledSetting = settings.find(s => s.key === 'payment_timeout_enabled');
  const rulesSetting = settings.find(s => s.key === 'payment_timeout_rules');
  const isEnabled = enabledSetting?.value === 'true';

  // Load rules from settings
  useEffect(() => {
    try {
      const parsed = rulesSetting?.value ? JSON.parse(rulesSetting.value) : DEFAULT_RULES;
      setRules(parsed);
    } catch {
      setRules(DEFAULT_RULES);
    }
  }, [rulesSetting?.value]);

  const saveSetting = async (key, value, description, category = 'general') => {
    const existing = settings.find(s => s.key === key);
    if (existing?.id) {
      await base44.functions.invoke('mutateTenantEntity', { action: 'update', entity: 'SiteSettings', id: existing.id, data: { value } });
    } else {
      await base44.functions.invoke('mutateTenantEntity', { action: 'create', entity: 'SiteSettings', data: { key, value, description, category } });
    }
  };

  const toggleEnabled = async () => {
    setSaving(true);
    await saveSetting('payment_timeout_enabled', isEnabled ? 'false' : 'true', '付款超时自动处理总开关');
    await onReload();
    setSaving(false);
  };

  const saveRules = async (updatedRules) => {
    setSaving(true);
    await saveSetting('payment_timeout_rules', JSON.stringify(updatedRules), '付款超时规则列表（JSON）');
    await onReload();
    setSaving(false);
  };

  const addRule = async () => {
    if (!newRule.hours || !newRule.subtype) return;
    const updated = [...rules, { ...newRule, hours: parseFloat(newRule.hours) }];
    updated.sort((a, b) => a.hours - b.hours);
    setRules(updated);
    await saveRules(updated);
    setNewRule({ hours: 48, subtype: "order_payment_timeout", cancel: false });
  };

  const removeRule = async (idx) => {
    const updated = rules.filter((_, i) => i !== idx);
    setRules(updated);
    await saveRules(updated);
  };

  const updateRuleCancel = async (idx, cancel) => {
    const updated = rules.map((r, i) => i === idx ? { ...r, cancel } : r);
    setRules(updated);
    await saveRules(updated);
  };

  const handleTest = async () => {
    setRunningTest(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('checkPaymentTimeout', {});
      setTestResult(res.data);
    } catch (e) {
      setTestResult({ error: e.message });
    }
    setRunningTest(false);
  };

  // Available subtypes (from templates + defaults)
  const subtypeOptions = [
    { value: "order_payment_timeout", label: "付款提醒通知" },
    { value: "order_payment_cancel",  label: "取消通知" },
    ...(notificationTemplates || [])
      .filter(t => t.notification_type === 'payment' && !['order_payment_timeout','order_payment_cancel'].includes(t.notification_subtype))
      .map(t => ({ value: t.notification_subtype, label: t.title_template || t.notification_subtype })),
  ];

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />付款超时设置
          </CardTitle>
          <Toggle enabled={isEnabled} onToggle={toggleEnabled} disabled={saving} />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          开启后，系统定时检查超过指定时间未付款的订单，自动发送提醒通知或取消订单。
        </p>
      </CardHeader>
      {isEnabled && (
        <CardContent className="space-y-4">
          {/* Rules List */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">超时规则</Label>
            {rules.length === 0 && (
              <p className="text-xs text-gray-400 py-2">暂无规则，请添加</p>
            )}
            {rules.map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1">
                  超过 <strong className="text-amber-700">{rule.hours}h</strong> 未付款，发送
                  {' '}<Badge variant="outline" className="text-xs">{
                    subtypeOptions.find(o => o.value === rule.subtype)?.label || rule.subtype
                  }</Badge>
                </span>
                {rule.cancel && (
                  <Badge className="bg-red-100 text-red-700 text-xs flex-shrink-0">
                    <AlertTriangle className="w-3 h-3 mr-1" />自动取消
                  </Badge>
                )}
                <label className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 cursor-pointer">
                  <input type="checkbox" checked={!!rule.cancel}
                    onChange={e => updateRuleCancel(idx, e.target.checked)}
                    className="rounded" />
                  取消订单
                </label>
                <button onClick={() => removeRule(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Rule */}
          <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
            <Label className="text-xs text-gray-500">新增规则</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">超过</span>
                <Input type="number" min="1" step="1"
                  value={newRule.hours}
                  onChange={e => setNewRule(r => ({ ...r, hours: e.target.value }))}
                  className="w-20 h-8 text-sm" />
                <span className="text-xs text-gray-500">小时 发送</span>
              </div>
              <Select value={newRule.subtype} onValueChange={v => setNewRule(r => ({ ...r, subtype: v }))}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {subtypeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={newRule.cancel}
                  onChange={e => setNewRule(r => ({ ...r, cancel: e.target.checked }))} />
                同时取消订单
              </label>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addRule} disabled={saving}>
                <Plus className="w-3 h-3 mr-1" />添加
              </Button>
            </div>
          </div>

          {/* Warning for cancel rules */}
          {rules.some(r => r.cancel) && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>含自动取消规则时，系统将自动将对应订单状态改为「已取消」，请谨慎配置。</span>
            </div>
          )}

          {/* Manual test trigger */}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleTest} disabled={runningTest || saving}>
              {runningTest ? "执行中..." : "立即执行一次检查"}
            </Button>
            {testResult && (
              <span className="text-xs text-gray-500">
                {testResult.error
                  ? <span className="text-red-600">{testResult.error}</span>
                  : `处理 ${testResult.processed ?? 0} 笔，通知 ${testResult.notified ?? 0} 笔，取消 ${testResult.cancelled ?? 0} 笔`
                }
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400">
            通知内容模板可在「通知设置 → 通知模板管理」中编辑 <code className="bg-gray-100 px-1 rounded">order_payment_timeout</code> 和 <code className="bg-gray-100 px-1 rounded">order_payment_cancel</code>。
          </p>
        </CardContent>
      )}
    </Card>
  );
}