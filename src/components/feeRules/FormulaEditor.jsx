/**
 * 公式编辑器 — 带变量面板、函数面板、实时验证
 */
import { useState, useEffect, useRef } from "react";
import { ALLOWED_VARIABLES, ALLOWED_FUNCTIONS, VARIABLE_LABELS, RULE_TEMPLATES, validateFormula } from "@/lib/feeRuleEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const FUNCTION_DOCS = [
  { sig: 'if(condition, trueValue, falseValue)', desc: '条件判断' },
  { sig: 'min(a, b)', desc: '取较小值' },
  { sig: 'max(a, b)', desc: '取较大值' },
  { sig: 'clamp(value, min, max)', desc: '限制在范围内' },
  { sig: 'round(value)', desc: '四舍五入' },
  { sig: 'ceil(value)', desc: '向上取整' },
  { sig: 'floor(value)', desc: '向下取整' },
  { sig: 'roundTo(value, unit)', desc: '取整到指定单位' },
  { sig: 'ceilTo(value, unit)', desc: '向上取到指定单位' },
  { sig: 'floorTo(value, unit)', desc: '向下取到指定单位' },
];

export default function FormulaEditor({ value, onChange, disabled }) {
  const [validation, setValidation] = useState(null);
  const [showVars, setShowVars] = useState(true);
  const [showFns, setShowFns] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!value?.trim()) { setValidation(null); return; }
    const timer = setTimeout(() => {
      setValidation(validateFormula(value));
    }, 400);
    return () => clearTimeout(timer);
  }, [value]);

  const insertAtCursor = (text) => {
    const el = textareaRef.current;
    if (!el) { onChange((value || '') + text); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = (value || '').slice(0, start) + text + (value || '').slice(end);
    onChange(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 10);
  };

  return (
    <div className="space-y-3">
      {/* Textarea */}
      <div>
        <textarea
          ref={textareaRef}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="例: max(goodsAmount * 8%, 500)"
          className={`w-full px-3 py-2 text-sm font-mono rounded-md border resize-y focus:outline-none focus:ring-1 ${
            validation === null ? 'border-gray-200 focus:ring-gray-400' :
            validation.valid ? 'border-green-400 focus:ring-green-400' :
            'border-red-400 focus:ring-red-400'
          } bg-white disabled:bg-gray-50 disabled:text-gray-400`}
        />
        {/* Validation feedback */}
        {validation && (
          <div className={`flex items-center gap-1.5 text-xs mt-1 ${validation.valid ? 'text-green-600' : 'text-red-600'}`}>
            {validation.valid
              ? <><CheckCircle2 className="w-3.5 h-3.5" />公式语法正确</>
              : <><AlertCircle className="w-3.5 h-3.5" />{validation.error}</>
            }
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100"
          onClick={() => setShowTemplates(v => !v)}
        >
          <span>规则模板</span>
          {showTemplates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showTemplates && (
          <div className="divide-y divide-gray-50">
            {RULE_TEMPLATES.map((t, i) => (
              <button
                key={i}
                type="button"
                className="w-full flex items-start justify-between px-3 py-2 hover:bg-blue-50 text-left"
                onClick={() => onChange(t.formula)}
              >
                <div>
                  <div className="text-xs font-medium text-gray-700">{t.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>
                </div>
                <code className="text-xs text-blue-600 ml-3 mt-0.5 font-mono whitespace-nowrap">{t.formula}</code>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variables panel */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100"
          onClick={() => setShowVars(v => !v)}
        >
          <span>可用变量（点击插入）</span>
          {showVars ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showVars && (
          <div className="p-2 flex flex-wrap gap-1.5">
            {ALLOWED_VARIABLES.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => insertAtCursor(v)}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-mono transition-colors"
              >
                {v}
                <span className="text-blue-400 font-sans font-normal text-[10px]">{VARIABLE_LABELS[v]?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Functions panel */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100"
          onClick={() => setShowFns(v => !v)}
        >
          <span>可用函数（点击插入）</span>
          {showFns ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showFns && (
          <div className="p-2 space-y-1">
            {FUNCTION_DOCS.map((fn, i) => (
              <button
                key={i}
                type="button"
                onClick={() => insertAtCursor(fn.sig.split('(')[0] + '(')}
                className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-purple-50 rounded text-left"
              >
                <code className="text-xs text-purple-600 font-mono">{fn.sig}</code>
                <span className="text-xs text-gray-400">{fn.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Operator quick reference */}
      <div className="text-xs text-gray-400 flex flex-wrap gap-2">
        {['+ - * / %', '> >= < <= == !=', 'and or not', 'in contains'].map((g, i) => (
          <code key={i} className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{g}</code>
        ))}
      </div>
    </div>
  );
}