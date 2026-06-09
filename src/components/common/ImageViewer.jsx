/**
 * ImageViewer
 * - Click: opens inline enlarged view
 * - Click again: closes the enlarged view
 */
import { useState } from "react";
import { X } from "lucide-react";

export function ImageWithViewer({ src, alt = "", thumbClassName = "", children }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return children || null;

  return (
    <>
      <span
        className="relative inline-block cursor-pointer"
        onClick={e => { e.stopPropagation(); setIsOpen(true); }}
      >
        {children || (
          <img src={src} alt={alt} className={thumbClassName} />
        )}
      </span>

      {/* Inline enlarged view overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={e => { e.stopPropagation(); setIsOpen(false); }}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}