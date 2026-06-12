/**
 * 导航注册表：定义所有可用的导航入口（key → 默认文字/图标/页面）。
 * 租户可通过 NavbarSettings 配置树（显示/隐藏、改名、排序、最多三层嵌套）。
 */
import {
  Home, ShoppingBag, UserPlus, Package, Send, User,
  BarChart3, Layers, Users, Settings, Bell, Zap, FileText, Navigation, Crown,
} from "lucide-react";

export const NAV_REGISTRY = {
  user: {
    Home: { label: "首页", icon: Home, page: "Home" },
    SubmitOrder: { label: "提交需求", icon: ShoppingBag, page: "SubmitOrder" },
    SubmitOrderPlain: { label: "普通下单", icon: ShoppingBag, page: "SubmitOrder" },
    GroupBuy: { label: "拼下单", icon: UserPlus, page: "GroupBuy" },
    MyOrders: { label: "我的订单", icon: Package, page: "MyOrders" },
    ShippingPool: { label: "发货 & 拼邮", icon: Send, page: "ShippingPool" },
    Profile: { label: "个人档案", icon: User, page: "AdminUserDetail/me" },
    MemberTiers: { label: "会员阶级", icon: Crown, page: "MemberTiers" },
  },
  admin: {
    AdminDashboard: { label: "管理总览", icon: BarChart3, page: "AdminDashboard" },
    AdminOrders: { label: "订单管理", icon: Package, page: "AdminOrders" },
    AdminShippingPool: { label: "发货池", icon: Send, page: "AdminShippingPool" },
    AdminTransitWork: { label: "中转地工作面板", icon: Layers, page: "AdminTransitWork" },
    AdminUsers: { label: "用户管理", icon: Users, page: "AdminUsers" },
    AdminSettings: { label: "网站设置", icon: Settings, page: "AdminSettings" },
    AdminAnnouncements: { label: "公告管理", icon: Bell, page: "AdminAnnouncements" },
    AdminFeeRules: { label: "服务费规则", icon: Zap, page: "AdminFeeRules" },
    AdminReports: { label: "财务报表", icon: BarChart3, page: "AdminReports" },
    AdminNotificationTemplates: { label: "通知模板", icon: FileText, page: "AdminNotificationTemplates" },
    AdminNotificationDefaults: { label: "通知默认设置", icon: Settings, page: "AdminNotificationDefaults" },
    AdminNavbarSettings: { label: "导航栏设置", icon: Navigation, page: "AdminNavbarSettings" },
    AdminSettingsHome: { label: "网站设置", icon: Settings, page: "AdminSettings" },
  },
};

export const DEFAULT_NAV_TREES = {
  user: [
    { key: "Home" },
    { key: "SubmitOrder", children: [{ key: "SubmitOrderPlain" }, { key: "GroupBuy" }] },
    { key: "MyOrders" },
    { key: "ShippingPool" },
    { key: "Profile", children: [{ key: "MemberTiers" }] },
  ],
  admin: [
    { key: "AdminDashboard" },
    { key: "AdminOrders" },
    { key: "AdminShippingPool", children: [{ key: "AdminTransitWork" }] },
    { key: "AdminUsers" },
    { key: "AdminSettings", children: [
      { key: "AdminAnnouncements" },
      { key: "AdminFeeRules" },
      { key: "AdminReports" },
      { key: "AdminNotificationTemplates" },
      { key: "AdminNotificationDefaults" },
      { key: "AdminNavbarSettings" },
      { key: "AdminSettingsHome" },
    ]},
  ],
};

function collectKeys(nodes, set = new Set()) {
  if (!Array.isArray(nodes)) return set;
  for (const n of nodes || []) {
    if (!n || typeof n.key !== 'string') continue;
    set.add(n.key);
    collectKeys(n.children, set);
  }
  return set;
}

/**
 * 合并已保存的配置树与默认树：配置中缺少的注册项（如后续新增的功能入口）追加到根级末尾。
 */
export function mergeNavTree(configTree, group) {
  if (!Array.isArray(configTree) || !configTree.length) {
    return JSON.parse(JSON.stringify(DEFAULT_NAV_TREES[group]));
  }
  const present = collectKeys(configTree);
  const additions = [];
  const addMissing = (nodes) => {
    for (const n of nodes) {
      if (!present.has(n.key)) {
        additions.push({
          key: n.key,
          children: (n.children || []).filter(c => !present.has(c.key)).map(c => ({ key: c.key })),
        });
      } else if (n.children) {
        addMissing(n.children);
      }
    }
  };
  addMissing(DEFAULT_NAV_TREES[group]);
  return [...JSON.parse(JSON.stringify(configTree)), ...additions];
}

/**
 * 把配置树构建成可渲染的导航项（过滤隐藏项与无权限项，应用文字覆盖）。
 */
export function buildNav(tree, group, { access = {}, labelOverrides = {} } = {}) {
  const registry = NAV_REGISTRY[group];
  const walk = (nodes, depth = 1) => (Array.isArray(nodes) && depth <= 3 ? nodes : [])
    .filter(n => n && registry[n.key] && !n.hidden && access[n.key] !== false)
    .map(n => {
      const reg = registry[n.key];
      return {
        key: n.key,
        label: n.label || labelOverrides[n.key] || reg.label,
        icon: reg.icon,
        page: reg.page,
        children: walk(n.children, depth + 1),
      };
    });
  return walk(tree);
}

export function navTreeHasPage(nodes, pageName) {
  return (nodes || []).some(n => n.page === pageName || navTreeHasPage(n.children, pageName));
}