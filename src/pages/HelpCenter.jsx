import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, HelpCircle, ArrowLeft, ArrowRight, Settings } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const SECTIONS = [
  {
    key: "faq",
    path: "helpcenter/faq",
    icon: HelpCircle,
    iconColor: "text-teal-500",
    bgColor: "bg-teal-50",
    title: "常见问题",
    description: "查找关于下单、发货、付款等常见疑问的解答",
  },
  // 未来可在此添加更多模块，例如：
  // { key: "guide", page: "HelpCenterGuide", title: "使用指南", ... }
];

export default function HelpCenter() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "tenant_admin" || user?.role === "platform_admin";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
              <Settings className="w-3.5 h-3.5" />管理内容
            </button>
          </Link>
        )}
      </div>

      <p className="text-sm text-gray-500">选择下方分类，查找您需要的帮助内容。</p>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map(sec => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.key}
              to={createPageUrl(sec.path)}
              className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-teal-300 hover:shadow-sm transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg ${sec.bgColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${sec.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{sec.title}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{sec.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}