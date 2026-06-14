/**
 * NavbarRateWidget
 * 导航栏内嵌汇率显示（紧凑单行）
 * props:
 *   currencies: string[]  — 从 navbar_exchange_rate_config 读取
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp } from "lucide-react";

let _cache = null;
let _cacheTs = 0;

async function fetchRates() {
  const now = Date.now();
  if (_cache && now - _cacheTs < 5 * 60 * 1000) return _cache;
  try {
    const r = await base44.functions.invoke("fetchExchangeRates", {});
    if (r.data?.rates) { _cache = r.data.rates; _cacheTs = now; return _cache; }
  } catch { /* noop */ }
  return _cache;
}

function fmt(val, code) {
  if (!val) return "---";
  const noDecimal = ["KRW", "IDR", "VND"];
  if (noDecimal.includes(code)) return Math.round(val * 100).toLocaleString();
  return (val * 100).toFixed(2);
}

export default function NavbarRateWidget({ currencies = [] }) {
  const [rates, setRates] = useState(null);

  useEffect(() => {
    if (!currencies.length) return;
    fetchRates().then(setRates);
  }, [currencies.join(",")]);

  if (!currencies.length || !rates) return null;

  return (
    <div className="hidden md:flex items-center gap-2 px-2">
      {currencies.map(code => {
        const val = rates[`jpy_${code.toLowerCase()}`] ?? rates[code];
        return (
          <span key={code} className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
            <TrendingUp className="w-3 h-3" />
            100¥={fmt(val, code)}{code}
          </span>
        );
      })}
    </div>
  );
}