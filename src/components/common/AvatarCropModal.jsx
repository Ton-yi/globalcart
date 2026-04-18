/**
 * AvatarCropModal
 * Lets the user select a circular crop region from an uploaded image,
 * then returns the cropped blob for upload.
 */
import { useState, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function centerAspectCrop(mediaWidth, mediaHeight) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 70 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export default function AvatarCropModal({ imageSrc, onConfirm, onCancel, uploading }) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [scale, setScale] = useState(1);

  const onImageLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCrop(centerAspectCrop(w, h));
  }, []);

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const SIZE = 400; // output px
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    // Draw circular clip
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

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
      SIZE,
      SIZE
    );

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.92);
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

        {/* Crop area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100 min-h-[300px]">
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
              style={{ transform: `scale(${scale})`, transformOrigin: "top left", maxWidth: "100%", maxHeight: "60vh" }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t bg-gray-50">
          <button
            onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))))}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(3, parseFloat((s + 0.1).toFixed(1))))}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
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