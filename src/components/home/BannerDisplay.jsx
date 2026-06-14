import { useState, useEffect } from "react";

// 容器高度（图片始终 cover 填满，高度决定能看到多少图片内容）
const HEIGHT_PX = {
  small:  80,
  medium: 160,
  large:  260,
};

/**
 * BannerDisplay — 在导航栏上方渲染一张随机选取的 Banner 图片。
 * 第一次收到有效的启用图片列表时锁定随机选取，之后不再因 config 变化而换图，
 * 确保页面内路由跳转不会触发重新随机，只有完整刷新才会重新选取。
 */
export default function BannerDisplay({ config }) {
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    // 已锁定则不重新选
    if (picked) return;
    const active = (config?.images || []).filter(i => i.isActive && i.url);
    if (active.length === 0) return;
    const idx = Math.floor(Math.random() * active.length);
    setPicked(active[idx]);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!picked) return null;

  const heightPx = HEIGHT_PX[config?.width || "medium"];
  const blur = picked.blurAmount ?? 0;
  const brightness = picked.brightness ?? 100;
  const overlayColor = picked.overlayColor || "#000000";
  const overlayOpacity = picked.overlayOpacity ?? 0;

  return (
    <div className="w-full overflow-hidden" style={{ height: heightPx }}>
      <div className="relative w-full h-full">
        <img
          src={picked.url}
          alt="banner"
          className="w-full h-full object-cover block"
          draggable={false}
          style={{
            filter: `blur(${blur}px) brightness(${brightness / 100})`,
            transform: blur > 0 ? "scale(1.02)" : undefined,
          }}
        />
        {overlayOpacity > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }}
          />
        )}
      </div>
    </div>
  );
}