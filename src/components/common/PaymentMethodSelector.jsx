/**
 * PaymentMethodSelector
 * Fetches active payment methods from backend and renders a selection grid.
 * Falls back to a default set if none are configured.
 * Used in: PaymentModal, BulkPaymentModal, ShippingPoolDetailModal, Payment page.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const FALLBACK_METHODS = [
  { id: "alipay",        provider_key: "alipay",        name: "支付宝",   icon: "💳", color: "bg-blue-100 text-blue-700" },
  { id: "wechatpay",     provider_key: "wechatpay",     name: "微信支付", icon: "💬", color: "bg-green-100 text-green-700" },
  { id: "bank_transfer", provider_key: "bank_transfer", name: "银行转账", icon: "🏦", color: "bg-yellow-100 text-yellow-700" },
  { id: "other",         provider_key: "other",         name: "其他",     icon: "💰", color: "bg-gray-100 text-gray-600" },
];

/**
 * @param {string}   value       - currently selected method value (provider_key or name)
 * @param {function} onChange    - called with (method) where method = { value, label, payment_note, image_url }
 * @param {string}   className   - extra class for the grid wrapper
 * @param {Array}    prefetched  - optional pre-fetched methods list (skip fetching)
 * @param {string}   activeColor - tailwind classes for active border, e.g. "border-blue-500 bg-blue-50 text-blue-700"
 */
export default function PaymentMethodSelector({ value, onChange, className = "", prefetched = null, activeColor = "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200" }) {
  const [methods, setMethods] = useState(prefetched ?? null);
  const [loading, setLoading] = useState(prefetched === null);

  useEffect(() => {
    if (prefetched !== null) {
      setMethods(prefetched);
      setLoading(false);
      return;
    }
    setLoading(true);
    base44.functions.invoke('managePaymentMethod', { action: 'list' })
      .then(r => {
        const list = r.data?.methods || [];
        setMethods(list.length > 0 ? list : FALLBACK_METHODS);
      })
      .catch(() => setMethods(FALLBACK_METHODS))
      .finally(() => setLoading(false));
  }, [prefetched]);

  if (loading) {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-11 rounded-lg border-2 border-gray-100 bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  const displayMethods = methods ?? FALLBACK_METHODS;

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {displayMethods.map(m => {
        // Determine the key used as the "value" — prefer provider_key if set, else use name
        const methodValue = m.provider_key || m.name;
        const isActive = value === methodValue;
        return (
          <button
            key={m.id || methodValue}
            type="button"
            onClick={() => onChange({ value: methodValue, label: m.name, payment_note: m.payment_note || "", image_url: m.image_url || "", icon: m.icon || "", color: m.color || "", payment_currency: m.payment_currency || "JPY" })}
            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-2 ${
              isActive ? activeColor : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {m.icon && <span className="text-base leading-none">{m.icon}</span>}
            <span>{m.name}</span>
          </button>
        );
      })}
    </div>
  );
}