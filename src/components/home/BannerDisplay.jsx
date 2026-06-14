import { useState, useEffect } from "react";

const WIDTH_CLASS = {
  small:  "max-w-3xl mx-auto",
  medium: "max-w-5xl mx-auto",
  large:  "w-full",
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

  const widthClass = WIDTH_CLASS[config?.width || "medium"];

  return (
    <div className="w-full overflow-hidden">
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