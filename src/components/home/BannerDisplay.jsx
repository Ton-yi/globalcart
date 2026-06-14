import { useMemo } from "react";

const WIDTH_CLASS = {
  small:  "max-w-3xl mx-auto",
  medium: "max-w-5xl mx-auto",
  large:  "w-full",
};

/**
 * BannerDisplay — 在导航栏上方渲染一张随机选取的 Banner 图片。
 * 每次挂载时从启用图片中随机选一张（即每次刷新随机）。
 * props:
 *   config: { width: "small"|"medium"|"large", images: [{id, url, isActive}] }
 */
export default function BannerDisplay({ config }) {
  const activeImages = useMemo(
    () => (config?.images || []).filter(i => i.isActive && i.url),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally empty — pick once on mount (page load / refresh)
  );

  const picked = useMemo(() => {
    if (activeImages.length === 0) return null;
    const idx = Math.floor(Math.random() * activeImages.length);
    return activeImages[idx];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // same — pick once

  if (!picked) return null;

  const widthClass = WIDTH_CLASS[config?.width || "medium"];

  return (
    <div className="w-full bg-gray-100 overflow-hidden">
      <div className={widthClass}>
        <img
          src={picked.url}
          alt="banner"
          className="w-full h-auto object-cover block"
          draggable={false}
        />
      </div>
    </div>
  );
}