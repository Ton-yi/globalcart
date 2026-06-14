/**
 * ImageEffectsPanel — 图片效果编辑面板（纯效果，不含上传逻辑）
 * 上传 / 裁切由消费方（如 HeroSectionManager）自行协调
 *
 * Props:
 *   imageUrl       string         当前图片 URL
 *   blurAmount     number         模糊 px
 *   brightness     number         明度 %
 *   overlayColor   string         遮罩颜色 hex
 *   overlayOpacity number         遮罩透明度 %
 *   previewTitle   string?        预览区叠加文字（可选）
 *   onChange(patch) fn            局部字段更新回调 { blurAmount? brightness? overlayColor? overlayOpacity? }
 *   onRemove()      fn            移除图片回调
 *   onFileSelected(file) fn?      用户选择/拖拽新文件时的回调（由外部处理上传+裁切）
 */
import { useState, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";

// ─── ImageCropModal ────────────────────────────────────────
export function ImageCropModal({ src, onConfirm, onCancel, aspect, hint, filename = "image.jpg" }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const imgRef = useRef();

  const onImageLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const ratio = aspect ?? w / h;
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 90 }, ratio, w, h), w, h);
    setCrop(c);
  };

  const handleConfirm = useCallback(async () => {
    const image = imgRef.current;
    if (!image || !completedCrop) { onConfirm(src); return; }
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
    canvas.toBlob(async (blob) => {
      if (!blob) { onConfirm(src); return; }
      const file = new File([blob], filename, { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onConfirm(file_url);
    }, "image/jpeg", 0.9);
  }, [completedCrop, src, filename]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl p-5 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">裁切图片</h3>
          <button onClick={onCancel}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        {hint && <p className="text-xs text-gray-400 mb-3">{hint}</p>}
        <div className="max-h-[60vh] overflow-auto flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
          >
            <img ref={imgRef} src={src} onLoad={onImageLoad} className="max-w-full" alt="crop" />
          </ReactCrop>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" onClick={handleConfirm}>确认裁切并上传</Button>
        </div>
      </div>
    </div>
  );
}

// ─── SliderField ───────────────────────────────────────────
export function SliderField({ label, value, min, max, unit, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-gray-500">{label}</Label>
        <span className="text-xs text-gray-400">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded accent-blue-600"
      />
    </div>
  );
}

// ─── ImageEffectsPanel ─────────────────────────────────────
// 纯效果面板：上传区 / 预览区 + 效果滑块
// 文件选择后通过 onFileSelected(file) 委托给消费方处理上传+裁切
export default function ImageEffectsPanel({
  imageUrl,
  blurAmount = 0,
  brightness = 100,
  overlayColor = "#000000",
  overlayOpacity = 0,
  previewTitle,
  onChange,
  onRemove,
  onFileSelected,  // (file: File) => void — 由消费方实现上传+裁切
}) {
  const fileInputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    onFileSelected?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <>
      <div className="space-y-3">
        {/* 预览区（有图时显示） */}
        {imageUrl ? (
          <div
            className="relative rounded-lg overflow-hidden h-28 border border-gray-300 shadow-sm"
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${imageUrl})`,
                filter: `blur(${blurAmount}px) brightness(${brightness / 100})`,
                transform: blurAmount > 0 ? "scale(1.05)" : undefined,
              }}
            />
            {overlayOpacity > 0 && (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }}
              />
            )}
            {previewTitle && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white text-sm font-bold drop-shadow">{previewTitle}</span>
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              <Button size="sm" className="h-6 text-xs px-2 bg-white/80 text-gray-700 hover:bg-white"
                onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3 mr-1" />更换
              </Button>
              <Button size="sm" variant="destructive" className="h-6 text-xs px-2 bg-red-500/80 hover:bg-red-600"
                onClick={onRemove}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          /* 上传区（无图时显示） */
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`w-full h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              dragging
                ? "border-blue-400 bg-blue-50 text-blue-500"
                : "border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-xs">点击或拖拽图片至此上传（将进入裁切步骤）</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) handleFile(f); }}
        />

        {/* 效果控制（始终显示） */}
        <SliderField label="模糊度（雾化）" value={blurAmount} min={0} max={20} unit="px" onChange={v => onChange({ blurAmount: v })} />
        <SliderField label="明度" value={brightness} min={30} max={150} unit="%" onChange={v => onChange({ brightness: v })} />
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">遮罩颜色</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={overlayColor}
              onChange={e => onChange({ overlayColor: e.target.value })}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5"
            />
            <Input
              className="h-7 text-xs font-mono flex-1"
              value={overlayColor}
              onChange={e => onChange({ overlayColor: e.target.value })}
            />
          </div>
        </div>
        <SliderField label="遮罩透明度" value={overlayOpacity} min={0} max={80} unit="%" onChange={v => onChange({ overlayOpacity: v })} />
      </div>
    </>
  );
}