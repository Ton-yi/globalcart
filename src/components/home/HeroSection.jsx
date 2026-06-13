import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingBag, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

// 默认配置
export const DEFAULT_HERO = {
  title: "",
  subtitle: "",
  badgeText: "日本 → 全球",
  bgMode: "white",       // "white" | "color" | "image"
  bgColor: "#ffffff",
  bgOpacity: 100,        // 0-100
  bgImageUrl: "",
  blurAmount: 0,         // 0-20 px
  brightness: 100,       // 50-150 %
  overlayOpacity: 0,     // 0-80 %
  overlayColor: "#000000",
  buttons: [
    { id: "submit", label: "提交购买需求", page: "SubmitOrder", variant: "primary", color: "#dc2626", icon: "ShoppingBag", loggedInOnly: true },
    { id: "orders", label: "查看我的订单", page: "MyOrders", variant: "outline", color: "", icon: "", loggedInOnly: true },
    { id: "login", label: "登录开始代购", page: "", variant: "primary", color: "#dc2626", icon: "", loggedInOnly: false, guestOnly: true },
  ],
};

export default function HeroSection({ config, user, tenant }) {
  const c = { ...DEFAULT_HERO, ...(config || {}) };

  const buttons = (c.buttons || []).filter(b => {
    if (b.loggedInOnly && !user) return false;
    if (b.guestOnly && user) return false;
    return true;
  });

  // Background style
  let bgStyle = {};
  if (c.bgMode === "color") {
    const hex = c.bgColor || "#ffffff";
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    bgStyle.backgroundColor = `rgba(${r},${g},${b},${(c.bgOpacity ?? 100) / 100})`;
  }
  // Image bg is applied only on the inner filter layer, not the outer container

  const hasImageBg = c.bgMode === "image" && c.bgImageUrl;
  const blurFilter = hasImageBg && c.blurAmount > 0 ? `blur(${c.blurAmount}px)` : undefined;
  const brightnessFilter = hasImageBg && c.brightness !== 100 ? `brightness(${c.brightness}%)` : undefined;
  const combinedFilter = [blurFilter, brightnessFilter].filter(Boolean).join(" ") || undefined;

  const overlayStyle = hasImageBg && c.overlayOpacity > 0 ? {
    position: "absolute", inset: 0, borderRadius: "inherit",
    backgroundColor: c.overlayColor || "#000000",
    opacity: (c.overlayOpacity || 0) / 100,
    pointerEvents: "none",
  } : null;

  return (
    <div
      className="relative border border-gray-200 rounded-xl p-8 text-center overflow-hidden"
      style={bgStyle}
    >
      {/* BG image filters layer */}
      {hasImageBg && (
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            backgroundImage: bgStyle.backgroundImage,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: combinedFilter,
            zIndex: 0,
          }}
        />
      )}
      {/* Overlay */}
      {overlayStyle && <div style={overlayStyle} />}

      {/* Content */}
      <div className="relative z-10">
        {c.badgeText && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-red-600" />
            <span className="text-sm text-gray-500">{c.badgeText}</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {c.title || tenant?.login_title || "同一物流 · Tongyi Express"}
        </h1>
        <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
          {c.subtitle || tenant?.login_subtitle || "专业代购日本商品，安心付款，全程追踪，极速发货至全球各地"}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          {buttons.map((btn, i) => {
            const isOutline = btn.variant === "outline";
            const btnStyle = !isOutline && btn.color
              ? { backgroundColor: btn.color, borderColor: btn.color, color: "#fff" }
              : {};

            if (btn.page) {
              return (
                <Link key={btn.id || i} to={createPageUrl(btn.page)}>
                  <Button
                    variant={isOutline ? "outline" : "default"}
                    style={btnStyle}
                    className={!isOutline && !btn.color ? "bg-red-600 hover:bg-red-700" : ""}
                  >
                    {btn.icon === "ShoppingBag" && <ShoppingBag className="w-4 h-4 mr-2" />}
                    {btn.label}
                  </Button>
                </Link>
              );
            }
            return (
              <Button
                key={btn.id || i}
                variant={isOutline ? "outline" : "default"}
                style={btnStyle}
                className={!isOutline && !btn.color ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={!btn.page && !user ? () => base44.auth.redirectToLogin() : undefined}
              >
                {btn.icon === "ShoppingBag" && <ShoppingBag className="w-4 h-4 mr-2" />}
                {btn.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}