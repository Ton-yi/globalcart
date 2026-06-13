import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { HelpCircle, ChevronDown, ChevronUp, Search, BookOpen, ArrowLeft, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function FaqItemBlock({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-white hover:bg-gray-50 transition-colors"
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
      </button>
      {open && (
        <div className="px-4 pb-5 pt-3 bg-gray-50 border-t border-gray-100">
          <ReactMarkdown className="prose prose-sm max-w-none text-gray-600">
            {item.answer}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function HelpCenter() {
  const { user } = useCurrentUser();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);

  const isAdmin = user?.role === "admin" || user?.role === "tenant_admin" || user?.role === "platform_admin";

  useEffect(() => {
    base44.functions.invoke('getPublicHomeConfig', { hostname: window.location.hostname })
      .then(r => {
        const cats = (r.data?.faqCategories || []).filter(c => c.is_active !== false && (c.items || []).length > 0);
        setCategories(cats);
        // 从 URL 参数中读取指定分类
        const params = new URLSearchParams(location.search);
        const catParam = params.get('cat');
        const target = catParam && cats.find(c => c.id === catParam);
        setActiveCategory(target ? target.id : (cats[0]?.id || null));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = categories.map(cat => ({
    ...cat,
    items: (cat.items || []).filter(item => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (item.question || "").toLowerCase().includes(q) || (item.answer || "").toLowerCase().includes(q);
    }),
  })).filter(cat => cat.items.length > 0);

  const displayCategories = search ? filtered : categories;
  const activeItems = search
    ? filtered.flatMap(c => c.items)
    : (categories.find(c => c.id === activeCategory)?.items || []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl("Home")} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <BookOpen className="w-5 h-5 text-teal-500" />
          <h1 className="text-xl font-bold text-gray-900">帮助中心</h1>
        </div>
        {isAdmin && (
          <Link to={createPageUrl("AdminFaq")}>
            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors border border-gray-200 rounded-md px-2 py-1 hover:border-teal-300">
              <Settings className="w-3.5 h-3.5" />管理问答
            </button>
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-9 h-10"
          placeholder="搜索常见问题…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">加载中…</div>
      )}

      {!loading && categories.length === 0 && (
        <div className="text-center py-16">
          <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暂无帮助内容</p>
        </div>
      )}

      {!loading && categories.length > 0 && (
        <div className="flex gap-6">
          {/* Sidebar — category list (hidden when searching) */}
          {!search && (
            <div className="w-48 flex-shrink-0 space-y-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeCategory === cat.id
                      ? "bg-teal-50 text-teal-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                  {cat.title}
                  <span className="ml-1 text-xs text-gray-400">({(cat.items || []).length})</span>
                </button>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 min-w-0">
            {search ? (
              // Search results — show all matching across categories
              <div className="space-y-6">
                {filtered.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">未找到相关问题</p>
                )}
                {filtered.map(cat => (
                  <div key={cat.id}>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {cat.icon && <span className="mr-1">{cat.icon}</span>}
                      {cat.title}
                    </h2>
                    <div className="space-y-2">
                      {cat.items.map((item, i) => (
                        <FaqItemBlock key={item._id || i} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Category view
              <div>
                {(() => {
                  const cat = categories.find(c => c.id === activeCategory);
                  if (!cat) return null;
                  return (
                    <div>
                      <div className="mb-4">
                        <h2 className="text-base font-semibold text-gray-800">
                          {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                          {cat.title}
                        </h2>
                        {cat.description && (
                          <p className="text-xs text-gray-500 mt-1">{cat.description}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(cat.items || []).map((item, i) => (
                          <FaqItemBlock key={item._id || i} item={item} />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}