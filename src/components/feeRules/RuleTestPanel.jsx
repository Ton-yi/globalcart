/**
 * 规则测试面板 — 按规则阶段显示对应变量，选项从后端动态加载
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ALLOWED_VARIABLES, VARIABLE_LABELS } from "@/lib/feeRuleEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";

// 下单阶段优先变量（以商品货款为基数）
const ORDER_COMPACT_VARS = ['goodsAmount', 'itemCount', 'sourceSite', 'customerLevel'];
// 发货阶段优先变量（以实际运费为基数）
const SHIPPING_COMPACT_VARS = ['shippingFee', 'weight', 'shippingMethod', 'hasTransit', 'storageSize', 'customerLevel', 'country'];

const DEFAULT_TEST_VALUES = {
  goodsAmount: 10000,
  orderAmount: 10000,
  itemCount: 1,
  sourceSite: '',
  customerLevel: '',
  currency: 'JPY',
  country: 'CN',
  shippingMethod: '',
  hasTransit: 0,
  weight: 500,
  storageSize: '',
  storageDays: 3,
  shippingFee: 3000,
  valueAddedServiceAmount: 0,
};

export default function RuleTestPanel({ rule }) {
  const [vars, setVars] = useState({ ...DEFAULT_TEST_VALUES });
  const [result, setResult] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Dynamic options
  const [storeTags, setStoreTags] = useState([]);
  const [memberTiers, setMemberTiers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [sizeTemplates, setSizeTemplates] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_store_tags' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_member_tiers' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_roles' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_shipping_methods' }),
      base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_item_size_templates' }),
    ]).then(([tags, tiers, rolesRes, methods, sizes]) => {
      setStoreTags(tags.data?.tags || []);
      setMemberTiers(tiers.data?.tiers || []);
      setRoles((rolesRes.data?.roles || []).filter(r => !r.is_global && !r.is_archived));
      setShippingMethods(methods.data?.methods || []);
      setSizeTemplates(sizes.data?.templates || []);
    }).finally(() => setLoadingOptions(false));
  }, []);

  const isShipping = rule?.fee_phase === 'shipping';
  const compactVars = isShipping ? SHIPPING_COMPACT_VARS : ORDER_COMPACT_VARS;
  const displayVars = showAll ? ALLOWED_VARIABLES : compactVars;

  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    if (!rule) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('serviceFeeRuleEngine', {
        action: 'evaluate',
        rule,
        variables: vars,
      });
      setResult(res.data);
    } catch (e) {
      setResult({ fee: 0, steps: [], error: e?.message || '计算失败', matched_config: null });
    } finally {
      setRunning(false);
    }
  };

  const setVar = (key, val) => {
    setVars(prev => ({
      ...prev,
      [key]: key === 'hasTransit' ? (val === 'true' || val === '1' || val === true ? 1 : 0) :
              ['goodsAmount', 'orderAmount', 'itemCount', 'weight', 'storageDays', 'shippingFee', 'valueAddedServiceAmount'].includes(key)
                ? (parseFloat(val) || 0) : val
    }));
  };

  // Build customer level options: tiers + roles combined
  const customerLevelOptions = [
    ...memberTiers.map(t => ({ value: t.name, label: `[阶级] ${t.name}` })),
    ...roles.map(r => ({ value: r.name, label: `[角色] ${r.name}` })),
  ];

  // Render the appropriate input for a variable
  const renderInput = (v) => {
    if (v === 'hasTransit') {
      return (
        <select value={vars[v] ? '1' : '0'} onChange={e => setVar(v, e.target.value)}
          className="mt-0.5 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
          <option value="0">否（直发）</option>
          <option value="1">是（中转）</option>
        </select>
      );
    }

    if (v === 'sourceSite') {
      return (
        <select value={vars[v]} onChange={e => setVar(v, e.target.value)}
          className="mt-0.5 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
          <option value="">-- 选择网站 --</option>
          {storeTags.map(t => (
            <option key={t.id} value={t.tag_label}>{t.tag_label}</option>
          ))}
          <option value="其它">其它</option>
        </select>
      );
    }

    if (v === 'customerLevel') {
      return (
        <select value={vars[v]} onChange={e => setVar(v, e.target.value)}
          className="mt-0.5 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
          <option value="">-- 选择等级 --</option>
          {customerLevelOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    if (v === 'shippingMethod') {
      return (
        <select value={vars[v]} onChange={e => setVar(v, e.target.value)}
          className="mt-0.5 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
          <option value="">-- 选择方式 --</option>
          {shippingMethods.map(m => (
            <option key={m.id} value={m.code || m.name}>{m.name}</option>
          ))}
        </select>
      );
    }

    if (v === 'storageSize') {
      return (
        <select value={vars[v]} onChange={e => setVar(v, e.target.value)}
          className="mt-0.5 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white">
          <option value="">-- 选择尺寸 --</option>
          {sizeTemplates.map(t => (
            // 使用 title 作为值，与 buildOrderVariables 中 item_size_title 一致
            <option key={t.id} value={t.title}>{t.title}</option>
          ))}
        </select>
      );
    }

    return (
      <Input className="mt-0.5 h-8 text-sm" value={vars[v] ?? ''}
        onChange={e => setVar(v, e.target.value)}
        placeholder={String(DEFAULT_TEST_VALUES[v] ?? '')} />
    );
  };

  const extraCount = ALLOWED_VARIABLES.length - compactVars.length;

  return (
    <div className="space-y-4">
      {isShipping && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
          <strong>发货阶段：</strong>服务费以「实际运费」为基数计算，请先填写实际运费金额。
        </div>
      )}
      {!isShipping && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600">
          <strong>下单阶段：</strong>服务费以「商品货款」为基数计算。
        </div>
      )}
      {loadingOptions && (
        <p className="text-xs text-gray-400">正在加载选项数据…</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {displayVars.map(v => (
          <div key={v}>
            <Label className="text-xs text-gray-500">{VARIABLE_LABELS[v] || v}</Label>
            {renderInput(v)}
          </div>
        ))}
      </div>

      <button type="button"
        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        onClick={() => setShowAll(s => !s)}>
        {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAll ? '收起变量' : `展开全部变量 (${extraCount} 个)`}
      </button>

      <Button type="button" size="sm" onClick={handleRun} disabled={!rule || loadingOptions || running}
        className="w-full bg-blue-600 hover:bg-blue-700">
        <Play className="w-3.5 h-3.5 mr-1" />{running ? '计算中…' : '运行测试（后端完整流程）'}
      </Button>

      {result && (
        <div className={`rounded-lg border p-3 space-y-2.5 ${result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {result.error ? (
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />{result.error}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">计算结果</span>
                <span className="text-lg font-bold text-green-700">¥ {(result.fee || 0).toLocaleString()} JPY</span>
              </div>

              {/* 命中的规则配置说明 */}
              {result.matched_config ? (
                <div className="flex items-start gap-2 bg-green-100 border border-green-200 rounded px-2 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-green-800">
                    <span className="font-medium">命中配置：</span>
                    {result.matched_config.rowIndex !== undefined && `第 ${result.matched_config.rowIndex + 1} 行`}
                    {result.matched_config.type === 'customer_level' && `客户等级「${result.matched_config.row?.name}」`}
                    {result.matched_config.type === 'store_tag' && `网站标签「${result.matched_config.row?.tag_label}」`}
                    {result.matched_config.row && result.matched_config.rowIndex !== undefined && (
                      <span className="ml-1 text-green-700">
                        （费率 {result.matched_config.row.rate || 0}%，固定 ¥{result.matched_config.row.fixed_fee_jpy ?? result.matched_config.row.fixed_fee ?? 0}）
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-yellow-700">未命中任何配置行，使用默认费率</span>
                </div>
              )}

              {result.steps && result.steps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium">计算过程：</p>
                  {result.steps.map((s, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-white rounded px-2 py-1 font-mono">{s}</div>
                  ))}
                </div>
              )}

              {result.rule_name && (
                <p className="text-xs text-gray-400">使用规则：{result.rule_name}{result.rule_version ? ` v${result.rule_version}` : ''}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}