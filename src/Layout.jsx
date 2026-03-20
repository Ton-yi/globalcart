import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  ShoppingBag, Package, Truck, User, Settings, 
  Bell, LogOut, Menu, X, ChevronDown, Shield,
  Home, Users, BarChart3, Store, Send
} from "lucide-react";
import { MidnightToggle } from "@/components/common/ThemeSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Announcement.filter({ is_active: true }, "-created_date", 3)
      .then(setAnnouncements).catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin";

  const userNav = [
    { label: "首页", icon: Home, page: "Home" },
    { label: "提交需求", icon: ShoppingBag, page: "SubmitOrder" },
    { label: "我的订单", icon: Package, page: "MyOrders" },
    { label: "发货 & 拼邮", icon: Send, page: "ShippingPool" },
    { label: "个人设置", icon: User, page: "UserPreferences" },
  ];

  const adminNav = [
    { label: "管理总览", icon: BarChart3, page: "AdminDashboard" },
    { label: "订单管理", icon: Package, page: "AdminOrders" },
    { label: "发货管理", icon: Truck, page: "AdminShipping" },
    { label: "发货池", icon: Send, page: "AdminShippingPool" },
    { label: "用户管理", icon: Users, page: "AdminUsers" },
    { label: "公告管理", icon: Bell, page: "AdminAnnouncements" },
    { label: "网站设置", icon: Settings, page: "AdminSettings" },
  ];

  const navItems = isAdmin ? [...userNav.slice(0,1), ...adminNav] : userNav;

  const activeAnnouncement = announcements.find(a => 
    a.target_audience === "all" || 
    (isAdmin ? a.target_audience === "admins" : a.target_audience === "users")
  );

  const typeColors = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    success: "bg-green-50 border-green-200 text-green-800",
    urgent: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top Announcement Banner */}
      {activeAnnouncement && (
        <div className={`border-b px-4 py-2 text-sm text-center ${typeColors[activeAnnouncement.type] || typeColors.info}`}>
          <Bell className="inline w-3.5 h-3.5 mr-1" />
          <strong>{activeAnnouncement.title}：</strong> {activeAnnouncement.content}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to={createPageUrl("Home")} className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">同一</span>
              </div>
              <span className="font-semibold text-gray-900 text-sm">同一物流</span>
              <span className="text-gray-400 text-xs hidden sm:inline">Tongyi Express</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ label, icon: Icon, page }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                  currentPageName === page
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
            {/* Shop placeholder */}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-400 cursor-default">
              <Store className="w-3.5 h-3.5" />
              商城
              <Badge variant="outline" className="text-xs px-1 py-0 ml-1">即将上线</Badge>
            </span>
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                <Shield className="w-3 h-3 mr-1" />管理员
              </Badge>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:inline">{user.full_name || user.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 h-7 px-2"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" className="h-7 text-xs" onClick={() => base44.auth.redirectToLogin()}>
                登录
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            {navItems.map(({ label, icon: Icon, page }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                  currentPageName === page ? "bg-gray-100 font-medium" : "text-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      <footer className="border-t bg-white mt-10 py-6 text-center text-xs text-gray-400">
        © 2026 同一物流 Tongyi Express · 日本 → 全球 · 安心・信頼・快捷
      </footer>
    </div>
  );
}