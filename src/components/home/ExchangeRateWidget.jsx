/**
 * ExchangeRateWidget
 * 主页各位置的汇率展示组件
 * props:
 *   currencies: string[]   — 要显示的币种列表（如 ["CNY","USD"]）
 *   compact: bool          — 紧凑模式（导航栏/标题旁）
 *   faqMode: bool          — FAQ 模式，渲染为问答条目
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Loader2 } from "lucide-react";

const CURRENCY_LABELS = {
  CNY: "人民币", USD: "美元", EUR: "欧元", TWD: "新台币",
  HKD: "港币", SGD: "新加坡元", KRW: "韩元", GBP: "英镑",
  AUD: "澳元", CAD: "加元", THB: "泰铢", MYR: "林吉特",
};

// 格式化金额：KRW等无小数，其他动态小数位；unit 为比例单位（默认100）
// 对于小于1的值，找到第一个有效数字位后再保留2位
function fmt(value, code, unit = 100) {
  if (!value) return "---";
  const noDecimal = ["KRW", "IDR", "VND"];
  const amount = value * unit;
  if (noDecimal.includes(code)) return Math.round(amount).toLocaleString();
  if (amount >= 1) return amount.toFixed(2);
  // 找到第一个非零小数位的位置，再多保留2位
  const str = amount.toFixed(20);
  const dotIdx = str.indexOf('.');
  let firstSigIdx = -1;
  for (let i = dotIdx + 1; i < str.length; i++) {
    if (str[i] !== '0') { firstSigIdx = i - dotIdx; break; }
  }
  const decimals = firstSigIdx >= 0 ? firstSigIdx + 1 : 4;
  return amount.toFixed(decimals);
}

let _rateCache = null;
let _rateCacheTs = 0;

async function fetchRates() {
  const now = Date.now();
  if (_rateCache && now - _rateCacheTs < 5 * 60 * 1000) return _rateCache;
  try {
    const r = await base44.functions.invoke("fetchExchangeRates", {});
    if (r.data?.rates) {
      _rateCache = r.data.rates;
      _rateCacheTs = now;
      return _rateCache;
    }
  } catch { /* noop */ }
  return _rateCache;
}

export default function ExchangeRateWidget({ currencies = [], compact = false, faqMode = false, heroOverlay = false, textColor = "", unit = 100 }) {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currencies.length) { setLoading(false); return; }
    fetchRates().then(r => { setRates(r); setLoading(false); });
  }, [currencies.join(",")]);

  if (!currencies.length) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>汇率加载中…</span>
      </div>
    );
  }

  // ── FAQ 模式 ─────────────────────────────────────────────
  if (faqMode) {
    return (
      <div className="space-y-3">
        {currencies.map(code => {
          const val = rates?.[`jpy_${code.toLowerCase()}`] ?? rates?.[code];
          const label = CURRENCY_LABELS[code] || code;
          return (
            <div key={code} className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 font-medium text-sm text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                {unit}日元兑{label}（{code}）是多少？
              </div>
              <div className="px-4 py-2.5 text-sm text-gray-600">
                当前汇率：<span className="font-bold text-emerald-700">{fmt(val, code, unit)} {code}</span>
                <span className="text-xs text-gray-400 ml-2">（含服务增量，实时更新）</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── 紧凑模式（标题旁/快捷操作区/看板内嵌）────────────────
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {currencies.map(code => {
          const val = rates?.[`jpy_${code.toLowerCase()}`] ?? rates?.[code];
          return (
            <span key={code} className="inline-flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full px-2.5 py-1 font-medium whitespace-nowrap">
              <TrendingUp className="w-3 h-3" />
              <span className="opacity-70">{unit}¥=</span>
              <span className="font-bold">{fmt(val, code, unit)}</span> {code}
            </span>
          );
        })}
      </div>
    );
  }

  // ── Hero 叠加模式（绝对定位覆盖在 Hero 图层上方）──────────
  if (heroOverlay) {
    const color = textColor || "#ffffff";
    return (
      <div className="flex flex-col gap-1 pointer-events-none">
        {currencies.map(code => {
          const val = rates?.[`jpy_${code.toLowerCase()}`] ?? rates?.[code];
          const label = CURRENCY_LABELS[code] || code;
          return (
            <div key={code} className="flex items-center gap-1.5 bg-black/25 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
              <TrendingUp className="w-3 h-3 flex-shrink-0" style={{ color }} />
              <span className="text-xs whitespace-nowrap" style={{ color, opacity: 0.85 }}>{label}</span>
              <span className="text-sm font-bold ml-auto whitespace-nowrap" style={{ color }}>
                {unit}¥={fmt(val, code, unit)} {code}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── 标准模式（Hero 左/右侧块）──────────────────────────────
  return (
    <div className="flex flex-col gap-1.5">
      {currencies.map(code => {
        const val = rates?.[`jpy_${code.toLowerCase()}`] ?? rates?.[code];
        const label = CURRENCY_LABELS[code] || code;
        return (
          <div key={code} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl px-3 py-2 shadow-sm">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs text-gray-500 whitespace-nowrap">{unit}¥→ {label}</span>
            <span className="text-sm font-bold text-emerald-700 ml-auto whitespace-nowrap">
              {fmt(val, code, unit)} {code}
            </span>
          </div>
        );
      })}
    </div>
  );
}