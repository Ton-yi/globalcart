/**
 * ImageEffectsPanel — 图片效果编辑面板
 * ImageEditModal：左右双栏，左侧实时预览，右侧裁切+效果一体化控制
 */
import { useState, useRef, useCallback, useMemo } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon, Crop, Sliders } from "lucide-react";

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
        <span className="text-xs text-gray-400 tabular-nums">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded accent-blue-600"
      />
    </div>
  );
}

// ─── ImageEditModal ────────────────────────────────────────
// 左右双栏一体化编辑器：左侧预览，右侧 Tab（裁切 / 效果）
export function ImageEditModal({
  imageUrl,
  initialMode = "edit",
  blurAmount = 0,
  brightness = 100,
  overlayColor = "#000000",
  overlayOpacity = 0,
  previewTitle,
  onChange,
  onClose,
  aspect,
}) {
  const fileInputRef = useRef();
  const imgRef = useRef();
  const containerRef = useRef();

  const [tab, setTab] = useState(initialMode === "crop" ? "crop" : "effect"); // "crop" | "effect"
  const [local, setLocal] = useState({ blurAmount, brightness, overlayColor, overlayOpacity });
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl); // the working image (may be updated by crop)
  const [uploading, setUploading] = useState(false);
  // cb 固定在 mount 时生成，避免每次渲染变化导致图片反复重载
  const cbRef = useRef(Date.now());

  // Crop state
  const initPresetIdx = (() => {
    if (aspect == null) return 0;
    const idx = ASPECT_PRESETS.findIndex(p => p.value != null && Math.abs(p.value - aspect) < 0.01);
    return idx >= 0 ? idx : 0;
  })();
  const [presetIdx, setPresetIdx] = useState(initPresetIdx);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);

  const currentAspect = ASPECT_PRESETS[presetIdx].value;
  const patch = (p) => setLocal(prev => ({ ...prev, ...p }));

  // ── Crop helpers ──
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

  const handleApplyCrop = async () => {
    const image = imgRef.current;
    if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      // 无选区 → 直接切到效果 tab
      setTab("effect");
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
      if (!blob) { setUploading(false); setTab("effect"); return; }
      const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      setCurrentImageUrl(file_url);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setTab("effect");
    }, "image/jpeg", 0.92);
  };

  // ── File replace ──
  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    cbRef.current = Date.now(); // 新图刷新 cache-bust
    setCurrentImageUrl(URL.createObjectURL(file));
    setCrop(undefined);
    setCompletedCrop(undefined);
    setTab("crop");
  };

  // ── Final apply ──
  const handleApply = () => {
    onChange({ ...local, bgImageUrl: currentImageUrl });
    onClose();
  };

  // ── Effect preview style ──
  const previewStyle = {
    backgroundImage: `url(${currentImageUrl})`,
    filter: `blur(${local.blurAmount}px) brightness(${local.brightness / 100})`,
    transform: local.blurAmount > 0 ? "scale(1.05)" : undefined,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full" style={{ maxWidth: 780, maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-800 text-sm">编辑图片</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Body: left preview + right panel */}
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* ── Left: Preview ── */}
          <div className="flex-1 bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden border-r border-gray-100">
            {currentImageUrl ? (
              tab === "crop" ? (
                /* 裁切预览：ReactCrop 叠加在图片上 */
                <div
                  ref={containerCallbackRef}
                  className="w-full h-full overflow-auto flex items-center justify-center select-none"
                >
                  <div style={{ transform: `scale(${scale})`, transformOrigin: "center center", transition: "transform 0.1s ease" }}>
                    <ReactCrop
                      crop={crop}
                      onChange={(px, pct) => setCrop(pct)}
                      onComplete={(px) => setCompletedCrop(px)}
                      aspect={currentAspect}
                      minWidth={20}
                      minHeight={20}
                    >
                      <img
                        ref={imgRef}
                        src={currentImageUrl.startsWith("blob:") ? currentImageUrl : `${currentImageUrl}${currentImageUrl.includes("?") ? "&" : "?"}cb=${cbRef.current}`}
                        crossOrigin="anonymous"
                        onLoad={onImageLoad}
                        style={{ maxWidth: "100%", maxHeight: "60vh", display: "block" }}
                        alt="crop"
                        draggable={false}
                      />
                    </ReactCrop>
                  </div>
                </div>
              ) : (
                /* 效果预览 */
                <div className="relative w-full rounded-lg overflow-hidden shadow-md" style={{ maxHeight: "65vh", aspectRatio: "16/9" }}>
                  <div className="absolute inset-0 bg-cover bg-center" style={previewStyle} />
                  {local.overlayOpacity > 0 && (
                    <div className="absolute inset-0" style={{ backgroundColor: local.overlayColor, opacity: local.overlayOpacity / 100 }} />
                  )}
                  {previewTitle && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-white text-base font-bold drop-shadow">{previewTitle}</span>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="text-gray-300 flex flex-col items-center gap-2">
                <ImageIcon className="w-12 h-12" />
                <span className="text-xs">暂无图片</span>
              </div>
            )}

            {/* 缩放控制（仅裁切模式） */}
            {tab === "crop" && currentImageUrl && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/90 border border-gray-200 rounded-full px-2 py-1 shadow-sm">
                <button onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))))}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-sm">−</button>
                <span className="text-xs text-gray-500 w-9 text-center tabular-nums">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(3, parseFloat((s + 0.1).toFixed(2))))}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-sm">+</button>
                <button onClick={() => setScale(1)} className="text-xs text-gray-400 hover:text-gray-600 ml-0.5">重置</button>
              </div>
            )}
          </div>

          {/* ── Right: Controls ── */}
          <div className="w-56 flex-shrink-0 flex flex-col overflow-y-auto">
            {/* Tab switcher */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => setTab("crop")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  tab === "crop" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Crop className="w-3.5 h-3.5" />裁切
              </button>
              <button
                onClick={() => setTab("effect")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  tab === "effect" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />效果
              </button>
            </div>

            <div className="flex-1 p-3 space-y-4 overflow-y-auto">
              {tab === "crop" ? (
                <>
                  {/* 比例预设 */}
                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">宽高比</Label>
                    <div className="grid grid-cols-4 gap-1">
                      {ASPECT_PRESETS.map((p, i) => (
                        <button
                          key={p.label}
                          onClick={() => handlePresetClick(i)}
                          className={`py-1 rounded text-xs font-medium transition-colors ${
                            presetIdx === i ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">滚轮缩放图片，拖动选框调整裁切区域</p>
                  </div>

                  {/* 应用裁切 */}
                  <Button
                    size="sm" className="w-full h-8 text-xs"
                    onClick={handleApplyCrop}
                    disabled={uploading}
                  >
                    {uploading ? "处理中…" : "应用裁切 →"}
                  </Button>

                  {/* 更换图片 */}
                  <div className="pt-2 border-t border-gray-100">
                    <Button
                      size="sm" variant="outline" className="w-full h-8 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />更换图片
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* 效果滑块 */}
                  <SliderField label="模糊度" value={local.blurAmount} min={0} max={20} unit="px" onChange={v => patch({ blurAmount: v })} />
                  <SliderField label="明度" value={local.brightness} min={30} max={150} unit="%" onChange={v => patch({ brightness: v })} />
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">遮罩颜色</Label>
                    <div className="flex items-center gap-1.5">
                      <input type="color" value={local.overlayColor}
                        onChange={e => patch({ overlayColor: e.target.value })}
                        className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
                      <Input className="h-7 text-xs font-mono" value={local.overlayColor}
                        onChange={e => patch({ overlayColor: e.target.value })} />
                    </div>
                  </div>
                  <SliderField label="遮罩透明度" value={local.overlayOpacity} min={0} max={80} unit="%" onChange={v => patch({ overlayOpacity: v })} />

                  {/* 重新裁切入口 */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs"
                      onClick={() => { setCrop(undefined); setCompletedCrop(undefined); setTab("crop"); }}>
                      <Crop className="w-3 h-3 mr-1" />重新裁切
                    </Button>
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs"
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-3 h-3 mr-1" />更换图片
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onClose}>取消</Button>
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleApply} disabled={!currentImageUrl}>应用</Button>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) handleFile(f); }} />
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
  onChange,
  onRemove,
}) {
  const fileInputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingNewFile, setPendingNewFile] = useState(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
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
          imageUrl={pendingNewFile || imageUrl}
          initialMode={pendingNewFile ? "crop" : "edit"}
          blurAmount={blurAmount}
          brightness={brightness}
          overlayColor={overlayColor}
          overlayOpacity={overlayOpacity}
          previewTitle={previewTitle}
          aspect={aspect}
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
                  编辑
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
            <span className="text-xs">点击或拖拽图片至此上传</span>
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) handleFile(f); }} />
      </div>
    </>
  );
}