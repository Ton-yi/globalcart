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

export function ImageCropModal({ src, onConfirm, onCancel, aspect, hint, filename = "image.jpg", zIndex = "z-50" }) {
  // 初始比例：优先用传入的 aspect，否则找最接近的预设，否则"自由"
  const initPreset = (() => {
    if (aspect == null) return 0; // 自由
    const idx = ASPECT_PRESETS.findIndex(p => p.value != null && Math.abs(p.value - aspect) < 0.01);
    return idx >= 0 ? idx : 0;
  })();

  const [presetIdx, setPresetIdx] = useState(initPreset);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef();
  const containerRef = useRef();

  const currentAspect = ASPECT_PRESETS[presetIdx].value;

  // 切换比例时重置裁切框
  const applyPreset = (idx) => {
    setPresetIdx(idx);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const onImageLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const ratio = currentAspect ?? w / h;
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 85 }, ratio, w, h), w, h);
    setCrop(c);
  };

  // 每次比例改变后，如果图片已加载，重新生成裁切框
  const resetCropForAspect = useCallback((newAspect) => {
    const image = imgRef.current;
    if (!image) return;
    const { naturalWidth: w, naturalHeight: h } = image;
    const ratio = newAspect ?? w / h;
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 85 }, ratio, w, h), w, h);
    setCrop(c);
    setCompletedCrop(undefined);
  }, []);

  const handlePresetClick = (idx) => {
    applyPreset(idx);
    resetCropForAspect(ASPECT_PRESETS[idx].value);
  };

  // 滚轮缩放
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(3, Math.max(0.5, parseFloat((prev + delta).toFixed(2)))));
  }, []);

  // 绑定/解绑滚轮事件（passive:false 以允许 preventDefault）
  const containerCallbackRef = useCallback((node) => {
    if (node) {
      node.addEventListener("wheel", handleWheel, { passive: false });
      containerRef.current = node;
    } else if (containerRef.current) {
      containerRef.current.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  const handleConfirm = useCallback(async () => {
    const image = imgRef.current;
    if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      onConfirm(src);
      return;
    }
    setUploading(true);
    // completedCrop 是像素值，对应的是 img 元素的渲染尺寸（已经含 scale 缩放）
    // img 元素的实际渲染宽高 = image.width（CSS 像素），而 naturalWidth 是原始像素
    // 但 ReactCrop 的 completedCrop 是相对于 img 元素的渲染尺寸（不含 CSS transform scale）
    // 我们用 scale 对图片做了 CSS transform，所以需要除以 scale 换算回未缩放坐标
    const renderedW = image.width;   // ReactCrop 内 img 元素的 CSS 宽度（未缩放的布局宽度）
    const renderedH = image.height;
    const scaleX = image.naturalWidth / renderedW;
    const scaleY = image.naturalHeight / renderedH;
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(completedCrop.width  * scaleX);
    canvas.height = Math.round(completedCrop.height * scaleY);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width  * scaleX,
      completedCrop.height * scaleY,
      0, 0, canvas.width, canvas.height,
    );
    canvas.toBlob(async (blob) => {
      if (!blob) { setUploading(false); onConfirm(src); return; }
      const file = new File([blob], filename, { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      onConfirm(file_url);
    }, "image/jpeg", 0.92);
  }, [completedCrop, src, filename]);

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/70`}>
      <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-2xl w-full mx-4" style={{ maxHeight: "92vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-800">裁切图片</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {/* 比例预设栏 */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-gray-100 flex-wrap flex-shrink-0">
          {ASPECT_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => handlePresetClick(i)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                presetIdx === i
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">滚轮缩放图片 · 拖拽选区裁切</span>
        </div>

        {/* 裁切区域（可滚动） */}
        <div
          ref={containerCallbackRef}
          className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 p-4 select-none"
          style={{ minHeight: 0 }}
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
                style={{ maxWidth: "100%", maxHeight: "50vh", display: "block" }}
                alt="crop"
                draggable={false}
              />
            </ReactCrop>
          </div>
        </div>

        {/* 缩放指示器 + 操作按钮 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))))}
              className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold"
            >−</button>
            <span className="text-xs text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(3, parseFloat((s + 0.1).toFixed(2))))}
              className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold"
            >+</button>
            <button
              onClick={() => setScale(1)}
              className="text-xs text-gray-400 hover:text-gray-600 ml-1"
            >重置</button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={uploading}>取消</Button>
            <Button size="sm" onClick={handleConfirm} disabled={uploading}>
              {uploading ? "上传中…" : "确认裁切并上传"}
            </Button>
          </div>
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

// ─── ImageEditModal ────────────────────────────────────────
// 图片编辑弹窗：沙盒模式，内置上传+裁切+效果调整，确认后才提交给父组件
function ImageEditModal({ imageUrl, blurAmount, brightness, overlayColor, overlayOpacity, previewTitle, onChange, onClose, aspect = 3, cropHint }) {
  const fileInputRef = useRef();
  const [local, setLocal] = useState({ blurAmount, brightness, overlayColor, overlayOpacity });
  // pendingImageUrl: 用户在弹窗内上传/裁切后的临时图片，未确认前不影响外部
  const [pendingImageUrl, setPendingImageUrl] = useState(imageUrl);
  const [cropSrc, setCropSrc] = useState(null);

  const patch = (p) => setLocal(prev => ({ ...prev, ...p }));

  const handleConfirm = () => {
    onChange({ ...local, bgImageUrl: pendingImageUrl });
    onClose();
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCropSrc(URL.createObjectURL(file));
  };

  const [draggingOver, setDraggingOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggingOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const displayUrl = pendingImageUrl;

  return (
    <>
      {/* 裁切弹窗（z-[60] 确保浮于编辑弹窗之上） */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={aspect}
          hint={cropHint || "拖动选区以裁切图片"}
          zIndex="z-[60]"
          onConfirm={(url) => { setCropSrc(null); setPendingImageUrl(url); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-xl shadow-2xl p-5 max-w-lg w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">编辑图片</h3>
            <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
          </div>

          {/* 预览区 / 上传区 */}
          {displayUrl ? (
            <div
              className={`relative rounded-lg overflow-hidden h-32 mb-4 border-2 transition-colors ${draggingOver ? "border-blue-400 border-dashed" : "border-gray-200"} group`}
              onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={() => setDraggingOver(false)}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{
                backgroundImage: `url(${displayUrl})`,
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
              {/* 拖拽悬停提示 */}
              {draggingOver ? (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/60">
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs font-medium">松开以上传图片</span>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <Button size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-800 hover:bg-white"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-3 h-3 mr-1" />更换图片
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <button
              className={`w-full h-24 mb-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
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
            <Button size="sm" className="h-8 text-xs" onClick={handleConfirm}>应用</Button>
          </div>
        </div>
      </div>
    </>
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
  aspect,
  cropHint,
  onChange,
  onRemove,
  onFileSelected,  // (file: File) => void — 由消费方实现上传+裁切（无图时仍用）
}) {
  const fileInputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
      {editOpen && imageUrl && (
        <ImageEditModal
          imageUrl={imageUrl}
          blurAmount={blurAmount}
          brightness={brightness}
          overlayColor={overlayColor}
          overlayOpacity={overlayOpacity}
          previewTitle={previewTitle}
          aspect={aspect}
          cropHint={cropHint}
          onChange={onChange}
          onClose={() => setEditOpen(false)}
        />
      )}

      <div className="space-y-3">
        {/* 预览区（有图时显示） */}
        {imageUrl ? (
          <div
            className={`relative rounded-lg overflow-hidden h-28 border-2 shadow-sm transition-colors ${dragging ? "border-blue-400 border-dashed" : "border-gray-300"}`}
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

        {/* 效果控制入口提示（有图时显示，实际编辑在弹窗内） */}
        {imageUrl && (
          <p className="text-xs text-gray-400 text-center">点击"编辑"按钮调整效果或更换图片</p>
        )}
      </div>
    </>
  );
}