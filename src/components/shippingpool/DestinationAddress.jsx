import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { getCountry } from "@/lib/countries";

// Legacy shipments may have no address ID. Never infer a label from an ambiguous match.
export function resolveDestinationAddressLabel(pool, addresses) {
  const candidates = pool.final_address_id
    ? addresses.filter(address => address.id === pool.final_address_id)
    : (pool.recipient_name && pool.address_line1 ? addresses.filter(address =>
        address.recipient_name === pool.recipient_name && address.addr1 === pool.address_line1 &&
        (address.addr2 || "") === (pool.address_line2 || "") &&
        address.country === (pool.country || pool.destination_country) &&
        (!pool.city || address.addr3 === pool.city) &&
        (!pool.state || address.state === pool.state) &&
        (!pool.recipient_phone || address.phone === pool.recipient_phone) &&
        (!pool.postal_code || address.postal_code === pool.postal_code)) : []);
  return candidates.length === 1 ? (candidates[0].label?.trim() || "") : "";
}

// Address-book → ShippingPool snapshot mapping:
// recipient_name → recipient_name; phone → recipient_phone; country → destination_country;
// addr1 → address_line1; addr2 → address_line2; addr3 → city; state → state.
// Never replace a shipment's saved address with the current address-book contents.
export default function DestinationAddress({ pool, addressLabel = "" }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const country = pool.country || pool.destination_country || "";
  const rows = [
    ["recipient_name", "受取人お名前", pool.recipient_name],
    ["country", "受取人国名", getCountry(country)?.name || country],
    ["address_line1", "住所1 部屋番号、マンション名", pool.address_line1],
    ["address_line2", "住所2 ○番－○号 町名、○丁目", pool.address_line2],
    ["city", "住所3 区市町村名", pool.city],
    ["state", "州名など", pool.state],
    ["recipient_phone", "連絡先電話番号", pool.recipient_phone],
    ...(pool.postal_code ? [["postal_code", "郵便番号", pool.postal_code]] : []),
  ];
  if (!rows.some(([, , value]) => value)) return null;

  const copy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(key);
      setCopyError(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopyError(true); // Do not claim success if browser clipboard access fails.
    }
  };
  // Copy only populated address VALUES, in display order. The optional address label is excluded.
  const fullAddress = rows.map(([, , value]) => value).filter(Boolean).join("\n");

  // Latest design: summary is descriptive and disappears when expanded.
  // Field names are retained for accessible copy labels, never as visible prefixes.
  // Empty snapshot fields are omitted; button backgrounds remain transparent at rest.
  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-1.5 min-w-0">
          <span className="text-xs font-medium text-blue-600">发货目的地</span>
          {!expanded && <span className="text-[11px] font-normal text-slate-400 break-words" translate="no">
            = {addressLabel.trim() && <>{addressLabel} · </>}{pool.recipient_name || "未填写"} · {getCountry(country)?.name || country || "未填写"}
          </span>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" aria-label="复制全部收货地址（不含地址标签）" title="复制全部收货地址（不含地址标签）"
            onClick={() => copy("all", fullAddress)}
            className={`inline-flex h-6 w-6 items-center justify-center rounded bg-transparent transition-colors hover:bg-blue-100/60 hover:text-blue-700 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-300 ${copied === "all" ? "text-green-600" : "text-slate-400"}`}>
            {copied === "all" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          </button>
          <button type="button" aria-expanded={expanded} aria-controls={`destination-${pool.id}`} aria-label={expanded ? "收起收货地址" : "展开收货地址"}
            onClick={() => setExpanded(value => !value)} className="inline-flex h-6 w-6 items-center justify-center rounded bg-transparent text-sm text-slate-400 hover:bg-blue-100/60 hover:text-blue-700 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-300">{expanded ? "↓" : "←"}</button>
        </div>
      </div>
      {expanded && <div id={`destination-${pool.id}`} className="ml-2 mt-1 pl-1">
        {rows.filter(([, , value]) => value).map(([key, label, value]) => <div key={key} className="leading-snug">
          <button type="button" aria-label={`复制${label}`} onClick={() => copy(key, value)} translate="no"
            className={`max-w-full break-words whitespace-pre-wrap text-left rounded border-0 bg-transparent px-1 py-0.5 text-sm transition-colors hover:bg-blue-100/60 hover:text-blue-700 active:bg-blue-200/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-300 ${copied === key ? "text-green-700" : "text-slate-600"}`}>{value}</button>
        </div>)}
      </div>}
      <span className="sr-only" role="status" aria-live="polite">{copied ? "已复制到剪贴板" : ""}</span>
      {copyError && <p className="mt-2 text-xs text-red-600" role="alert">复制失败，请检查浏览器剪贴板权限。</p>}
    </section>
  );
}
