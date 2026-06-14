/**
 * ImageEffectsPanel — 图片效果编辑面板
 * ImageEditModal 内置 效果编辑 + 裁切（两阶段，同一弹窗）
 */
import { useState, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon, Crop, ArrowLeft } from "lucide-react";

// ─── 常量 ──────────────────────────────────────────────────
const ASPECT_PRESETS = [
  { label: "自由", value: undefined },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3",  value: 4 / 3 },
  { label: "3:2",  value: 3 / 2 },
  { label: "1:1",  value: 1 },
  { label: "3:4",  value: 3 / 4 },
  { label: "2:3",  value: 2 / 3 },
  { label: "9:16", value: 9 / 16 },
];

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

// ─── ImageCropModal（保留导出以兼容外部使用者） ─────────────────
export function ImageCropModal({ src, onConfirm, onCancel, aspect, zIndex = "z-50" }) {
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/70`}>
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full mx-4" style={{ maxWidth: 680, maxHeight: "94vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-800">裁切图片</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
          <CropView src={src} initialAspect={aspect} onDone={onConfirm} onCancel={onCancel} />
        </div>
      </div>
    </div>
  );
}

// ─── CropView（裁切视图，内嵌在编辑器内） ────────────────────
function CropView({ src, initialAspect, onDone, onCancel }) {
  const initPresetIdx = (() => {
    if (initialAspect == null) return 0;
    const idx = ASPECT_PRESETS.findIndex(p => p.value != null && Math.abs(p.value - initialAspect) < 0.01);
    return idx >= 0 ? idx : 0;
  })();

  const [presetIdx, setPresetIdx] = useState(initPresetIdx);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef();
  const containerRef = useRef();

  const currentAspect = ASPECT_PRESETS[presetIdx].value;

  const resetCrop = useCallback((newAspect) => {
    const image = imgRef.current;
    if (!image) return;
    const { naturalWidth: w, naturalHeight: h } = image;
    const ratio = newAspect ?? w / h;
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 85 }, ratio, w, h), w, h);
    setCrop(c);
    setCompletedCrop(undefined);
  }, []);

  const onImageLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const ratio = currentAspect ?? w / h;
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 85 }, ratio, w, h), w, h);
    setCrop(c);
  };

  const handlePresetClick = (idx) => {
    setPresetIdx(idx);
    resetCrop(ASPECT_PRESETS[idx].value);
  };

  // 滚轮缩放（passive:false 以允许 preventDefault）
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(3, Math.max(0.5, parseFloat((prev + delta).toFixed(2)))));
  }, []);

  const containerCallbackRef = useCallback((node) => {
    if (node) {
      node.addEventListener("wheel", handleWheel, { passive: false });
      containerRef.current = node;
    } else if (containerRef.current) {
      containerRef.current.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  const handleConfirm = async () => {
    const image = imgRef.current;
    // 没有选区 → 直接跳过裁切，用原图
    if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      onDone(src);
      return;
    }
    setUploading(true);
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(completedCrop.width  * scaleX);
    canvas.height = Math.round(completedCrop.height * scaleY);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      image,
      completedCrop.x * scaleX, completedCrop.y * scaleY,
      completedCrop.width * scaleX, completedCrop.height * scaleY,
      0, 0, canvas.width, canvas.height,
    );
    canvas.toBlob(async (blob) => {
      if (!blob) { setUploading(false); onDone(src); return; }
      const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      onDone(file_url);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* 比例预设栏 */}
      <div className="flex items-center gap-1.5 px-1 pb-2 flex-wrap flex-shrink-0">
        {ASPECT_PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => handlePresetClick(i)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              presetIdx === i ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 hidden sm:inline">滚轮缩放</span>
      </div>

      {/* 裁切画布 */}
      <div
        ref={containerCallbackRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 rounded-lg select-none"
        style={{ minHeight: 0, maxHeight: "38vh" }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center center", transition: "transform 0.1s ease" }}>
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={currentAspect}
            minWidth={20}
            minHeight={20}
          >
            <img
              ref={imgRef}
              src={src}
              onLoad={onImageLoad}
              style={{ maxWidth: "100%", maxHeight: "36vh", display: "block" }}
              alt="crop"
              draggable={false}
            />
          </ReactCrop>
        </div>
      </div>

      {/* 缩放控制 + 操作按钮 */}
      <div className="flex items-center justify-between pt-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))))}
            className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 font-bold text-sm"
          >−</button>
          <span className="text-xs text-gray-500 w-9 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(3, parseFloat((s + 0.1).toFixed(2))))}
            className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 font-bold text-sm"
          >+</button>
          <button onClick={() => setScale(1)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">重置</button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel} disabled={uploading}>
            <ArrowLeft className="w-3 h-3 mr-1" />返回
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleConfirm} disabled={uploading}>
            {uploading ? "处理中…" : "应用裁切"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ImageEditModal ────────────────────────────────────────
// 两阶段同弹窗：mode="edit"（效果编辑）| mode="crop"（裁切）
function ImageEditModal({ imageUrl, initialMode = "edit", blurAmount, brightness, overlayColor, overlayOpacity, previewTitle, onChange, onClose, aspect, cropHint }) {
  const fileInputRef = useRef();
  const [mode, setMode] = useState(initialMode); // "edit" | "crop"
  const [local, setLocal] = useState({ blurAmount, brightness, overlayColor, overlayOpacity });
  const [pendingImageUrl, setPendingImageUrl] = useState(imageUrl);
  // cropSrc: 待裁切的原始图
  const [cropSrc, setCropSrc] = useState(initialMode === "crop" ? imageUrl : null);
  const [draggingOver, setDraggingOver] = useState(false);

  const patch = (p) => setLocal(prev => ({ ...prev, ...p }));

  const handleApply = () => {
    onChange({ ...local, bgImageUrl: pendingImageUrl });
    onClose();
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCropSrc(URL.createObjectURL(file));
    setMode("crop");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggingOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // 在编辑模式下点"裁切当前图片"
  const handleCropCurrent = () => {
    if (pendingImageUrl) {
      setCropSrc(pendingImageUrl);
      setMode("crop");
    }
  };

  // 裁切完成 → 回到效果编辑
  const handleCropDone = (url) => {
    setPendingImageUrl(url);
    setCropSrc(null);
    setMode("edit");
  };

  // 取消裁切 → 回到效果编辑（不改变图片）
  const handleCropCancel = () => {
    setCropSrc(null);
    setMode("edit");
  };

  const title = mode === "crop" ? "裁切图片" : "编辑图片";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full mx-4"
        style={{ maxWidth: mode === "crop" ? 680 : 480, maxHeight: "94vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
          {mode === "crop" ? (
            /* ── 裁切视图 ── */
            <CropView
              src={cropSrc}
              initialAspect={aspect}
              onDone={handleCropDone}
              onCancel={handleCropCancel}
            />
          ) : (
            /* ── 效果编辑视图 ── */
            <>
              {/* 预览区 / 上传区 */}
              {pendingImageUrl ? (
                <div
                  className={`relative rounded-lg overflow-hidden h-32 mb-3 border-2 transition-colors ${draggingOver ? "border-blue-400 border-dashed" : "border-gray-200"} group`}
                  onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
                  onDragLeave={() => setDraggingOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="absolute inset-0 bg-cover bg-center" style={{
                    backgroundImage: `url(${pendingImageUrl})`,
                    filter: `blur(${local.blurAmount}px) brightness(${local.brightness / 100})`,
                    transform: local.blurAmount > 0 ? "scale(1.05)" : undefined,
                  }} />
                  {local.overlayOpacity > 0 && (
                    <div className="absolute inset-0" style={{ backgroundColor: local.overlayColor, opacity: local.overlayOpacity / 100 }} />
                  )}
                  {previewTitle && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-white text-sm font-bold drop-shadow">{previewTitle}</span>
                    </div>
                  )}
                  {draggingOver ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/60">
                      <div className="flex flex-col items-center gap-1 text-white">
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-medium">松开以上传图片</span>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 group-hover:bg-black/30 transition-colors">
                      <Button size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-800 hover:bg-white"
                        onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-3 h-3 mr-1" />更换
                      </Button>
                      <Button size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-800 hover:bg-white"
                        onClick={handleCropCurrent}>
                        <Crop className="w-3 h-3 mr-1" />裁切
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className={`w-full h-24 mb-3 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
                    draggingOver ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                  }`}
                  onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
                  onDragLeave={() => setDraggingOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs">{draggingOver ? "松开以上传图片" : "点击或拖拽图片至此上传"}</span>
                </button>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) handleFile(f); }} />

              {/* 效果控制 */}
              <div className="space-y-3 mb-4">
                <SliderField label="模糊度（雾化）" value={local.blurAmount} min={0} max={20} unit="px" onChange={v => patch({ blurAmount: v })} />
                <SliderField label="明度" value={local.brightness} min={30} max={150} unit="%" onChange={v => patch({ brightness: v })} />
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">遮罩颜色</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={local.overlayColor}
                      onChange={e => patch({ overlayColor: e.target.value })}
                      className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5" />
                    <Input className="h-7 text-xs font-mono flex-1" value={local.overlayColor}
                      onChange={e => patch({ overlayColor: e.target.value })} />
                  </div>
                </div>
                <SliderField label="遮罩透明度" value={local.overlayOpacity} min={0} max={80} unit="%" onChange={v => patch({ overlayOpacity: v })} />
              </div>

              {/* 底部按钮 */}
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>取消</Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleApply}>应用</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ImageEffectsPanel ─────────────────────────────────────
export default function ImageEffectsPanel({
  imageUrl,
  blurAmount = 0,
  brightness = 100,
  overlayColor = "#000000",
  overlayOpacity = 0,
  previewTitle,
  aspect,
  cropHint,
  onChange,
  onRemove,
  onFileSelected, // 保留 prop 兼容性，但不再需要外部处理
}) {
  const fileInputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // 新图片直接进入编辑器（裁切模式）
  const [pendingNewFile, setPendingNewFile] = useState(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    // 直接打开编辑器，传入临时 URL 作为新图
    setPendingNewFile(URL.createObjectURL(file));
    setEditOpen(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <>
      {editOpen && (
        <ImageEditModal
          // 新上传文件：用临时 URL 作为初始图，进入裁切模式
          imageUrl={pendingNewFile || imageUrl}
          initialMode={pendingNewFile ? "crop" : "edit"}
          blurAmount={blurAmount}
          brightness={brightness}
          overlayColor={overlayColor}
          overlayOpacity={overlayOpacity}
          previewTitle={previewTitle}
          aspect={aspect}
          cropHint={cropHint}
          onChange={(patch) => { onChange(patch); setPendingNewFile(null); }}
          onClose={() => { setEditOpen(false); setPendingNewFile(null); }}
        />
      )}

      <div className="space-y-3">
        {imageUrl ? (
          <div
            className={`relative rounded-lg overflow-hidden h-28 border-2 shadow-sm transition-colors ${dragging ? "border-blue-400 border-dashed" : "border-gray-300"}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="absolute inset-0 bg-cover bg-center" style={{
              backgroundImage: `url(${imageUrl})`,
              filter: `blur(${blurAmount}px) brightness(${brightness / 100})`,
              transform: blurAmount > 0 ? "scale(1.05)" : undefined,
            }} />
            {overlayOpacity > 0 && (
              <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity / 100 }} />
            )}
            {previewTitle && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white text-sm font-bold drop-shadow">{previewTitle}</span>
              </div>
            )}
            {dragging ? (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-500/60">
                <div className="flex flex-col items-center gap-1 text-white">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-medium">松开以上传图片</span>
                </div>
              </div>
            ) : (
              <div className="absolute top-2 right-2 flex gap-1">
                <Button size="sm" className="h-6 text-xs px-2 bg-white/80 text-gray-700 hover:bg-white"
                  onClick={() => setEditOpen(true)}>
                  <Upload className="w-3 h-3 mr-1" />编辑
                </Button>
                <Button size="sm" variant="destructive" className="h-6 text-xs px-2 bg-red-500/80 hover:bg-red-600"
                  onClick={onRemove}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`w-full h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
              dragging ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-xs">点击或拖拽图片至此上传（将进入裁切步骤）</span>
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) handleFile(f); }} />

        {imageUrl && (
          <p className="text-xs text-gray-400 text-center">点击"编辑"按钮调整效果或更换图片</p>
        )}
      </div>
    </>
  );
}