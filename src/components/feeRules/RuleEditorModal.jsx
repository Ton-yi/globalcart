/**
 * 规则编辑弹窗 — 支持简单/阶梯/公式三模式 + 测试面板
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { validateFormula } from "@/lib/feeRuleEngine";
import FormulaEditor from "./FormulaEditor";
import TieredRuleEditor from "./TieredRuleEditor";
import RuleTestPanel from "./RuleTestPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Save, FlaskConical, AlertCircle } from "lucide-react";

const EMPTY_RULE = {
  name: '', description: '', status: 'draft', priority: 0,
  effective_from: '', effective_until: '',
  mode: 'simple', formula: '', simple_rate: 8,
  tiered_config: [],
  min_fee: 0, max_fee: 0, round_mode: 'round', round_unit: 1,
};

const STATUS_LABELS = { active: '启用', inactive: '停用', draft: '草稿' };
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500', draft: 'bg-yellow-100 text-yellow-700' };
const MODE_LABELS = { simple: '简单比例', tiered: '阶梯费率', formula: '高级公式' };

export default function RuleEditorModal({ rule: initialRule, onClose, onSaved }) {
  const [rule, setRule] = useState(initialRule ? { ...EMPTY_RULE, ...initialRule } : { ...EMPTY_RULE });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'test'
  const [formulaValid, setFormulaValid] = useState(null);

  useEffect(() => {
    if (rule.mode === 'formula' && rule.formula?.trim()) {
      const v = validateFormula(rule.formula);
      setFormulaValid(v);
    } else {
      setFormulaValid(null);
    }
  }, [rule.formula, rule.mode]);

  const set = (key, val) => setRule(r => ({ ...r, [key]: val }));

  const handleSave = async () => {
    if (!rule.name.trim()) { setError('请填写规则名称'); return; }
    if (rule.mode === 'formula' && rule.formula?.trim()) {
      const v = validateFormula(rule.formula);
      if (!v.valid && rule.status === 'active') {
        setError(`公式有错误，无法保存为启用状态：${v.error}`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    const res = await base44.functions.invoke('serviceFeeRuleEngine', { action: 'save_rule', rule });
    if (res.data?.error) { setError(res.data.error); setSaving(false); return; }
    onSaved(res.data?.rule);
    onClose();
  };

  const currentRule = { ...rule, tiered_config: rule.tiered_config || [] };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">{initialRule?.id ? '编辑规则' : '新建规则'}</h2>
            <Badge className={`text-xs ${STATUS_COLORS[rule.status]}`}>{STATUS_LABELS[rule.status]}</Badge>
            {initialRule?.version && <span className="text-xs text-gray-400">v{initialRule.version}</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 px-5">
          {[['edit', '规则配置'], ['test', '测试预览']].map(([k, label]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {k === 'test' && <FlaskConical className="w-3.5 h-3.5 inline mr-1.5" />}{label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {activeTab === 'edit' ? (
            <>
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">规则名称 *</Label>
                  <Input className="mt-1 h-9" value={rule.name} onChange={e => set('name', e.target.value)} placeholder="例：默认服务费 8%" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">规则状态</Label>
                  <Select value={rule.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">优先级（数字越大越优先）</Label>
                  <Input className="mt-1 h-9 text-sm" type="number" value={rule.priority} onChange={e => set('priority', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">生效日期（留空=立即生效）</Label>
                  <Input className="mt-1 h-9 text-sm" type="date" value={rule.effective_from || ''} onChange={e => set('effective_from', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">失效日期（留空=永久有效）</Label>
                  <Input className="mt-1 h-9 text-sm" type="date" value={rule.effective_until || ''} onChange={e => set('effective_until', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">规则说明</Label>
                  <Input className="mt-1 h-9 text-sm" value={rule.description || ''} onChange={e => set('description', e.target.value)} placeholder="简单描述此规则的用途..." />
                </div>
              </div>

              {/* Mode selection */}
              <div>
                <Label className="text-xs text-gray-500 block mb-2">计算模式</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(MODE_LABELS).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => set('mode', k)}
                      className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${rule.mode === k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode-specific config */}
              <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                {rule.mode === 'simple' && (
                  <div>
                    <Label className="text-xs text-gray-500">服务费率 (%)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input className="h-9 text-sm w-28" type="number" step="0.1" value={rule.simple_rate ?? 8}
                        onChange={e => set('simple_rate', parseFloat(e.target.value) || 0)} />
                      <span className="text-sm text-gray-500">% × 商品货款</span>
                      {rule.simple_rate > 0 && (
                        <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-mono ml-2">
                          goodsAmount * {rule.simple_rate}%
                        </code>
                      )}
                    </div>
                  </div>
                )}
                {rule.mode === 'tiered' && (
                  <TieredRuleEditor
                    tiers={rule.tiered_config || []}
                    onChange={t => set('tiered_config', t)}
                  />
                )}
                {rule.mode === 'formula' && (
                  <div>
                    <Label className="text-xs text-gray-500 block mb-2">高级公式</Label>
                    <FormulaEditor value={rule.formula || ''} onChange={v => set('formula', v)} />
                  </div>
                )}
              </div>

              {/* Global limits & rounding */}
              <div className="border border-gray-100 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-600 mb-3">全局限制与取整</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">最低服务费 (JPY，0=不限)</Label>
                    <Input className="mt-1 h-9 text-sm" type="number" value={rule.min_fee ?? 0} onChange={e => set('min_fee', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">封顶服务费 (JPY，0=不限)</Label>
                    <Input className="mt-1 h-9 text-sm" type="number" value={rule.max_fee ?? 0} onChange={e => set('max_fee', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">取整方式</Label>
                    <Select value={rule.round_mode || 'round'} onValueChange={v => set('round_mode', v)}>
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round">四舍五入</SelectItem>
                        <SelectItem value="ceil">向上取整</SelectItem>
                        <SelectItem value="floor">向下取整</SelectItem>
                        <SelectItem value="none">不取整</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">取整单位（如10→取整到10的倍数）</Label>
                    <Input className="mt-1 h-9 text-sm" type="number" min="1" value={rule.round_unit ?? 1} onChange={e => set('round_unit', parseFloat(e.target.value) || 1)} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-4">输入测试变量，验证规则计算结果是否符合预期。</p>
              <RuleTestPanel rule={currentRule} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
          <div className="text-xs text-gray-400">
            {rule.mode === 'formula' && formulaValid !== null && (
              formulaValid.valid
                ? <span className="text-green-600">✓ 公式语法正确</span>
                : <span className="text-red-600">⚠ {formulaValid.error}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1" />{saving ? '保存中...' : '保存规则'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}