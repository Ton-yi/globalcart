import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Send, Package, Truck, ShoppingBag, MapPin, Bell, Users, Settings,
  BarChart3, Star, CreditCard, Globe, Home, MessageSquare, Archive, Layers, Zap,
  FileText, ClipboardList, Box, Warehouse, Receipt, CalendarDays, Search,
  Download, Upload, RefreshCw, Tag, Link as LinkIcon, Phone, Mail, QrCode,
  Banknote, Handshake,
} from "lucide-react";

const ICON_MAP = {
  Send, Package, Truck, ShoppingBag, MapPin, Bell, Users, Settings,
  BarChart3, Star, CreditCard, Globe, Home, MessageSquare, Archive, Layers, Zap,
  FileText, ClipboardList, Box, Warehouse, Receipt, CalendarDays, Search,
  Download, Upload, RefreshCw, Tag, Link: LinkIcon, Phone, Mail, QrCode,
  Banknote, Handshake,
};

// icon 字段以大写开头 → Lucide 图标，否则为 emoji 模式
function isEmojiMode(icon) {
  return !icon || icon === "emoji" || !/^[A-Z]/.test(icon);
}
function isImageMode(icon) {
  return icon === "custom_image";
}

function isVisible(action, userRole) {
  if (!action.visible_to || action.visible_to === "all") return true;
  const isAdmin = userRole === "admin" || userRole === "tenant_admin" || userRole === "platform_admin";
  const isStaff = isAdmin || userRole === "staff";
  if (action.visible_to === "admin") return isAdmin;
  if (action.visible_to === "staff") return isStaff;
  if (action.visible_to === "user") return userRole === "user";
  return true;
}

function ActionIcon({ action }) {
  if (isImageMode(action.icon) && action.imageUrl) {
    const isFill = action.imageSize === "fill";
    if (isFill) {
      return (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${action.imageUrl})`,
              filter: `blur(${action.blurAmount ?? 0}px) brightness(${(action.brightness ?? 100) / 100})`,
              transform: (action.blurAmount ?? 0) > 0 ? "scale(1.08)" : undefined,
            }}
          />
          {(action.overlayOpacity ?? 0) > 0 && (
            <div className="absolute inset-0" style={{ backgroundColor: action.overlayColor || "#000000", opacity: (action.overlayOpacity ?? 0) / 100 }} />
          )}
        </>
      );
    }
    // square: render as img element, centered
    return (
      <img
        src={action.imageUrl}
        alt=""
        className="w-full h-full object-cover"
        style={{ filter: `blur(${action.blurAmount ?? 0}px) brightness(${(action.brightness ?? 100) / 100})` }}
      />
    );
  }
  if (isEmojiMode(action.icon)) {
    const emoji = action.emoji || action.icon || "❓";
    return <span className="text-xl leading-none select-none">{emoji}</span>;
  }
  const Icon = ICON_MAP[action.icon] || Zap;
  return <Icon className="w-5 h-5 text-white" />;
}

export default function QuickActionsGrid({ actions = [], userRole }) {
  // actions may be a flat array (old) or an audience-config object (new)
  let resolvedActions = actions;
  if (!Array.isArray(actions) && actions && typeof actions === "object") {
    const isAdmin = userRole === "admin" || userRole === "tenant_admin" || userRole === "platform_admin" || userRole === "staff";
    const isLoggedIn = !!userRole;
    if (actions.unified) {
      resolvedActions = actions.guest?.actions || [];
    } else if (isAdmin && (actions.admin?.actions || []).length > 0) {
      resolvedActions = actions.admin.actions;
    } else if (isLoggedIn && (actions.user?.actions || []).length > 0) {
      resolvedActions = actions.user.actions;
    } else {
      // Guests (not logged in) or fallback
      resolvedActions = actions.guest?.actions || [];
    }
  }
  const visible = resolvedActions.filter(a => isVisible(a, userRole));
  if (visible.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">快捷操作</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {visible.map((action, idx) => {
          const isExternal = action.path?.startsWith("http");
          const content = (
            <div className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden relative group-hover:scale-105 transition-transform ${isImageMode(action.icon) && action.imageSize === "fill" ? "bg-gray-200" : (action.color || "bg-gray-400")}`}>
                <ActionIcon action={action} />
              </div>
              <span className="text-xs text-gray-700 font-medium text-center leading-tight">{action.title}</span>
            </div>
          );

          if (isExternal) {
            return <a key={action.id || idx} href={action.path} target="_blank" rel="noopener noreferrer">{content}</a>;
          }
          return <Link key={action.id || idx} to={createPageUrl(action.path)}>{content}</Link>;
        })}
      </div>
    </div>
  );
}