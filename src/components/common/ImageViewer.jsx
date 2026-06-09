/**
 * ImageViewer
 * - Hover: shows a floating preview thumbnail
 * - Click: opens a full-screen lightbox
 * - Click again in lightbox: opens image in new tab
 */
import { useState, useRef } from "react";
import { X, ExternalLink } from "lucide-react";

export function ImageWithViewer({ src, alt = "", thumbClassName = "", children }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hoverPos, setHoverPos] = useState(null);
  const hoverTimer = useRef(null);

  if (!src) return children || null;

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimer.current = setTimeout(() => {
      setHoverPos({ top: rect.top, left: rect.right + 8, bottom: rect.bottom });
    }, 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    setHoverPos(null);
  };

  return (
    <>
      <span
        className="relative inline-block cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={e => { e.stopPropagation(); setHoverPos(null); setLightboxOpen(true); }}
      >
        {children || (
          <img src={src} alt={alt} className={thumbClassName} />
        )}
      </span>

      {/* Hover preview */}
      {hoverPos && (
        <div
          className="fixed z-[9998] pointer-events-none"
          style={{
            top: Math.min(hoverPos.top, window.innerHeight - 220),
            left: Math.min(hoverPos.left, window.innerWidth - 210),
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-1.5 w-48">
            <img src={src} alt={alt} className="w-full rounded-lg object-contain max-h-44" />
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center gap-3">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[75vh] rounded-xl object-contain shadow-2xl cursor-zoom-in"
              onClick={e => { e.stopPropagation(); window.open(src, "_blank"); }}
              title="点击在新标签页打开"
            />
            <button
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs"
              onClick={e => { e.stopPropagation(); window.open(src, "_blank"); }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              在新标签页打开
            </button>
          </div>
        </div>
      )}
    </>
  );
}