/**
 * AvatarCropModal
 * Circular avatar crop modal using react-image-crop.
 * Zoom is applied via rendered image width (NOT CSS transform) so
 * ReactCrop's drag coordinates stay accurate.
 */
import { useState, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const OUTPUT_SIZE = 400; // final avatar px

function centerAspectCrop(w, h) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, w, h),
    w,
    h
  );
}

export default function AvatarCropModal({ imageSrc, onConfirm, onCancel, uploading }) {
  const imgRef = useRef(null);
  const naturalSize = useRef({ w: 0, h: 0 });
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  // zoom = rendered image width in px (base 320px, range 200-800)
  const [zoom, setZoom] = useState(320);

  const onImageLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    naturalSize.current = { w, h };
    setCrop(centerAspectCrop(w, h));
  }, []);

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");

    // Circular clip
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // completedCrop is in px relative to the *rendered* image size
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.92);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">裁剪头像</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop area — scrollable so zoomed image is reachable */}
        <div className="overflow-auto bg-gray-100 flex items-center justify-center" style={{ minHeight: 300, maxHeight: "55vh" }}>
          <div className="p-4">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              keepSelection
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="裁剪预览"
                width={zoom}
                style={{ display: "block", maxWidth: "none" }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-5 py-3 border-t bg-gray-50">
          <span className="text-xs text-gray-400 flex-shrink-0">缩小</span>
          <input
            type="range"
            min={150}
            max={800}
            step={10}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-red-600"
          />
          <span className="text-xs text-gray-400 flex-shrink-0">放大</span>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={uploading}>取消</Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleConfirm}
            disabled={!completedCrop || uploading}
          >
            <Check className="w-3.5 h-3.5 mr-1.5" />
            {uploading ? "上传中..." : "使用此裁剪"}
          </Button>
        </div>
      </div>
    </div>
  );
}