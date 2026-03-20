/**
 * CountrySelect - Searchable country selector using Japan Post EMS country list.
 * Groups countries by zone (地帯).
 * Props:
 *   - compact: boolean - smaller trigger, no zone label in button (for use in table rows)
 *   - allowZone: boolean - also allow selecting zone codes (zone1~zone5) directly
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { COUNTRY_ZONES, ALL_COUNTRIES } from "@/lib/countries";

const ZONE_OPTIONS = [
  { code: "zone1", name: "第1地帯", nameJa: "第1地帯（中国・韓国・台湾）", zone: "zone1" },
  { code: "zone2", name: "第2地帯", nameJa: "第2地帯（アジア）", zone: "zone2" },
  { code: "zone3", name: "第3地帯", nameJa: "第3地帯（大洋洲・北米・欧州等）", zone: "zone3" },
  { code: "zone4", name: "第4地帯", nameJa: "第4地帯（アメリカ合衆国）", zone: "zone4" },
  { code: "zone5", name: "第5地帯", nameJa: "第5地帯（中南米・アフリカ）", zone: "zone5" },
];

export default function CountrySelect({
  value,
  onChange,
  placeholder = "选择收货国家",
  className = "",
  compact = false,
  allowZone = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  const isZone = value && value.startsWith("zone");
  const selectedCountry = !isZone && value ? ALL_COUNTRIES.find(c => c.code === value) : null;
  const selectedZone = isZone ? ZONE_OPTIONS.find(z => z.code === value) : null;

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search.trim()
    ? ALL_COUNTRIES.filter(c =>
        c.name.includes(search) ||
        c.nameJa.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const handleSelect = (code) => {
    onChange(code);
    setOpen(false);
    setSearch("");
  };

  const displayLabel = selectedCountry
    ? compact
      ? selectedCountry.name
      : (
        <span className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">{COUNTRY_ZONES[selectedCountry.zone]?.label.split("（")[0]}</span>
          <span>{selectedCountry.name}</span>
        </span>
      )
    : selectedZone
      ? selectedZone.name
      : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring ${compact ? "h-7 text-xs px-2" : "h-9"}`}
      >
        {displayLabel ? (
          <span>{displayLabel}</span>
        ) : (
          <span className="text-muted-foreground text-xs">{placeholder}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-md border bg-popover text-popover-foreground shadow-md">
          {/* Search */}
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索国家..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-gray-400" /></button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* Zone options at top if allowZone */}
            {allowZone && !search.trim() && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-blue-50">按地带（zone）</div>
                {ZONE_OPTIONS.map(z => (
                  <button
                    key={z.code}
                    type="button"
                    onClick={() => handleSelect(z.code)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-accent hover:text-accent-foreground ${value === z.code ? "bg-accent font-medium" : ""}`}
                  >
                    <span>{z.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{z.nameJa}</span>
                  </button>
                ))}
              </div>
            )}

            {filtered ? (
              filtered.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">未找到匹配国家</div>
              ) : (
                filtered.map(c => (
                  <CountryItem key={c.code} country={c} selected={value === c.code} onSelect={handleSelect} />
                ))
              )
            ) : (
              Object.entries(COUNTRY_ZONES).map(([zone, { label, countries }]) => (
                <div key={zone}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-50 sticky top-0">{label}</div>
                  {countries.map(c => (
                    <CountryItem key={c.code} country={{ ...c, zone }} selected={value === c.code} onSelect={handleSelect} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryItem({ country, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(country.code)}
      className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-accent hover:text-accent-foreground ${selected ? "bg-accent font-medium" : ""}`}
    >
      <span>{country.name}</span>
      <span className="text-xs text-gray-400 ml-2">{country.nameJa}</span>
    </button>
  );
}