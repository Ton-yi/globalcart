import { useState, useEffect, useRef, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { tenantEntity } from "@/lib/tenantApi";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Layout, Upload, X, Loader2, ImageIcon, Plus, Trash2 } from "lucide-react";
import { DEFAULT_HERO } from "@/components/home/HeroSection";

const VARIANT_OPTIONS = [
  { value: "primary", label: "实心按钮" },
  { value: "outline", label: "描边按钮" },
];

const ICON_OPTIONS = [
  { value: "none", label: "无图标" },
  { value: "ShoppingBag", label: "🛍 购物袋" },
];

function genId() { return `btn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── ImageCropModal ──────────────────────────────────────
function ImageCropModal({ src, onConfirm, onCancel }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const imgRef = useRef();

  const onImageLoad = (e) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const c = centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 3 / 1, width, height), width, height);
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
      const file = new File([blob], "hero-bg.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onConfirm(file_url);
    }, "image/jpeg", 0.9);
  }, [completedCrop, src]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl p-5 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">裁切背景图片</h3>
          <button onClick={onCancel}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3">拖动选区以裁切图片（推荐宽高比 3:1）</p>
        <div className="max-h-[60vh] overflow-auto flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={3}
          >
            <img ref={imgRef} src={src} onLoad={onImageLoad} className="max-w-full" alt="crop" />
          </ReactCrop>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirm}>确认裁切并上传</Button>
        </div>
      </div>
    </div>
  );
}

// ─── SliderField ─────────────────────────────────────────
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
        className="w-full h-1.5 rounded accent-blue-600"
      />
    </div>
  );
}

// 常用内页选项（与 QuickActionsGrid 相同的 createPageUrl 路由逻辑）
const PAGE_OPTIONS = [
  { value: "__empty__", label: "（留空 → 登录页）" },
  { value: "Home", label: "主页" },
  { value: "SubmitOrder", label: "提交订单" },
  { value: "MyOrders", label: "我的订单" },
  { value: "ShippingPool", label: "发货 & 拼邮" },
  { value: "GroupBuy", label: "拼单" },
  { value: "MemberTiers", label: "会员阶级" },
  { value: "Notifications", label: "通知中心" },
  { value: "UserPreferences", label: "个人设置" },
  { value: "__custom__", label: "✏️ 自定义网址…" },
];

function isCustomUrl(page) {
  return page && page.startsWith("http");
}

function getSelectValue(page) {
  if (!page) return "__empty__";
  if (isCustomUrl(page)) return "__custom__";
  return page;
}

// ─── ButtonEditor ─────────────────────────────────────────
function ButtonEditor({ buttons, onChange }) {
  const update = (idx, field, val) => onChange(buttons.map((b, i) => i === idx ? { ...b, [field]: val } : b));
  const remove = (idx) => onChange(buttons.filter((_, i) => i !== idx));
  const add = () => onChange([...buttons, { id: genId(), label: "按钮", page: "", variant: "outline", color: "", icon: "", loggedInOnly: true, guestOnly: false }]);

  return (
    <div className="space-y-2">
      {buttons.map((btn, idx) => (
        <div key={btn.id || idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">按钮文字</Label>
              <Input className="h-7 text-xs mt-0.5" value={btn.label} onChange={e => update(idx, "label", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">跳转目标</Label>
              <Select
                value={getSelectValue(btn.page)}
                onValueChange={v => {
                  if (v === "__custom__") update(idx, "page", "https://");
                  else if (v === "__empty__") update(idx, "page", "");
                  else update(idx, "page", v);
                }}
              >
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {isCustomUrl(btn.page) && (
                <div className="mt-1">
                  <Input
                    className="h-7 text-xs font-mono"
                    value={btn.page}
                    onChange={e => update(idx, "page", e.target.value)}
                    placeholder="https://example.com"
                  />
                  <p className="text-xs text-blue-500 mt-0.5">外部链接将在新标签页打开</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500">样式</Label>
              <Select value={btn.variant} onValueChange={v => update(idx, "variant", v)}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>{VARIANT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">按钮颜色（实心有效）</Label>
              <div className="flex items-center gap-1 mt-0.5">
                <input type="color" value={btn.color || "#dc2626"} onChange={e => update(idx, "color", e.target.value)}
                  className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5" />
                <Input className="h-7 text-xs flex-1 font-mono" value={btn.color || ""} onChange={e => update(idx, "color", e.target.value)} placeholder="#dc2626" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">图标</Label>
              <Select value={btn.icon || "none"} onValueChange={v => update(idx, "icon", v === "none" ? "" : v)}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>{ICON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={!!btn.loggedInOnly} onChange={e => update(idx, "loggedInOnly", e.target.checked)} />
                仅登录用户可见
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={!!btn.guestOnly} onChange={e => update(idx, "guestOnly", e.target.checked)} />
                仅未登录用户可见
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" onClick={() => remove(idx)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} className="w-full h-7 text-xs border-dashed">
        <Plus className="w-3 h-3 mr-1" />新增按钮
      </Button>
    </div>
  );
}

// ─── Main Manager ─────────────────────────────────────────
export default function HeroSectionManager({ settings, onReload }) {
  const [form, setForm] = useState({ ...DEFAULT_HERO });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState(null); // raw local URL for crop modal
  const fileInputRef = useRef();

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_hero_config");
    if (setting?.value) {
      try { setForm({ ...DEFAULT_HERO, ...JSON.parse(setting.value) }); } catch { /* noop */ }
    }
  }, [settings]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const existing = (settings || []).find(s => s.key === "home_hero_config");
    const value = JSON.stringify(form);
    if (existing?.id) {
      await tenantEntity.update("SiteSettings", existing.id, { value });
    } else {
      await tenantEntity.create("SiteSettings", { key: "home_hero_config", value, description: "主页 Hero 区块配置（JSON）", category: "general" });
    }
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // File pick → show crop modal
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const handleCropConfirm = async (fileUrl) => {
    setCropSrc(null);
    f("bgImageUrl", fileUrl);
    f("bgMode", "image");
  };

  return (
    <>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <Card className="border-purple-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4 text-purple-500" />
              <CardTitle className="text-sm font-semibold text-gray-700">主页 Hero 区块自定义</CardTitle>
            </div>
            <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">自定义主页横幅的标题、说明、背景和按钮，留空则使用租户品牌默认值。</p>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Text */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs text-gray-500">标题（留空使用品牌名）</Label>
              <Input className="mt-0.5 text-sm" value={form.title} onChange={e => f("title", e.target.value)} placeholder="同一物流 · Tongyi Express" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">副标题（留空使用品牌副标题）</Label>
              <Input className="mt-0.5 text-sm" value={form.subtitle} onChange={e => f("subtitle", e.target.value)} placeholder="专业代购..." />
            </div>
            <div>
              <Label className="text-xs text-gray-500">顶部徽标文字</Label>
              <Input className="mt-0.5 text-sm" value={form.badgeText} onChange={e => f("badgeText", e.target.value)} placeholder="日本 → 全球" />
            </div>
          </div>

          {/* Background mode */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">背景类型</Label>
            <div className="flex gap-2">
              {[{ v: "white", label: "纯白" }, { v: "color", label: "单色" }, { v: "image", label: "图片" }].map(opt => (
                <button key={opt.v} onClick={() => f("bgMode", opt.v)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${form.bgMode === opt.v ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color mode */}
          {form.bgMode === "color" && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <Label className="text-xs text-gray-500">背景颜色</Label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input type="color" value={form.bgColor || "#ffffff"} onChange={e => f("bgColor", e.target.value)}
                    className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
                  <Input className="h-7 text-xs font-mono flex-1" value={form.bgColor || "#ffffff"} onChange={e => f("bgColor", e.target.value)} />
                </div>
              </div>
              <SliderField label="透明度" value={form.bgOpacity ?? 100} min={10} max={100} unit="%" onChange={v => f("bgOpacity", v)} />
            </div>
          )}

          {/* Image mode */}
          {form.bgMode === "image" && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">背景图片</Label>
                {form.bgImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden h-24 border border-gray-200">
                    <img src={form.bgImageUrl} className="w-full h-full object-cover" alt="hero bg" />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                      <Button size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-3 h-3 mr-1" />更换
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { f("bgImageUrl", ""); f("bgMode", "white"); }}>
                        <X className="w-3 h-3 mr-1" />移除
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-colors"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs">点击上传背景图片（将进入裁切步骤）</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
              <SliderField label="模糊度（雾化）" value={form.blurAmount ?? 0} min={0} max={20} unit="px" onChange={v => f("blurAmount", v)} />
              <SliderField label="明度" value={form.brightness ?? 100} min={30} max={150} unit="%" onChange={v => f("brightness", v)} />
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">遮罩颜色</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.overlayColor || "#000000"} onChange={e => f("overlayColor", e.target.value)}
                    className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5" />
                  <Input className="h-7 text-xs font-mono flex-1" value={form.overlayColor || "#000000"} onChange={e => f("overlayColor", e.target.value)} />
                </div>
              </div>
              <SliderField label="遮罩透明度" value={form.overlayOpacity ?? 0} min={0} max={80} unit="%" onChange={v => f("overlayOpacity", v)} />
            </div>
          )}

          {/* Buttons */}
          <div>
            <Label className="text-xs text-gray-500 mb-2 block">按钮配置</Label>
            <ButtonEditor buttons={form.buttons || []} onChange={btns => f("buttons", btns)} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}