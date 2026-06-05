/**
 * 规则测试面板 — 手动输入变量测试计算结果
 */
import { useState } from "react";
import { calculateServiceFee, ALLOWED_VARIABLES, VARIABLE_LABELS } from "@/lib/feeRuleEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Play, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

const DEFAULT_TEST_VALUES = {
  goodsAmount: 10000,
  orderAmount: 10000,
  itemCount: 1,
  sourceSite: 'Amazon',
  customerLevel: 'regular',
  customerTags: '',
  currency: 'JPY',
  country: 'CN',
  shippingMethod: 'EMS',
  hasTransit: 0,
  weight: 500,
  storageSize: 'small',
  storageDays: 3,
  valueAddedServiceAmount: 0,
};

// Which variables to show in compact mode
const COMPACT_VARS = ['goodsAmount', 'itemCount', 'sourceSite', 'customerLevel', 'hasTransit'];

export default function RuleTestPanel({ rule }) {
  const [vars, setVars] = useState({ ...DEFAULT_TEST_VALUES });
  const [result, setResult] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const handleRun = () => {
    if (!rule) return;
    const r = calculateServiceFee(rule, vars);
    setResult(r);
  };

  const setVar = (key, val) => {
    setVars(prev => ({
      ...prev,
      [key]: key === 'hasTransit' ? (val === 'true' || val === '1' || val === true ? 1 : 0) :
              ['goodsAmount','orderAmount','itemCount','weight','storageDays','valueAddedServiceAmount'].includes(key)
                ? (parseFloat(val) || 0) : val
    }));
  };

  const displayVars = showAll ? ALLOWED_VARIABLES : COMPACT_VARS;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {displayVars.map(v => (
          <div key={v}>
            <Label className="text-xs text-gray-500">{VARIABLE_LABELS[v] || v}</Label>
            {v === 'hasTransit' ? (
              <select
                value={vars[v] ? '1' : '0'}
                onChange={e => setVar(v, e.target.value)}
                className="mt-0.5 w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white"
              >
                <option value="0">否</option>
                <option value="1">是</option>
              </select>
            ) : (
              <Input
                className="mt-0.5 h-8 text-sm"
                value={vars[v] ?? ''}
                onChange={e => setVar(v, e.target.value)}
                placeholder={String(DEFAULT_TEST_VALUES[v] ?? '')}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        onClick={() => setShowAll(v => !v)}
      >
        {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAll ? '收起变量' : `展开全部变量 (${ALLOWED_VARIABLES.length - COMPACT_VARS.length} 个)`}
      </button>

      <Button type="button" size="sm" onClick={handleRun} disabled={!rule}
        className="w-full bg-blue-600 hover:bg-blue-700">
        <Play className="w-3.5 h-3.5 mr-1" />运行测试
      </Button>

      {result && (
        <div className={`rounded-lg border p-3 space-y-2 ${result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {result.error ? (
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />{result.error}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">计算结果</span>
                <span className="text-lg font-bold text-green-700">¥ {result.fee.toLocaleString()} JPY</span>
              </div>
              {result.steps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium">计算过程：</p>
                  {result.steps.map((s, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-white rounded px-2 py-1 font-mono">{s}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}