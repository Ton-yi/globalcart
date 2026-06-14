import { useState, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Upload, Loader2 } from "lucide-react";

function SliderField({ label, value, min, max, unit, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-gray-500">{label}</Label>
        <span className="text-xs text-gray-400">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded accent-orange-500"
      />
    </div>
  );
}

/**
 * QuickActionImageCropModal
 * Props:
 *   src          – object URL of a NEW local file, OR null when re-editing an existing uploaded image
 *   existingUrl  – already-uploaded image URL (used when src is null, for re-editing effects only)
 *   imageConfig  – existing { imageSize, blurAmount, brightness, overlayColor, overlayOpacity } (for re-edit)
 *   onConfirm    – ({ imageUrl, imageSize, blurAmount, brightness, overlayColor, overlayOpacity }) => void
 *   onCancel     – () => void
 */
export default function QuickActionImageCropModal({ src, existingUrl, imageConfig = {}, onConfirm, onCancel }) {
  // displaySrc: what we show in the crop / preview area
  const displaySrc = src || existingUrl;
  // effectsOnly: true when re-editing an already-uploaded image (no new file chosen)
  const effectsOnly = !src && !!existingUrl;
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef();

  // Image effect settings
  const [imageSize, setImageSize] = useState(imageConfig.imageSize || "square");
  const [blurAmount, setBlurAmount] = useState(imageConfig.blurAmount ?? 0);
  const [brightness, setBrightness] = useState(imageConfig.brightness ?? 100);
  const [overlayColor, setOverlayColor] = useState(imageConfig.overlayColor || "#000000");
  const [overlayOpacity, setOverlayOpacity] = useState(imageConfig.overlayOpacity ?? 0);

  const onImageLoad = (e) => {
    if (effectsOnly) return; // no cropping when re-editing effects on existing image
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const aspect = imageSize === "square" ? 1 : undefined;
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 85 }, aspect ?? w / h, w, h),
      w, h
    );
    setCrop(c);
  };

  // Update crop aspect when size mode changes
  const handleSizeChange = (size) => {
    setImageSize(size);
    if (effectsOnly) return;
    const img = imgRef.current;
    if (!img) return;
    const { naturalWidth: w, naturalHeight: h } = img;
    const aspect = size === "square" ? 1 : undefined;
    const c = centerCrop(
      makeAspectCrop({ unit: "%", width: 85 }, aspect ?? w / h, w, h),
      w, h
    );
    setCrop(c);
  };

  const handleConfirm = useCallback(async () => {
    const image = imgRef.current;
    setUploading(true);
    try {
      // Effects-only re-edit: keep the existing uploaded URL, no crop/upload needed
      if (effectsOnly) {
        onConfirm({ imageUrl: existingUrl, imageSize, blurAmount, brightness, overlayColor, overlayOpacity });
        return;
      }

      // New file: must crop and upload
      if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
        // No crop interaction — upload the full image as-is
        const res = await fetch(src);
        const blob = await res.blob();
        const file = new File([blob], "quick-action-img.jpg", { type: "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        onConfirm({ imageUrl: file_url, imageSize, blurAmount, brightness, overlayColor, overlayOpacity });
        return;
      }

      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        completedCrop.x * scaleX, completedCrop.y * scaleY,
        completedCrop.width * scaleX, completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height,
      );
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) { resolve(); return; }
          const file = new File([blob], "quick-action-img.jpg", { type: "image/jpeg" });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          onConfirm({ imageUrl: file_url, imageSize, blurAmount, brightness, overlayColor, overlayOpacity });
          resolve();
        }, "image/jpeg", 0.9);
      });
    } finally {
      setUploading(false);
    }
  }, [completedCrop, src, existingUrl, effectsOnly, imageSize, blurAmount, brightness, overlayColor, overlayOpacity, onConfirm]);

  // Live preview styles
  const previewStyle = {
    filter: `blur(${blurAmount}px) brightness(${brightness / 100})`,
    transform: blurAmount > 0 ? "scale(1.08)" : undefined,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            {effectsOnly ? "调整图片效果" : "设置快捷入口背景图片"}
          </h3>
          <button onClick={onCancel}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Size mode */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">图片尺寸模式</Label>
            <div className="flex gap-2">
              <button
                onClick={() => handleSizeChange("square")}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${imageSize === "square" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                正方形（居中显示）
              </button>
              <button
                onClick={() => handleSizeChange("fill")}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${imageSize === "fill" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                自动填充整个按钮
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {imageSize === "square"
                ? "裁切为 1:1 正方形，置于按钮中央，四周保留背景颜色"
                : "裁切区域将拉伸填满整个按钮区域（自由尺寸）"}
            </p>
          </div>

          {/* Crop area — hidden in effects-only mode */}
          {!effectsOnly && (
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">
              裁切图片{imageSize === "square" ? "（锁定 1:1）" : "（自由裁切）"}
            </Label>
            <div className="flex justify-center bg-gray-100 rounded-lg p-2 overflow-hidden">
              <ReactCrop
                crop={crop}
                onChange={(_, pct) => setCrop(pct)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={imageSize === "square" ? 1 : undefined}
                keepSelection
              >
                <img ref={imgRef} src={displaySrc} onLoad={onImageLoad} className="max-w-full max-h-72 object-contain" alt="crop" />
              </ReactCrop>
            </div>
          </div>
          )}

          {/* Effects */}
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-1">图片效果预设</p>

            {/* Mini preview */}
            <div className="flex justify-center mb-2">
              <div className={`relative overflow-hidden rounded-xl shadow ${imageSize === "square" ? "w-14 h-14" : "w-24 h-14"}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${displaySrc})`, ...previewStyle }} />
                {overlayOpacity > 0 && (
                  <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />
                )}
              </div>
            </div>

            <SliderField label="模糊度（雾化）" value={blurAmount} min={0} max={20} unit="px" onChange={setBlurAmount} />
            <SliderField label="明度" value={brightness} min={30} max={150} unit="%" onChange={setBrightness} />
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">遮罩颜色</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={overlayColor} onChange={e => setOverlayColor(e.target.value)}
                  className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5" />
                <Input className="h-7 text-xs font-mono flex-1" value={overlayColor} onChange={e => setOverlayColor(e.target.value)} />
              </div>
            </div>
            <SliderField label="遮罩透明度" value={overlayOpacity} min={0} max={80} unit="%" onChange={setOverlayOpacity} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 pb-5">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={uploading}>取消</Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={handleConfirm} disabled={uploading}>
            {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />上传中…</> : <><Upload className="w-3.5 h-3.5 mr-1" />确认并上传</>}
          </Button>
        </div>
      </div>
    </div>
  );
}