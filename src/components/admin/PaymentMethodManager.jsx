/**
 * PaymentMethodManager - Admin UI for managing payment methods.
 * Supports: built-in providers (Alipay, etc.) and custom methods.
 * CRUD: add, edit, delete, toggle enable/disable.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp, Upload } from "lucide-react";

// Built-in supported payment providers (pre-configured integrations)
const SUPPORTED_PROVIDERS = [
  {
    key: "alipay",
    name: "支付宝",
    description: "支付宝扫码收款，支持自动回调确认",
    icon: "💳",
    color: "bg-blue-100 text-blue-700",
    secretFields: [
      { key: "ALIPAY_APP_ID", label: "App ID", placeholder: "2021xxx..." },
      { key: "ALIPAY_PRIVATE_KEY", label: "应用私钥", placeholder: "MIIEow...", multiline: true },
      { key: "ALIPAY_PUBLIC_KEY", label: "支付宝公钥", placeholder: "MIIBIj...", multiline: true },
      { key: "ALIPAY_GATEWAY_URL", label: "网关地址", placeholder: "https://openapi.alipay.com/gateway.do" },
    ],
  },
  {
    key: "wechatpay",
    name: "微信支付",
    description: "微信扫码收款（手动上传收款码）",
    icon: "💬",
    color: "bg-green-100 text-green-700",
    secretFields: [],
  },
  {
    key: "paypay",
    name: "PayPay",
    description: "日本PayPay扫码支付",
    icon: "🔴",
    color: "bg-red-100 text-red-700",
    secretFields: [],
  },
  {
    key: "bank_transfer",
    name: "银行转账",
    description: "银行账户转账",
    icon: "🏦",
    color: "bg-yellow-100 text-yellow-700",
    secretFields: [],
  },
];

const EMPTY_FORM = {
  name: "", description: "", icon: "", color: "bg-gray-100 text-gray-700",
  image_url: "", payment_note: "", provider_key: "",
};

export default function PaymentMethodManager({ initialData = [], onReload }) {
  const [methods, setMethods] = useState(initialData);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addMode, setAddMode] = useState(null); // "supported" | "custom"
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const reload = async () => {
    const r = await base44.functions.invoke('managePaymentMethod', { action: 'list' });
    setMethods(r.data?.methods || []);
    onReload?.();
  };

  const handleUploadImage = async (file, target) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (target === 'form') setForm(f => ({ ...f, image_url: file_url }));
    else setEditForm(f => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleAddSupported = (provider) => {
    setSelectedProvider(provider);
    setForm({
      ...EMPTY_FORM,
      name: provider.name,
      description: provider.description,
      icon: provider.icon,
      color: provider.color,
      provider_key: provider.key,
    });
    setAddMode("supported");
  };

  const handleAddCustom = () => {
    setSelectedProvider(null);
    setForm({ ...EMPTY_FORM });
    setAddMode("custom");
  };

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    await base44.functions.invoke('managePaymentMethod', { action: 'create', ...form });
    setAddMode(null);
    setSelectedProvider(null);
    setForm({ ...EMPTY_FORM });
    await reload();
    setSaving(false);
  };

  const handleStartEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      name: m.name, description: m.description || '', icon: m.icon || '',
      color: m.color || '', image_url: m.image_url || '', payment_note: m.payment_note || '',
    });
  };

  const handleSaveEdit = async (id) => {
    setSaving(true);
    await base44.functions.invoke('managePaymentMethod', { action: 'update', id, ...editForm });
    setEditingId(null);
    await reload();
    setSaving(false);
  };

  const handleToggle = async (id) => {
    await base44.functions.invoke('managePaymentMethod', { action: 'toggle', id });
    await reload();
  };

  const handleDelete = async (id) => {
    await base44.functions.invoke('managePaymentMethod', { action: 'delete', id });
    setConfirmDeleteId(null);
    await reload();
  };

  // Check which providers are already added
  const addedProviderKeys = new Set(methods.map(m => m.provider_key).filter(Boolean));

  return (
    <div className="space-y-4">
      {/* Existing methods list */}
      {methods.length === 0 && !showAddPanel && (
        <p className="text-xs text-gray-400 text-center py-4">暂无支付方式，点击下方添加。</p>
      )}

      <div className="space-y-2">
        {methods.map(m => (
          <div key={m.id} className={`border rounded-lg overflow-hidden ${m.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
            {editingId === m.id ? (
              <div className="p-4 bg-gray-50 space-y-3">
                <p className="text-xs font-semibold text-gray-600">编辑支付方式</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">名称</Label>
                    <Input className="mt-0.5 h-8 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">图标（emoji 或文字）</Label>
                    <Input className="mt-0.5 h-8 text-sm" value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))} placeholder="💳" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">颜色（Tailwind class）</Label>
                    <Input className="mt-0.5 h-8 text-sm" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} placeholder="bg-blue-100 text-blue-700" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">图片URL（收款码等）</Label>
                    <div className="flex gap-1 mt-0.5">
                      <Input className="h-8 text-sm flex-1" value={editForm.image_url} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
                      <label className="cursor-pointer">
                        <div className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50">
                          <Upload className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) handleUploadImage(f, 'edit'); }} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500">说明</Label>
                    <Input className="mt-0.5 h-8 text-sm" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500">付款时说明（显示给用户）</Label>
                    <Textarea rows={2} className="mt-0.5 text-sm" value={editForm.payment_note} onChange={e => setEditForm(f => ({ ...f, payment_note: e.target.value }))} placeholder="请在付款备注中填写订单号..." />
                  </div>
                </div>
                {editForm.image_url && (
                  <img src={editForm.image_url} alt="" className="h-16 rounded object-contain border border-gray-200" />
                )}
                <div className="flex gap-2">
                  <Button size="sm" className="bg-gray-900 hover:bg-gray-800 h-7 text-xs" onClick={() => handleSaveEdit(m.id)} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>取消</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${m.color || 'bg-gray-100'}`}>
                  {m.icon || '💳'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    {m.provider_key && <Badge className="text-xs bg-blue-50 text-blue-600 border-blue-100">{m.provider_key}</Badge>}
                    {!m.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已停用</Badge>}
                  </div>
                  {m.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{m.description}</p>}
                  {m.payment_note && <p className="text-xs text-blue-500 mt-0.5 truncate">说明：{m.payment_note}</p>}
                </div>
                {m.image_url && (
                  <img src={m.image_url} alt="" className="h-8 w-8 rounded object-cover border border-gray-100 flex-shrink-0" />
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleStartEdit(m)}>
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  </Button>
                  <Button size="sm" variant="ghost" className={`h-7 text-xs ${m.is_active ? 'text-gray-400' : 'text-green-600'}`}
                    onClick={() => handleToggle(m.id)}>
                    {m.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  </Button>
                  {confirmDeleteId === m.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 px-2" onClick={() => handleDelete(m.id)}>确认删除</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfirmDeleteId(null)}>取消</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => setConfirmDeleteId(m.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add panel trigger */}
      {!addMode && (
        <Button size="sm" variant="outline" className="w-full text-xs border-dashed" onClick={() => setShowAddPanel(p => !p)}>
          <Plus className="w-3.5 h-3.5 mr-1" />添加支付方式
          {showAddPanel ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
        </Button>
      )}

      {showAddPanel && !addMode && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
          {/* Already-supported providers group */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">已支援的支付方式</p>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_PROVIDERS.map(p => {
                const alreadyAdded = addedProviderKeys.has(p.key);
                return (
                  <button
                    key={p.key}
                    disabled={alreadyAdded}
                    onClick={() => handleAddSupported(p)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      alreadyAdded
                        ? 'border-gray-100 bg-white opacity-40 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${p.color}`}>{p.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.description}</p>
                    </div>
                    {alreadyAdded && <Badge className="text-[10px] bg-green-100 text-green-600 ml-auto">已添加</Badge>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom method */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">自定义支付方式</p>
            <Button size="sm" variant="outline" className="text-xs" onClick={handleAddCustom}>
              <Plus className="w-3.5 h-3.5 mr-1" />添加自定义支付方式
            </Button>
          </div>

          <Button size="sm" variant="ghost" className="text-xs text-gray-400 w-full" onClick={() => setShowAddPanel(false)}>取消</Button>
        </div>
      )}

      {/* Add Form */}
      {addMode && (
        <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              {addMode === 'supported' && selectedProvider ? `添加 ${selectedProvider.name}` : '添加自定义支付方式'}
            </p>
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setAddMode(null); setShowAddPanel(false); }}>取消</button>
          </div>

          {/* Supported provider: show info about credential requirements */}
          {addMode === 'supported' && selectedProvider && selectedProvider.secretFields.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold mb-1">⚠ 此支付方式需要配置密钥</p>
              <p>以下凭证需在服务器环境变量中配置，请前往 <strong>Dashboard → 设置 → 环境变量</strong> 填写：</p>
              <ul className="mt-1.5 space-y-0.5">
                {selectedProvider.secretFields.map(sf => (
                  <li key={sf.key} className="font-mono">• {sf.key} — {sf.label}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-amber-600">填写后重启函数生效。本页面仅保存显示配置，不存储密钥。</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">名称 *</Label>
              <Input className="mt-0.5 h-8 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="支付宝" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">图标（emoji 或文字）</Label>
              <Input className="mt-0.5 h-8 text-sm" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="💳" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">颜色（Tailwind class）</Label>
              <Input className="mt-0.5 h-8 text-sm" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="bg-blue-100 text-blue-700" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">图片（收款码）</Label>
              <div className="flex gap-1 mt-0.5">
                <Input className="h-8 text-sm flex-1" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
                <label className="cursor-pointer">
                  <div className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded bg-white hover:bg-gray-50">
                    <Upload className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files[0]; if (f) handleUploadImage(f, 'form'); }}
                    disabled={uploading} />
                </label>
              </div>
              {uploading && <p className="text-xs text-blue-500 mt-0.5">上传中...</p>}
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">支付方式说明</Label>
              <Input className="mt-0.5 h-8 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="支付宝扫码支付" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">付款时说明（显示给用户）</Label>
              <Textarea rows={2} className="mt-0.5 text-sm" value={form.payment_note}
                onChange={e => setForm(f => ({ ...f, payment_note: e.target.value }))}
                placeholder="请在付款备注中填写您的订单号，付款后请截图上传凭证" />
            </div>
          </div>

          {form.image_url && (
            <img src={form.image_url} alt="" className="h-20 rounded object-contain border border-gray-200" />
          )}

          <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-xs" onClick={handleCreate} disabled={saving || !form.name}>
            <Plus className="w-3.5 h-3.5 mr-1" />{saving ? "添加中..." : "添加支付方式"}
          </Button>
        </div>
      )}
    </div>
  );
}