import { useState, useEffect, useRef } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { invalidateTenantConfigCache } from "@/lib/configCache";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Image as ImageIcon, Upload, X, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import ImageEffectsPanel, { ImageCropModal } from "@/components/admin/ImageEffectsPanel";

const WIDTH_OPTIONS = [
  { value: "small",  label: "小", desc: "max-w-3xl" },
  { value: "medium", label: "中", desc: "max-w-5xl" },
  { value: "large",  label: "大", desc: "全宽" },
];

function genId() { return `banner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── SingleImageEditor — 每张图片的效果折叠面板 ───────────
function SingleImageEditor({ img, onUpdate, onPatch, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-lg border transition-colors ${img.isActive ? "border-gray-200" : "border-gray-100"}`}>
      {/* 缩略图行 */}
      <div className="relative group overflow-hidden rounded-t-lg">
        <img
          src={img.url}
          alt=""
          className={`w-full h-20 object-cover cursor-pointer transition-opacity ${img.isActive ? "opacity-100" : "opacity-30"}`}
          style={{
            filter: `blur(${Math.min(img.blurAmount ?? 0, 3)}px) brightness(${(img.brightness ?? 100) / 100})`,
          }}
          onClick={() => onUpdate({ ...img, isActive: !img.isActive })}
        />
        {/* 遮罩预览叠加 */}
        {(img.overlayOpacity ?? 0) > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: img.overlayColor || "#000000", opacity: (img.overlayOpacity ?? 0) / 100 }}
          />
        )}
        {/* 状态标签 */}
        <div className={`absolute bottom-0 inset-x-0 text-center text-xs py-0.5 pointer-events-none ${img.isActive ? "bg-green-500/80 text-white" : "bg-gray-500/70 text-white"}`}>
          {img.isActive ? "启用" : "已禁用"}
        </div>
        {/* 删除按钮 */}
        <button
          onClick={() => onDelete(img.id)}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded-b-lg">
        <button
          onClick={() => onUpdate({ ...img, isActive: !img.isActive })}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          {img.isActive
            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            : <XCircle className="w-3.5 h-3.5 text-gray-400" />}
          {img.isActive ? "启用" : "禁用"}
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-700">
          效果
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 效果面板（折叠） */}
      {open && (
      <div className="p-3 border-t border-gray-100 bg-white rounded-b-lg">
        <ImageEffectsPanel
          imageUrl={img.url}
          blurAmount={img.blurAmount ?? 0}
          brightness={img.brightness ?? 100}
          overlayColor={img.overlayColor || "#000000"}
          overlayOpacity={img.overlayOpacity ?? 0}
          onChange={patch => onPatch(img.id, patch)}
          onRemove={() => onDelete(img.id)}
        />
      </div>
      )}
    </div>
  );
}

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

  const handleCropConfirm = (fileUrl) => {
    setCropSrc(null);
    const newImage = { id: genId(), url: fileUrl, isActive: true, uploadedAt: new Date().toISOString(), blurAmount: 0, brightness: 100, overlayColor: "#000000", overlayOpacity: 0 };
    setConfig(prev => ({ ...prev, images: [...(prev.images || []), newImage] }));
  };

  const updateImage = (updated) => {
    setConfig(prev => ({ ...prev, images: prev.images.map(img => img.id === updated.id ? updated : img) }));
  };

  const patchImage = (id, patch) => {
    setConfig(prev => ({
      ...prev,
      images: prev.images.map(img => img.id === id ? { ...img, ...patch } : img),
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
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
          hint="拖动选区以裁切 Banner 图片（建议宽幅，如 4:1 ~ 6:1）"
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
            上传图片至图库（最多 10 张）。点击图片切换启用/禁用；点击"效果"可编辑模糊、明度、遮罩等。启用的图片在用户每次刷新时随机展示一张。
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
                  <SingleImageEditor
                    key={img.id}
                    img={img}
                    onUpdate={updateImage}
                    onPatch={patchImage}
                    onDelete={deleteImage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 上传区 */}
          {(config.images || []).length < 10 && (
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