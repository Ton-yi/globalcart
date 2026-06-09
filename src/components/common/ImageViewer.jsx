/**
 * ImageViewer
 * - Hover: shows a floating preview thumbnail
 * - Click: opens an in-page overlay with large image
 * - Click again: closes the overlay
 */
import { useState, useRef } from "react";
import { X } from "lucide-react";

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

      {/* In-page overlay */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 rounded-full p-2"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}