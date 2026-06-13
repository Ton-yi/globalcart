import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Zap } from "lucide-react";

// Lucide 图标选项
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

const ROLE_OPTIONS = [
  { value: "all", label: "所有用户" },
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
  { value: "staff", label: "员工" },
];

const DEFAULT_ACTION = {
  id: "", title: "", icon: "Package", emoji: "", color: "bg-blue-500", path: "", visible_to: "all",
};

function generateId() {
  return `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// 判断当前图标字段是否为 emoji 模式
function isEmojiMode(icon) {
  return !icon || icon === "emoji" || (icon.length <= 4 && !/^[A-Z]/.test(icon));
}

export default function QuickActionsManager({ settings, onReload }) {
  const [actions, setActions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const setting = (settings || []).find(s => s.key === "home_quick_actions");
    if (setting?.value) {
      try { setActions(JSON.parse(setting.value)); } catch { setActions([]); }
    } else {
      setActions([]);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const existing = (settings || []).find(s => s.key === "home_quick_actions");
    const value = JSON.stringify(actions);
    if (existing?.id) {
      await tenantEntity.update("SiteSettings", existing.id, { value });
    } else {
      await tenantEntity.create("SiteSettings", {
        key: "home_quick_actions", value,
        description: "主页快捷操作入口配置（JSON）", category: "general",
      });
    }
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addAction = () => setActions(prev => [...prev, { ...DEFAULT_ACTION, id: generateId() }]);
  const updateAction = (idx, field, val) => setActions(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  const removeAction = (idx) => setActions(prev => prev.filter((_, i) => i !== idx));
  const moveAction = (idx, dir) => {
    setActions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

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
        <p className="text-xs text-gray-400 mt-1">配置主页快捷入口。图标可选 Lucide 图标或直接输入 Emoji（如 🚀 📦 🎁）。</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-lg">
            暂无快捷操作，点击下方「新增」按钮添加
          </div>
        )}

        {actions.map((action, idx) => {
          const emojiMode = isEmojiMode(action.icon);
          const previewIcon = emojiMode ? (action.emoji || action.icon || "❓") : null;

          return (
            <div key={action.id || idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
              <div className="flex items-start gap-2">
                {/* 排序 */}
                <div className="flex flex-col gap-0.5 mt-1">
                  <button onClick={() => moveAction(idx, -1)} disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▲</button>
                  <button onClick={() => moveAction(idx, 1)} disabled={idx === actions.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▼</button>
                </div>

                {/* 预览 */}
                <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 ${action.color || 'bg-gray-400'}`}>
                  {emojiMode
                    ? <span className="text-lg leading-none">{previewIcon}</span>
                    : <span className="text-white text-xs font-bold">{action.icon?.slice(0, 2)}</span>
                  }
                </div>

                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">入口标题</Label>
                    <Input className="h-7 text-xs mt-0.5" value={action.title}
                      onChange={e => updateAction(idx, "title", e.target.value)} placeholder="如：提交订单" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">跳转路径</Label>
                    <Input className="h-7 text-xs mt-0.5 font-mono" value={action.path}
                      onChange={e => updateAction(idx, "path", e.target.value)} placeholder="如：SubmitOrder" />
                  </div>

                  {/* 图标选择 */}
                  <div>
                    <Label className="text-xs text-gray-500">图标类型</Label>
                    <Select
                      value={emojiMode ? "emoji" : action.icon}
                      onValueChange={v => {
                        if (v === "emoji") {
                          updateAction(idx, "icon", "emoji");
                        } else {
                          updateAction(idx, "icon", v);
                          updateAction(idx, "emoji", "");
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

                  {/* Emoji 输入框（仅 emoji 模式显示） */}
                  {emojiMode ? (
                    <div>
                      <Label className="text-xs text-gray-500">Emoji 图标</Label>
                      <Input className="h-7 text-sm mt-0.5 text-center" value={action.emoji || ""}
                        onChange={e => updateAction(idx, "emoji", e.target.value)}
                        placeholder="🚀" maxLength={4} />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs text-gray-500">颜色</Label>
                      <Select value={action.color} onValueChange={v => updateAction(idx, "color", v)}>
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

                  {/* Emoji 模式下也能选颜色（作为背景） */}
                  {emojiMode && (
                    <div>
                      <Label className="text-xs text-gray-500">背景颜色</Label>
                      <Select value={action.color} onValueChange={v => updateAction(idx, "color", v)}>
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

                  <div>
                    <Label className="text-xs text-gray-500">可见角色</Label>
                    <Select value={action.visible_to || "all"} onValueChange={v => updateAction(idx, "visible_to", v)}>
                      <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 flex-shrink-0 mt-1"
                  onClick={() => removeAction(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        <Button size="sm" variant="outline" onClick={addAction} className="w-full h-8 text-xs border-dashed">
          <Plus className="w-3.5 h-3.5 mr-1" />新增快捷操作
        </Button>
      </CardContent>
    </Card>
  );
}