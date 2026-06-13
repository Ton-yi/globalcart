import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronDown, ChevronUp, HelpCircle, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

function FaqItem({ item, categoryId }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <Link
        to={`${createPageUrl("helpcenter/faq")}${categoryId ? `?cat=${categoryId}` : ""}`}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors group"
        onClick={e => { e.preventDefault(); setOpen(o => !o); }}
      >
        <div className="flex-1 pr-3">
          <ReactMarkdown
            className="prose prose-sm max-w-none text-gray-800 font-medium [&>p]:my-0"
            components={{ p: ({ children }) => <span>{children}</span> }}
          >
            {item.question}
          </ReactMarkdown>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </Link>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
          <ReactMarkdown className="prose prose-sm max-w-none text-gray-600">
            {item.answer}
          </ReactMarkdown>
          <Link
            to={`${createPageUrl("helpcenter/faq")}${categoryId ? `?cat=${categoryId}` : ""}`}
            className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-2"
          >
            查看更多 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function FaqSection({ config, faqCategories, user }) {
  const cfg = resolveAudienceConfig(config, user);
  if (!cfg || cfg.visible === false) return null;

  // Resolve items: either from selected categories or legacy inline items
  let displayItems = [];
  let categoryId = null;

  if (cfg.selected_category_ids && faqCategories?.length) {
    // New category-based mode
    const selectedIds = cfg.selected_category_ids;
    const selectedCats = (faqCategories || []).filter(c => selectedIds.includes(c.id));
    displayItems = selectedCats.flatMap(c => (c.items || []).map(item => ({ ...item, _catId: c.id })));
    // Limit display
    const limit = cfg.display_limit || 6;
    displayItems = displayItems.slice(0, limit);
  } else {
    // Legacy inline items
    displayItems = (cfg.items || []).filter(it => it.question);
  }

  if (displayItems.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-teal-500" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {cfg.title || "常见问题"}
          </h2>
        </div>
        <Link
          to={createPageUrl("helpcenter/faq")}
          className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 transition-colors"
        >
          查看全部 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {displayItems.map((item, i) => (
          <FaqItem key={item._id || i} item={item} categoryId={item._catId || categoryId} />
        ))}
      </div>
    </div>
  );
}