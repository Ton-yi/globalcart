import { useState, useEffect, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { tenantEntity } from "@/lib/tenantApi";
import { invalidateTenantConfigCache } from "@/lib/configCache";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Image as ImageIcon, Upload, X, CheckCircle2, XCircle } from "lucide-react";

const WIDTH_OPTIONS = [
  { value: "small",  label: "小", desc: "max-w-3xl" },
  { value: "medium", label: "中", desc: "max-w-5xl" },
  { value: "large",  label: "大", desc: "全宽" },
];

// ─── Crop Modal（复用 Hero 相同逻辑，自由比例）───────────────
function BannerCropModal({ src, onConfirm, onCancel }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const imgRef = useRef();

  const onImageLoad = (e) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    // 默认选中整张图（宽度90%，比例自由）
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 90 }, width / height, width, height), width, height);
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
      const file = new File([blob], "banner.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onConfirm(file_url);
    }, "image/jpeg", 0.9);
  }, [completedCrop, src]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl p-5 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">裁切 Banner 图片</h3>
          <button onClick={onCancel}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3">拖动选区以裁切图片（建议宽幅，如 4:1 ~ 6:1）</p>
        <div className="max-h-[60vh] overflow-auto flex justify-center">
          <ReactCrop crop={crop} onChange={(_, pct) => setCrop(pct)} onComplete={(c) => setCompletedCrop(c)}>
            <img ref={imgRef} src={src} onLoad={onImageLoad} className="max-w-full" alt="crop" />
          </ReactCrop>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleConfirm}>确认裁切并上传</Button>
        </div>
      </div>
    </div>
  );
}

function genId() { return `banner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── Main Manager ────────────────────────────────────────────
export default function BannerManager({ settings, onReload }) {
  const [config, setConfig] = useState({ width: "medium", images: [] });
  const [cropSrc, setCropSrc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const s = (settings || []).find(s => s.key === "home_banner_config");
    if (s?.value) {
      try { setConfig(JSON.parse(s.value)); } catch { /* noop */ }
    }
  }, [settings]);

  const openCrop = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (fileUrl) => {
    setCropSrc(null);
    const newImage = { id: genId(), url: fileUrl, isActive: true, uploadedAt: new Date().toISOString() };
    setConfig(prev => ({ ...prev, images: [...(prev.images || []), newImage] }));
  };

  const toggleActive = (id) => {
    setConfig(prev => ({
      ...prev,
      images: prev.images.map(img => img.id === id ? { ...img, isActive: !img.isActive } : img),
    }));
  };

  const deleteImage = (id) => {
    setConfig(prev => ({ ...prev, images: prev.images.filter(img => img.id !== id) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = (settings || []).find(s => s.key === "home_banner_config");
      const value = JSON.stringify(config);
      if (existing?.id) {
        await tenantEntity.update("SiteSettings", existing.id, { value });
      } else {
        await tenantEntity.create("SiteSettings", {
          key: "home_banner_config", value,
          description: "主页 Banner 配置（JSON）", category: "general",
        });
      }
      invalidateTenantConfigCache();
      await onReload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = (config.images || []).filter(i => i.isActive).length;

  return (
    <>
      {cropSrc && (
        <BannerCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <Card className="border-indigo-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-500" />
              <CardTitle className="text-sm font-semibold text-gray-700">导航栏上方 Banner</CardTitle>
            </div>
            <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            上传图片至图库（最多 10 张）。点击图片可启用/禁用。启用的图片将在用户每次刷新时随机展示一张。
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 宽度选择 */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">展示宽度</Label>
            <div className="flex gap-2">
              {WIDTH_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setConfig(prev => ({ ...prev, width: opt.value }))}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    config.width === opt.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 图库 */}
          {(config.images || []).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-gray-500">图库（{(config.images || []).length}/10）</Label>
                <span className="text-xs text-gray-400">
                  {activeCount === 0
                    ? "当前无启用图片，Banner 不显示"
                    : activeCount === 1
                    ? "1 张启用 — 固定展示"
                    : `${activeCount} 张启用 — 随机展示`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(config.images || []).map(img => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={img.url}
                      alt=""
                      className={`w-full h-20 object-cover cursor-pointer transition-opacity ${img.isActive ? "opacity-100" : "opacity-30"}`}
                      onClick={() => toggleActive(img.id)}
                    />
                    {/* 状态叠加 */}
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      onClick={() => toggleActive(img.id)}
                    >
                      {img.isActive
                        ? <CheckCircle2 className="w-6 h-6 text-green-400 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                        : <XCircle className="w-6 h-6 text-gray-400 drop-shadow opacity-70" />
                      }
                    </div>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => deleteImage(img.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                    {/* 状态标签 */}
                    <div className={`absolute bottom-0 inset-x-0 text-center text-xs py-0.5 ${img.isActive ? "bg-green-500/80 text-white" : "bg-gray-500/70 text-white"}`}>
                      {img.isActive ? "启用" : "已禁用"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 上传区 */}
          {(config.images || []).length < 10 && (
            <div>
              {(config.images || []).length === 0 && (
                <Label className="text-xs text-gray-500 mb-1.5 block">上传图片</Label>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); openCrop(e.dataTransfer.files[0]); }}
                className={`w-full h-16 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 transition-colors text-sm ${
                  dragging ? "border-indigo-400 bg-indigo-50 text-indigo-500"
                  : "border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500"
                }`}>
                <Upload className="w-4 h-4" />
                点击或拖拽上传图片（将进入裁切步骤）
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) openCrop(f); }}
          />
        </CardContent>
      </Card>
    </>
  );
}