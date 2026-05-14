import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { fetchTenantConfig } from "@/lib/tenantApi";
import { getTenantConfigCache } from "@/lib/configCache";
import { getCurrentSubdomain } from "@/lib/tenantBranding";
import { 
  ShoppingBag, Package, Truck, User, Settings, 
  Bell, LogOut, Menu, X, Shield,
  Home, Users, BarChart3, Store, Send
} from "lucide-react";
import { MidnightToggle } from "@/components/common/ThemeSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

export default function Layout({ children, currentPageName }) {
  const { user, tenantBranding, authError } = useAuth();
  const { can } = usePermissions();
  const isSuspended = authError?.type === 'account_suspended';
  const tenant = tenantBranding?.tenant || null;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const location = useLocation();

  // Apply favicon if tenant has one
  useEffect(() => {
    if (tenant?.favicon_url) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = tenant.favicon_url;
    }
    if (tenant?.branding_name) {
      document.title = tenant.branding_name;
    }
  }, [tenant?.favicon_url, tenant?.branding_name]);

  // Pages that load their own config via a page-level API (e.g. getAdminSettingsPageData).
  // Layout must not trigger fetchTenantConfig for these — they populate the cache themselves.
  const SELF_CONFIG_PAGES = new Set(["AdminSettings"]);

  useEffect(() => {
    if (!user) return;

    // If cache is already warm (populated by a page-level fetch), use it immediately.
    const cached = getTenantConfigCache();
    if (cached) {
      setAnnouncements(cached.announcements || []);
      return;
    }

    // Skip fetching entirely for pages that self-supply config —
    // they will populate the cache, and announcements will update on next navigation.
    if (SELF_CONFIG_PAGES.has(currentPageName)) return;

    fetchTenantConfig()
      .then(cfg => setAnnouncements(cfg.announcements || []))
      .catch(() => {});
  }, [user?.email, currentPageName]);

  const isPlatformAdmin = user?.role === "platform_admin";
  const isTenantAdmin = user?.role === "admin" || user?.role === "tenant_admin";
  const isStaff = user?.role === "staff";
  const isTenantUser = user?.role === "user";
  const isAdmin = isPlatformAdmin || isTenantAdmin;
  
  // Platform admin has all permissions; tenant admin has tenant-level permissions
  const canAccessAdminSettings = isPlatformAdmin || isTenantAdmin;
  const canAccessAdminDashboard = isPlatformAdmin || isTenantAdmin;
  const canAccessAdminOrders = isPlatformAdmin || isTenantAdmin || can("order:update");
  const canAccessAdminShippingPool = isPlatformAdmin || isTenantAdmin || can("shipping_pool:update");
  const canAccessAdminUsers = isPlatformAdmin || isTenantAdmin || can("user:read");
  const canAccessAdminAnnouncements = isPlatformAdmin || isTenantAdmin;

  const userNav = [
    { label: "首页", icon: Home, page: "Home" },
    { label: "提交需求", icon: ShoppingBag, page: "SubmitOrder", requiredRole: "user" },
    { label: "我的订单", icon: Package, page: "MyOrders", requiredRole: "user" },
    { label: "发货 & 拼邮", icon: Send, page: "ShippingPool", requiredRole: "user" },
    { label: "个人设置", icon: User, page: "UserPreferences" },
  ];

  const tenantAdminNav = [
    { label: "管理总览", icon: BarChart3, page: "AdminDashboard", canAccess: canAccessAdminDashboard },
    { label: "订单管理", icon: Package, page: "AdminOrders", canAccess: canAccessAdminOrders },
    { label: "发货池", icon: Send, page: "AdminShippingPool", canAccess: canAccessAdminShippingPool },
    { label: "用户管理", icon: Users, page: "AdminUsers", canAccess: canAccessAdminUsers },
    { label: "公告管理", icon: Bell, page: "AdminAnnouncements", canAccess: canAccessAdminAnnouncements },
    { label: "网站设置", icon: Settings, page: "AdminSettings", canAccess: canAccessAdminSettings },
  ];

  const platformAdminNav = [
    { label: "平台设置", icon: Settings, page: "PlatformAdminSettings", requiredRole: "platform_admin" },
  ];

  // Build navigation based on roles
  let navItems = [userNav[0]]; // Always show Home
  
  if (isPlatformAdmin) {
    // Platform admin: show all admin items plus personal profile
    navItems = [...navItems, ...platformAdminNav, ...tenantAdminNav.filter(item => item.canAccess), { label: "个人档案", icon: User, page: "UserPreferences" }];
  } else if (isTenantAdmin) {
    // Tenant admin: show tenant admin items plus personal profile
    navItems = [...navItems, ...tenantAdminNav.filter(item => item.canAccess), { label: "个人档案", icon: User, page: "UserPreferences" }];
  } else if (isStaff) {
    // Staff: show user pages + any admin pages they have permission for
    const staffAdminItems = tenantAdminNav.filter(item => item.canAccess);
    navItems = [...navItems, ...userNav.slice(1), ...staffAdminItems, { label: "个人档案", icon: User, page: "UserPreferences" }];
  } else if (isTenantUser) {
    navItems = [...navItems, ...userNav.slice(1), { label: "个人档案", icon: User, page: "UserPreferences" }];
  } else {
    navItems = userNav;
  }

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
      {/* Account Suspended Banner */}
      {isSuspended && (
        <div className="bg-red-600 text-white px-4 py-3 text-sm text-center font-medium flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          您的账户已被停用。所有操作已被禁止，请联系管理员处理。
          <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-red-700 h-6 px-2 text-xs ml-2"
            onClick={() => base44.auth.logout()}>退出登录</Button>
        </div>
      )}
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
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.branding_name} className="h-7 w-auto object-contain" />
              ) : (
                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tenant?.theme_color || '#dc2626' }}>
                  <span className="text-white text-xs font-bold">{(tenant?.branding_name || "同一").slice(0, 2)}</span>
                </div>
              )}
              <span className="font-semibold text-gray-900 text-sm">{tenant?.branding_name || "同一物流"}</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ label, icon: NavIcon, page }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                  currentPageName === page
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <NavIcon className="w-3.5 h-3.5" />
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
            <MidnightToggle />
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
            {navItems.map(({ label, icon: NavIcon, page }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                  currentPageName === page ? "bg-gray-100 font-medium" : "text-gray-600"
                }`}
              >
                <NavIcon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative">
        {isSuspended && (
          <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="text-center p-8">
              <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-800">账户已停用</p>
              <p className="text-sm text-gray-500 mt-1">您的账户已被管理员停用，无法进行任何操作。</p>
              <p className="text-sm text-gray-500 mt-0.5">请联系管理员解除限制。</p>
            </div>
          </div>
        )}
        {children}
      </main>

      <footer className="border-t bg-white mt-10 py-6 text-center text-xs text-gray-400">
        © 2026 同一物流 Tongyi Express · 日本 → 全球 · 安心・信頼・快捷
      </footer>
    </div>
  );
}