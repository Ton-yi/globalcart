import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { fetchTenantConfig } from "@/lib/tenantApi";
import { getTenantConfigCache } from "@/lib/configCache";
import { 
  ShoppingBag, Package, Truck, User, Settings, 
  Bell, LogOut, Menu, X, Shield, Globe,
  Home, Users, BarChart3, Store, Send, Zap, UserPlus, ChevronDown, Layers, FileText
} from "lucide-react";
import NotificationBell from "@/components/common/NotificationBell.jsx";
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
  const [isTransitManager, setIsTransitManager] = useState(false);
  const location = useLocation();

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

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.TransitLocation.filter({ manager_email: user.email, is_active: true })
      .then(locations => setIsTransitManager(locations.length > 0))
      .catch(() => {});
  }, [user?.email]);

  const SELF_CONFIG_PAGES = new Set(["AdminSettings"]);

  useEffect(() => {
    if (!user) return;
    const cached = getTenantConfigCache();
    if (cached) {
      setAnnouncements(cached.announcements || []);
      return;
    }
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
  
  const canAccessAdminSettings = isPlatformAdmin || isTenantAdmin || can("admin_settings:manage_backend_settings");
  const canAccessAdminDashboard = isPlatformAdmin || isTenantAdmin || can("view:admin_dashboard");
  const canAccessAdminOrders = isPlatformAdmin || isTenantAdmin || can("order:update") || can("view:order_management_page");
  const canAccessAdminShippingPool = isPlatformAdmin || isTenantAdmin || can("shipping_pool:update");
  const canAccessAdminUsers = isPlatformAdmin || isTenantAdmin || can("user:read") || can("view:user_management_page");
  const canAccessAdminAnnouncements = isPlatformAdmin || isTenantAdmin || can("view:announcement_management_page");
  const canViewMyOrders = isAdmin || isTenantUser || can("view:my_orders_module");
  const canAccessTransitWork = isAdmin || can("shipping:view_transit_panel");

  const userNav = [
    { label: "首页", icon: Home, page: "Home" },
    { label: "提交需求", icon: ShoppingBag, page: "SubmitOrder", requiredRole: "user", subItems: [
      { label: "普通下单", icon: ShoppingBag, page: "SubmitOrder" },
      { label: "拼下单", icon: UserPlus, page: "GroupBuy" },
    ]},
    { label: "我的订单", icon: Package, page: "MyOrders", requiredRole: "user", hidden: !canViewMyOrders },
    { label: isTransitManager ? "发货池" : "发货 & 拼邮", icon: Send, page: "ShippingPool", requiredRole: "user" },
    { label: "个人档案", icon: User, page: "AdminUserDetail/me" },
  ];

  const tenantAdminNav = [
    { label: "管理总览", icon: BarChart3, page: "AdminDashboard", canAccess: canAccessAdminDashboard },
    { label: "订单管理", icon: Package, page: "AdminOrders", canAccess: canAccessAdminOrders },
    { label: "中转发货", icon: Truck, page: "AdminTransitWork", canAccess: canAccessTransitWork },
    { label: "发货池", icon: Send, page: "AdminShippingPool", canAccess: canAccessAdminShippingPool, subItems: [
      { label: "中转地工作面板", icon: Layers, page: "AdminTransitWork" },
    ]},
    { label: "用户管理", icon: Users, page: "AdminUsers", canAccess: canAccessAdminUsers },
    { label: "网站设置", icon: Settings, page: "AdminSettings", canAccess: canAccessAdminSettings, subItems: [
    ...(canAccessAdminAnnouncements ? [{ label: "公告管理", icon: Bell, page: "AdminAnnouncements" }] : []),
    ...(canAccessAdminSettings ? [{ label: "服务费规则", icon: Zap, page: "AdminFeeRules" }] : []),
    { label: "财务报表", icon: BarChart3, page: "AdminReports" },
    { label: "通知模板", icon: FileText, page: "AdminNotificationTemplates" },
    { label: "通知默认设置", icon: Settings, page: "AdminNotificationDefaults" },
    { label: "网站设置", icon: Settings, page: "AdminSettings" },
    ]},
  ];

  const platformAdminNav = [
    { label: "平台设置", icon: Settings, page: "PlatformAdminSettings", requiredRole: "platform_admin", subItems: [
      { label: "跨租户通知", icon: Bell, page: "PlatformNotificationManager" },
      { label: "租户管理", icon: Globe, page: "PlatformAdminSettings" },
    ]},
  ];

  const visibleUserNav = userNav.filter(item => !item.hidden);
  let navItems = [visibleUserNav[0]];
  
  if (isPlatformAdmin) {
    navItems = [...navItems, ...visibleUserNav.slice(1), ...platformAdminNav, ...tenantAdminNav.filter(item => item.canAccess)];
  } else if (isTenantAdmin) {
    navItems = [...navItems, ...visibleUserNav.slice(1), ...tenantAdminNav.filter(item => item.canAccess)];
  } else if (isStaff) {
    const staffAdminItems = tenantAdminNav.filter(item => item.canAccess);
    navItems = [...navItems, ...visibleUserNav.slice(1), ...staffAdminItems];
  } else if (isTenantUser) {
    navItems = [...navItems, ...visibleUserNav.slice(1)];
  } else {
    navItems = visibleUserNav;
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
      {isSuspended && (
        <div className="bg-red-600 text-white px-4 py-3 text-sm text-center font-medium flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          您的账户已被停用。所有操作已被禁止，请联系管理员处理。
          <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-red-700 h-6 px-2 text-xs ml-2"
            onClick={() => base44.auth.logout()}>退出登录</Button>
        </div>
      )}
      {activeAnnouncement && (
        <div className={`border-b px-4 py-2 text-sm text-center ${typeColors[activeAnnouncement.type] || typeColors.info}`}>
          <Bell className="inline w-3.5 h-3.5 mr-1" />
          <strong>{activeAnnouncement.title}：</strong> {activeAnnouncement.content}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 flex items-center justify-between h-14">
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

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ label, icon: NavIcon, page, subItems }) => {
              const isActive = currentPageName === page || (subItems && subItems.some(s => s.page === currentPageName));
              if (subItems) {
                return (
                  <div key={page} className="relative group">
                    <Link to={createPageUrl(page)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                        isActive ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}>
                      <NavIcon className="w-3.5 h-3.5" />
                      {label}
                      <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
                    </Link>
                    <div className="absolute left-0 top-full pt-1 hidden group-hover:block z-50">
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                        {subItems.map(({ label: subLabel, icon: SubIcon, page: subPage }) => (
                          <Link key={subPage} to={createPageUrl(subPage)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              currentPageName === subPage ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}>
                            <SubIcon className="w-3.5 h-3.5" />
                            {subLabel}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <Link key={page} to={createPageUrl(page)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                    isActive ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}>
                  <NavIcon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-400 cursor-default">
              <Store className="w-3.5 h-3.5" />
              商城
              <Badge variant="outline" className="text-xs px-1 py-0 ml-1">即将上线</Badge>
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <MidnightToggle />
            {isAdmin && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                <Shield className="w-3 h-3 mr-1" />管理员
              </Badge>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:inline">{user.full_name || user.email}</span>
                <Button variant="ghost" size="sm" className="text-gray-500 h-7 px-2"
                  onClick={() => base44.auth.logout()}>
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

        {mobileOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            {navItems.map(({ label, icon: NavIcon, page, subItems }) => (
              <div key={page}>
                <Link to={createPageUrl(page)} onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                    currentPageName === page ? "bg-gray-100 font-medium" : "text-gray-600"
                  }`}>
                  <NavIcon className="w-4 h-4" />
                  {label}
                </Link>
                {subItems && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {subItems.map(({ label: subLabel, icon: SubIcon, page: subPage }) => (
                      <Link key={subPage} to={createPageUrl(subPage)} onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                          currentPageName === subPage ? "bg-gray-100 font-medium" : "text-gray-500"
                        }`}>
                        <SubIcon className="w-3.5 h-3.5" />
                        {subLabel}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative">
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