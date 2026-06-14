import { useState, useEffect, useRef } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { invalidateTenantConfigCache } from "@/lib/configCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Zap, ImageIcon, Upload, X } from "lucide-react";
import QuickActionImageCropModal from "@/components/admin/QuickActionImageCropModal";

const ICON_OPTIONS = [
  { value: "Send", label: "📤 预报发货" },
  { value: "Package", label: "📦 订单/包裹" },
  { value: "Truck", label: "🚚 发货池" },
  { value: "ShoppingBag", label: "🛍 提交订单" },
  { value: "MapPin", label: "📍 地址管理" },
  { value: "Bell", label: "🔔 通知" },
  { value: "Users", label: "👥 用户管理" },
  { value: "Settings", label: "⚙️ 设置" },
  { value: "BarChart3", label: "📊 报表" },
  { value: "Star", label: "⭐ 会员" },
  { value: "CreditCard", label: "💳 支付" },
  { value: "Globe", label: "🌐 国际" },
  { value: "Home", label: "🏠 首页" },
  { value: "MessageSquare", label: "💬 消息" },
  { value: "Archive", label: "🗂 归档" },
  { value: "Layers", label: "📚 拼邮" },
  { value: "Zap", label: "⚡ 快捷" },
  { value: "FileText", label: "📄 文件" },
  { value: "ClipboardList", label: "📋 清单" },
  { value: "Box", label: "📦 外箱" },
  { value: "Warehouse", label: "🏭 仓库" },
  { value: "Receipt", label: "🧾 收据" },
  { value: "CalendarDays", label: "📅 日历" },
  { value: "Search", label: "🔍 搜索" },
  { value: "Download", label: "⬇️ 下载" },
  { value: "Upload", label: "⬆️ 上传" },
  { value: "RefreshCw", label: "🔄 刷新" },
  { value: "Tag", label: "🏷 标签" },
  { value: "Link", label: "🔗 链接" },
  { value: "Phone", label: "📞 电话" },
  { value: "Mail", label: "✉️ 邮件" },
  { value: "QrCode", label: "QR码" },
  { value: "Banknote", label: "💵 账单" },
  { value: "Handshake", label: "🤝 协议" },
  { value: "emoji", label: "✏️ 自定义 Emoji..." },
  { value: "custom_image", label: "🖼 自定义图片..." },
];

const COLOR_OPTIONS = [
  { value: "bg-red-500", label: "红色" },
  { value: "bg-blue-500", label: "蓝色" },
  { value: "bg-green-500", label: "绿色" },
  { value: "bg-yellow-500", label: "黄色" },
  { value: "bg-purple-500", label: "紫色" },
  { value: "bg-indigo-500", label: "靛蓝" },
  { value: "bg-pink-500", label: "粉色" },
  { value: "bg-orange-500", label: "橙色" },
  { value: "bg-teal-500", label: "青色" },
  { value: "bg-cyan-500", label: "天蓝" },
  { value: "bg-rose-500", label: "玫红" },
  { value: "bg-emerald-500", label: "翠绿" },
  { value: "bg-amber-500", label: "琥珀" },
  { value: "bg-violet-500", label: "紫罗兰" },
  { value: "bg-gray-600", label: "灰色" },
  { value: "bg-slate-700", label: "深灰" },
];

const AUDIENCE_TABS = [
  { key: "guest", label: "未登录用户可见" },
  { key: "user",  label: "仅登录用户可见" },
  { key: "admin", label: "仅管理员可见" },
];

const DEFAULT_ACTION = {
  id: "", title: "", icon: "Package", emoji: "", color: "bg-blue-500", path: "",
};

function generateId() {
  return `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isEmojiMode(icon) {
  return !icon || icon === "emoji" || (icon.length <= 4 && !/^[A-Z]/.test(icon));
}

// Migrate old flat array format → new audience-based format
function migrateConfig(raw) {
  if (!raw) return { unified: true, guest: { actions: [] }, user: { actions: [] }, admin: { actions: [] } };
  // Already new format
  if (raw.guest !== undefined || raw.user !== undefined || raw.admin !== undefined) {
    return {
      unified: raw.unified ?? false,
      guest: { actions: raw.guest?.actions || [] },
      user:  { actions: raw.user?.actions  || [] },
      admin: { actions: raw.admin?.actions || [] },
    };
  }
  // Old flat array
  if (Array.isArray(raw)) {
    return { unified: true, guest: { actions: raw }, user: { actions: [] }, admin: { actions: [] } };
  }
  return { unified: true, guest: { actions: [] }, user: { actions: [] }, admin: { actions: [] } };
}

function cloneAudience(a) {
  return { actions: (a.actions || []).map(act => ({ ...act })) };
}

// ─── ActionEditor ─────────────────────────────────────────
function ActionEditor({ action, idx, total, onUpdate, onUpdateMulti, onRemove, onMoveUp, onMoveDown }) {
  const fileInputRef = useRef();
  const [cropSrc, setCropSrc] = useState(null);   // local blob: URL for new file
  const [reEditMode, setReEditMode] = useState(false); // re-editing existing uploaded image

  const emojiMode = isEmojiMode(action.icon);
  const imageMode = action.icon === "custom_image";
  const previewIcon = emojiMode && !imageMode ? (action.emoji || action.icon || "❓") : null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    e.target.value = "";
    setReEditMode(false);
    setCropSrc(URL.createObjectURL(file));
  };

  const handleReEdit = () => {
    setCropSrc(null);
    setReEditMode(true);
  };

  const handleCropConfirm = ({ imageUrl, imageSize, blurAmount, brightness, overlayColor, overlayOpacity }) => {
    setCropSrc(null);
    setReEditMode(false);
    onUpdateMulti({ icon: "custom_image", imageUrl, imageSize, blurAmount, brightness, overlayColor, overlayOpacity });
  };

  const handleCropCancel = () => {
    setCropSrc(null);
    setReEditMode(false);
  };

  // Preview for custom_image mode
  const renderPreview = () => {
    if (imageMode && action.imageUrl) {
      const isFill = action.imageSize === "fill";
      return (
        <div className={`w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden relative mt-1 ${!isFill ? (action.color || "bg-gray-400") : ""}`}>
          {isFill ? (
            <>
              <div className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${action.imageUrl})`,
                  filter: `blur(${action.blurAmount ?? 0}px) brightness(${(action.brightness ?? 100) / 100})`,
                  transform: (action.blurAmount ?? 0) > 0 ? "scale(1.08)" : undefined,
                }}
              />
              {(action.overlayOpacity ?? 0) > 0 && (
                <div className="absolute inset-0" style={{ backgroundColor: action.overlayColor || "#000000", opacity: (action.overlayOpacity ?? 0) / 100 }} />
              )}
            </>
          ) : (
            <img src={action.imageUrl} alt="" className="w-4/5 h-4/5 object-contain rounded"
              style={{ filter: `blur(${action.blurAmount ?? 0}px) brightness(${(action.brightness ?? 100) / 100})` }}
            />
          )}
        </div>
      );
    }
    return (
      <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 ${action.color || 'bg-gray-400'}`}>
        {emojiMode
          ? <span className="text-lg leading-none">{previewIcon}</span>
          : <span className="text-white text-xs font-bold">{action.icon?.slice(0, 2)}</span>
        }
      </div>
    );
  };

  return (
    <>
      {(cropSrc || reEditMode) && (
        <QuickActionImageCropModal
          src={reEditMode ? null : cropSrc}
          existingUrl={reEditMode ? action.imageUrl : undefined}
          imageConfig={{ imageSize: action.imageSize, blurAmount: action.blurAmount, brightness: action.brightness, overlayColor: action.overlayColor, overlayOpacity: action.overlayOpacity }}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
        <div className="flex items-start gap-2">
          {/* 排序 */}
          <div className="flex flex-col gap-0.5 mt-1">
            <button onClick={onMoveUp} disabled={idx === 0}
              className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▲</button>
            <button onClick={onMoveDown} disabled={idx === total - 1}
              className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▼</button>
          </div>

          {/* 预览 */}
          {renderPreview()}

          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">入口标题</Label>
              <Input className="h-7 text-xs mt-0.5" value={action.title}
                onChange={e => onUpdate("title", e.target.value)} placeholder="如：提交订单" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">跳转路径</Label>
              <Input className="h-7 text-xs mt-0.5 font-mono" value={action.path}
                onChange={e => onUpdate("path", e.target.value)} placeholder="如：SubmitOrder" />
            </div>

            <div>
              <Label className="text-xs text-gray-500">图标类型</Label>
              <Select
                value={imageMode ? "custom_image" : emojiMode ? "emoji" : action.icon}
                onValueChange={v => {
                  if (v === "emoji") {
                    onUpdate("icon", "emoji");
                  } else if (v === "custom_image") {
                    onUpdate("icon", "custom_image");
                  } else {
                    onUpdate("icon", v);
                    onUpdate("emoji", "");
                  }
                }}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {ICON_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {imageMode ? (
              <div>
                <Label className="text-xs text-gray-500">图片操作</Label>
                <div className="flex gap-1 mt-0.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-3 h-3 mr-1" />{action.imageUrl ? "更换图片" : "上传图片"}
                  </Button>
                  {action.imageUrl && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                      onClick={() => onUpdateMulti({ imageUrl: "", imageSize: undefined, blurAmount: undefined, brightness: undefined, overlayColor: undefined, overlayOpacity: undefined })}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : emojiMode ? (
              <div>
                <Label className="text-xs text-gray-500">Emoji 图标</Label>
                <Input className="h-7 text-sm mt-0.5 text-center" value={action.emoji || ""}
                  onChange={e => onUpdate("emoji", e.target.value)}
                  placeholder="🚀" maxLength={4} />
              </div>
            ) : (
              <div>
                <Label className="text-xs text-gray-500">颜色</Label>
                <Select value={action.color} onValueChange={v => onUpdate("color", v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${o.value}`} />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 背景色：仅在 emoji 模式或 custom_image 正方形模式下显示 */}
            {(emojiMode && !imageMode) && (
              <div>
                <Label className="text-xs text-gray-500">背景颜色</Label>
                <Select value={action.color} onValueChange={v => onUpdate("color", v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${o.value}`} />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {imageMode && action.imageSize === "square" && (
              <div>
                <Label className="text-xs text-gray-500">背景颜色（正方形模式）</Label>
                <Select value={action.color || "bg-gray-400"} onValueChange={v => onUpdate("color", v)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${o.value}`} />
                          {o.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 flex-shrink-0 mt-1"
            onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Image re-edit hint */}
        {imageMode && action.imageUrl && (
          <div className="ml-8 flex items-center gap-2">
            <button className="text-xs text-orange-500 hover:text-orange-700 underline underline-offset-2"
              onClick={handleReEdit}>
              调整效果
            </button>
            <span className="text-xs text-gray-400">
              当前：{action.imageSize === "fill" ? "填充模式" : "正方形"}
              {(action.blurAmount ?? 0) > 0 ? `，模糊 ${action.blurAmount}px` : ""}
              {(action.overlayOpacity ?? 0) > 0 ? `，遮罩 ${action.overlayOpacity}%` : ""}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── AudiencePanel ─────────────────────────────────────────
function AudiencePanel({ audience, onChange }) {
  const actions = audience.actions || [];

  const addAction = () => onChange({ actions: [...actions, { ...DEFAULT_ACTION, id: generateId() }] });
  const removeAction = (idx) => onChange({ actions: actions.filter((_, i) => i !== idx) });
  const updateAction = (idx, field, val) => onChange({ actions: actions.map((a, i) => i === idx ? { ...a, [field]: val } : a) });
  const updateActionMulti = (idx, patch) => onChange({ actions: actions.map((a, i) => i === idx ? { ...a, ...patch } : a) });
  const moveAction = (idx, dir) => {
    const next = [...actions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ actions: next });
  };

  return (
    <div className="space-y-3">
      {actions.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-lg">
          暂无快捷操作，点击下方「新增」按钮添加
        </div>
      )}
      {actions.map((action, idx) => (
        <ActionEditor
          key={action.id || idx}
          action={action}
          idx={idx}
          total={actions.length}
          onUpdate={(field, val) => updateAction(idx, field, val)}
          onUpdateMulti={(patch) => updateActionMulti(idx, patch)}
          onRemove={() => removeAction(idx)}
          onMoveUp={() => moveAction(idx, -1)}
          onMoveDown={() => moveAction(idx, 1)}
        />
      ))}
      <Button size="sm" variant="outline" onClick={addAction} className="w-full h-8 text-xs border-dashed">
        <Plus className="w-3.5 h-3.5 mr-1" />新增快捷操作
      </Button>
    </div>
  );
}

// ─── Main Manager ─────────────────────────────────────────
export default function QuickActionsManager({ settings, onReload }) {
  const [form, setForm] = useState(migrateConfig(null));
  const [activeTab, setActiveTab] = useState("guest");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_quick_actions");
    if (setting?.value) {
      try { setForm(migrateConfig(JSON.parse(setting.value))); } catch { /* noop */ }
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveForm = form.unified
        ? { ...form, user: cloneAudience(form.guest), admin: cloneAudience(form.guest) }
        : form;
      const existing = (settings || []).find(s => s.key === "home_quick_actions");
      const value = JSON.stringify(saveForm);
      if (existing?.id) {
        await tenantEntity.update("SiteSettings", existing.id, { value });
      } else {
        await tenantEntity.create("SiteSettings", {
          key: "home_quick_actions", value,
          description: "主页快捷操作入口配置（JSON）", category: "general",
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

  const toggleUnified = (checked) => {
    if (checked) {
      setForm(prev => ({ ...prev, unified: true, user: cloneAudience(prev.guest), admin: cloneAudience(prev.guest) }));
    } else {
      setForm(prev => ({ ...prev, unified: false }));
    }
  };

  const currentTab = form.unified ? "guest" : activeTab;

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm font-semibold text-gray-700">主页快捷操作入口</CardTitle>
          </div>
          <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          为不同受众配置快捷入口。跳转路径填页面名如 <code className="bg-gray-100 px-1 rounded">SubmitOrder</code>，
          或完整网址如 <code className="bg-gray-100 px-1 rounded">https://example.com</code>（新标签页打开）。
        </p>

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 cursor-pointer" onClick={() => toggleUnified(!form.unified)}>
          <Checkbox checked={!!form.unified} onCheckedChange={toggleUnified} />
          <span className="text-xs text-gray-600 select-none">
            所有用户显示同一套配置（不区分登录状态与角色）
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!form.unified && (
          <div className="flex gap-1 border-b border-gray-200 pb-0">
            {AUDIENCE_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-t-lg transition-colors -mb-px border ${
                  activeTab === tab.key
                    ? "bg-white border-gray-200 border-b-white text-orange-700 font-semibold"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <AudiencePanel
          key={currentTab}
          audience={form[currentTab]}
          onChange={val => setForm(prev => ({ ...prev, [currentTab]: val }))}
        />
      </CardContent>
    </Card>
  );
}