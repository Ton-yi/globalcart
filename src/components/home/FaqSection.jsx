import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

function resolveAudienceConfig(config, user) {
  if (!config) return null;
  if ("guest" in config || "user" in config || "admin" in config) {
    if (config.unified) return config.guest || {};
    const isAdmin = user?.role === "admin" || user?.role === "tenant_admin" || user?.role === "platform_admin" || user?.role === "staff";
    if (isAdmin && config.admin) return config.admin;
    if (user && config.user) return config.user;
    return config.guest || {};
  }
  return config;
}

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800 flex-1 pr-3">{item.question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqSection({ config, user }) {
  const cfg = resolveAudienceConfig(config, user);
  if (!cfg || cfg.visible === false) return null;
  const items = (cfg.items || []).filter(it => it.question);
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4 text-teal-500" />
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {cfg.title || "常见问题"}
        </h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <FaqItem key={item._id || i} item={item} />
        ))}
      </div>
    </div>
  );
}