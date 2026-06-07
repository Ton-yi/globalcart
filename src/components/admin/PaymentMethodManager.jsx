/**
 * PaymentMethodManager
 * 分两区块：
 *  - 自动认证支付方式（provider_key 存在，目前仅支付宝，内嵌密钥配置）
 *  - 手动认证支付方式（图片凭证，任何自定义方式）
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, CheckCircle, XCircle, Upload,
  ChevronDown, ChevronUp, Eye, EyeOff, Save, AlertCircle, Zap, ImageIcon
} from "lucide-react";

const CURRENCIES = ["JPY", "CNY", "USD", "TWD", "HKD", "EUR", "SGD"];

const ALIPAY_KEY_FIELDS = [
  { key: "alipay_key_app_id", label: "App ID", placeholder: "2021xxxxxxxxxxxxx", hint: "支付宝开放平台应用 App ID", multiline: false, secret: false },
  { key: "alipay_key_private_key", label: "应用私钥（RSA2 PKCS8）", placeholder: "MIIEvAIBADANBgkqhkiG9w0BAQEFAASC...", hint: "PKCS8 格式，勿含 -----BEGIN/END----- 行", multiline: true, secret: true },
  { key: "alipay_key_public_key", label: "支付宝公钥", placeholder: "MIIBIjANBgkqhkiG9w0BAQEFAAOC...", hint: "从支付宝开放平台获取，用于验证回调签名", multiline: true, secret: false },
  { key: "alipay_key_gateway_url", label: "网关地址", placeholder: "https://openapi.alipay.com/gateway.do", hint: "生产环境留空使用默认值；沙箱: https://openapi-sandbox.dl.alipaydev.com/gateway.do", multiline: false, secret: false },
];

const EMPTY_MANUAL_FORM = {
  name: "", description: "", icon: "", color: "bg-gray-100 text-gray-700",
  image_url: "", payment_note: "", provider_key: "", payment_currency: "JPY",
};

// ── Alipay Keys inline form ────────────────────────────────────────────────
function AlipayKeysForm({ existingSettings, existingIds, onSaved }) {
  const [settings, setSettings] = useState(() => {
    const m = {};
    existingSettings.forEach(s => { m[s.key] = s.value; });
    return m;
  });
  const [ids, setIds] = useState(existingIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(ALIPAY_KEY_FIELDS.map(async (field) => {
      const val = settings[field.key] ?? '';
      if (ids[field.key]) {
        await tenantEntity.update('SiteSettings', ids[field.key], { value: val });
      } else {
        const created = await tenantEntity.create('SiteSettings', {
          key: field.key, value: val, description: field.label, category: 'payment',
        });
        setIds(prev => ({ ...prev, [field.key]: created.id }));
      }
    }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved?.(); }, 1500);
  };

  const isConfigured = !!settings['alipay_key_app_id'] && !!settings['alipay_key_private_key'];

  return (
    <div className="mt-3 border border-blue-200 rounded-lg p-3 bg-blue-50/40 space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-blue-800">支付宝密钥配置</p>
        {isConfigured ? (
          <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 gap-1">
            <CheckCircle className="w-2.5 h-2.5" />已配置
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 gap-1">
            <AlertCircle className="w-2.5 h-2.5" />未配置（使用平台默认）
          </Badge>
        )}
      </div>
      <div className="space-y-2.5">
        {ALIPAY_KEY_FIELDS.map(field => (
          <div key={field.key}>
            <div className="flex items-center justify-between mb-0.5">
              <Label className="text-xs text-gray-600">{field.label}</Label>
              {field.secret && (
                <button type="button" className="text-xs text-gray-400 flex items-center gap-0.5"
                  onClick={() => setShowSecrets(p => ({ ...p, [field.key]: !p[field.key] }))}>
                  {showSecrets[field.key] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showSecrets[field.key] ? '隐藏' : '显示'}
                </button>
              )}
            </div>
            {field.multiline ? (
              <Textarea rows={2} className="text-xs font-mono" placeholder={field.placeholder}
                value={settings[field.key] || ''}
                onChange={e => setSettings(p => ({ ...p, [field.key]: e.target.value }))}
                style={field.secret && !showSecrets[field.key] ? { WebkitTextSecurity: 'disc', fontFamily: 'monospace' } : {}} />
            ) : (
              <Input className="h-7 text-xs font-mono" placeholder={field.placeholder}
                type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                value={settings[field.key] || ''}
                onChange={e => setSettings(p => ({ ...p, [field.key]: e.target.value }))} />
            )}
            <p className="text-[10px] text-gray-400 mt-0.5">{field.hint}</p>
          </div>
        ))}
      </div>
      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={handleSave} disabled={saving}>
        <Save className="w-3 h-3 mr-1" />{saving ? '保存中...' : saved ? '已保存 ✓' : '保存密钥'}
      </Button>
    </div>
  );
}

// ── Method row (display/edit) ──────────────────────────────────────────────
function MethodRow({ m, alipayKeySettings, alipayKeyIds, onEdit, onToggle, onDelete, onAlipayKeySaved }) {
  const [showAlipayKeys, setShowAlipayKeys] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${m.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${m.color || 'bg-gray-100'}`}>
          {m.icon || '💳'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{m.name}</span>
            {m.provider_key === 'alipay' && (
              <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-100 gap-1">
                <Zap className="w-2.5 h-2.5" />自动回调
              </Badge>
            )}
            {!m.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已停用</Badge>}
          </div>
          {m.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{m.description}</p>}
          {m.payment_note && <p className="text-xs text-blue-500 mt-0.5 truncate">说明：{m.payment_note}</p>}
          {m.payment_currency && m.payment_currency !== 'JPY' && (
            <Badge className="text-[10px] bg-orange-50 text-orange-600 border-orange-100 mt-0.5">付款币种：{m.payment_currency}</Badge>
          )}
        </div>
        {m.image_url && (
          <img src={m.image_url} alt="" className="h-8 w-8 rounded object-cover border border-gray-100 flex-shrink-0" />
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {m.provider_key === 'alipay' && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-500 px-2"
              onClick={() => setShowAlipayKeys(v => !v)}>
              密钥{showAlipayKeys ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(m)}>
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </Button>
          <Button size="sm" variant="ghost" className={`h-7 text-xs ${m.is_active ? 'text-gray-400' : 'text-green-600'}`}
            onClick={() => onToggle(m.id)}>
            {m.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          </Button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 px-2" onClick={() => onDelete(m.id)}>确认</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfirmDelete(false)}>取消</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {/* Alipay keys inline panel */}
      {m.provider_key === 'alipay' && showAlipayKeys && (
        <div className="px-3 pb-3">
          <AlipayKeysForm
            existingSettings={alipayKeySettings}
            existingIds={alipayKeyIds}
            onSaved={onAlipayKeySaved}
          />
        </div>
      )}
    </div>
  );
}

// ── Edit form (shared) ─────────────────────────────────────────────────────
function EditForm({ form, onChange, onSave, onCancel, saving, onUpload, uploading }) {
  return (
    <div className="p-4 bg-gray-50 space-y-3 border rounded-lg">
      <p className="text-xs font-semibold text-gray-600">编辑支付方式</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">名称</Label>
          <Input className="mt-0.5 h-8 text-sm" value={form.name} onChange={e => onChange('name', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">图标（emoji）</Label>
          <Input className="mt-0.5 h-8 text-sm" value={form.icon} onChange={e => onChange('icon', e.target.value)} placeholder="💳" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">颜色（Tailwind class）</Label>
          <Input className="mt-0.5 h-8 text-sm" value={form.color} onChange={e => onChange('color', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">图片（收款码）</Label>
          <div className="flex gap-1 mt-0.5">
            <Input className="h-8 text-sm flex-1" value={form.image_url} onChange={e => onChange('image_url', e.target.value)} placeholder="https://..." />
            <label className="cursor-pointer">
              <div className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50">
                <Upload className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) onUpload(f); }} disabled={uploading} />
            </label>
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-500">支付货币</Label>
          <select className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={form.payment_currency || 'JPY'} onChange={e => onChange('payment_currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-gray-500">说明</Label>
          <Input className="mt-0.5 h-8 text-sm" value={form.description} onChange={e => onChange('description', e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-gray-500">付款时说明（显示给用户）</Label>
          <Textarea rows={2} className="mt-0.5 text-sm" value={form.payment_note}
            onChange={e => onChange('payment_note', e.target.value)} placeholder="请在付款备注中填写订单号..." />
        </div>
      </div>
      {form.image_url && <img src={form.image_url} alt="" className="h-16 rounded object-contain border border-gray-200" />}
      <div className="flex gap-2">
        <Button size="sm" className="bg-gray-900 hover:bg-gray-800 h-7 text-xs" onClick={onSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PaymentMethodManager({ onReload }) {
  const [methods, setMethods] = useState([]);
  const [alipayKeySettings, setAlipayKeySettings] = useState([]);
  const [alipayKeyIds, setAlipayKeyIds] = useState({});
  const [loading, setLoading] = useState(true);

  // Add flow
  const [showAutoAdd, setShowAutoAdd] = useState(false); // adding alipay
  const [showManualAdd, setShowManualAdd] = useState(false); // adding manual
  const [manualForm, setManualForm] = useState({ ...EMPTY_MANUAL_FORM });

  // Edit flow
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [methodsRes, settingsRes] = await Promise.all([
      base44.functions.invoke('managePaymentMethod', { action: 'list' }),
      base44.functions.invoke('getAdminSettingsPageData', {}),
    ]);
    setMethods(methodsRes.data?.methods || []);

    const allSettings = settingsRes.data?.settings || [];
    const keySettings = allSettings.filter(s => s.key.startsWith('alipay_key_'));
    const ids = {};
    keySettings.forEach(s => { ids[s.key] = s.id; });
    setAlipayKeySettings(keySettings);
    setAlipayKeyIds(ids);

    setLoading(false);
    onReload?.();
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line

  const handleUpload = async (file, target) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (target === 'manual') setManualForm(f => ({ ...f, image_url: file_url }));
    else setEditForm(f => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleAddAlipay = async () => {
    setSaving(true);
    await base44.functions.invoke('managePaymentMethod', {
      action: 'create',
      name: '支付宝',
      description: '支付宝扫码收款，自动回调确认',
      icon: '💳',
      color: 'bg-blue-100 text-blue-700',
      provider_key: 'alipay',
      payment_currency: 'CNY',
      payment_note: '',
      image_url: '',
    });
    setShowAutoAdd(false);
    await reload();
    setSaving(false);
  };

  const handleAddManual = async () => {
    if (!manualForm.name) return;
    setSaving(true);
    await base44.functions.invoke('managePaymentMethod', { action: 'create', ...manualForm });
    setManualForm({ ...EMPTY_MANUAL_FORM });
    setShowManualAdd(false);
    await reload();
    setSaving(false);
  };

  const handleEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      name: m.name, description: m.description || '', icon: m.icon || '',
      color: m.color || '', image_url: m.image_url || '',
      payment_note: m.payment_note || '', payment_currency: m.payment_currency || 'JPY',
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
    await reload();
  };

  const autoMethods = methods.filter(m => m.provider_key === 'alipay');
  const manualMethods = methods.filter(m => !m.provider_key);
  const alipayAlreadyAdded = autoMethods.length > 0;

  if (loading) return <p className="text-xs text-gray-400 text-center py-4">加载中...</p>;

  return (
    <div className="space-y-5">

      {/* ── 自动认证支付方式 ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          <p className="text-xs font-semibold text-gray-700">自动认证支付方式</p>
          <span className="text-xs text-gray-400">付款后系统自动确认，无需手动审核</span>
        </div>

        {autoMethods.map(m => (
          editingId === m.id ? (
            <EditForm key={m.id}
              form={editForm}
              onChange={(k, v) => setEditForm(f => ({ ...f, [k]: v }))}
              onSave={() => handleSaveEdit(m.id)}
              onCancel={() => setEditingId(null)}
              saving={saving}
              onUpload={file => handleUpload(file, 'edit')}
              uploading={uploading}
            />
          ) : (
            <MethodRow key={m.id} m={m}
              alipayKeySettings={alipayKeySettings}
              alipayKeyIds={alipayKeyIds}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onAlipayKeySaved={reload}
            />
          )
        ))}

        {/* Add Alipay */}
        {!alipayAlreadyAdded && !showAutoAdd && (
          <button
            onClick={() => setShowAutoAdd(true)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/30 hover:bg-blue-50 text-left transition-colors"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-blue-100 text-blue-700">💳</span>
            <div>
              <p className="text-xs font-medium text-blue-800">添加支付宝（自动回调）</p>
              <p className="text-xs text-blue-400">支持付款完成后自动确认订单状态</p>
            </div>
            <Plus className="w-4 h-4 text-blue-400 ml-auto" />
          </button>
        )}

        {/* Alipay add panel with inline key config */}
        {!alipayAlreadyAdded && showAutoAdd && (
          <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">添加支付宝自动支付</p>
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowAutoAdd(false)}>取消</button>
            </div>
            <p className="text-xs text-gray-500">
              支付宝自动支付需要配置 API 密钥，用于生成付款链接和验证回调。
              留空则使用平台级环境变量（若平台已配置则可直接添加）。
            </p>
            <AlipayKeysForm
              existingSettings={alipayKeySettings}
              existingIds={alipayKeyIds}
              onSaved={() => {}}
            />
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs" onClick={handleAddAlipay} disabled={saving}>
              <Plus className="w-3.5 h-3.5 mr-1" />{saving ? "添加中..." : "确认添加支付宝"}
            </Button>
          </div>
        )}

        {alipayAlreadyAdded && (
          <p className="text-xs text-gray-400">点击支付宝行的「密钥」按钮可查看/修改 API 密钥配置。</p>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* ── 手动认证支付方式 ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-semibold text-gray-700">手动认证支付方式</p>
          <span className="text-xs text-gray-400">用户上传付款凭证，管理员手动审核</span>
        </div>

        {manualMethods.map(m => (
          editingId === m.id ? (
            <EditForm key={m.id}
              form={editForm}
              onChange={(k, v) => setEditForm(f => ({ ...f, [k]: v }))}
              onSave={() => handleSaveEdit(m.id)}
              onCancel={() => setEditingId(null)}
              saving={saving}
              onUpload={file => handleUpload(file, 'edit')}
              uploading={uploading}
            />
          ) : (
            <MethodRow key={m.id} m={m}
              alipayKeySettings={[]}
              alipayKeyIds={{}}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onAlipayKeySaved={() => {}}
            />
          )
        ))}

        {/* Add manual */}
        {!showManualAdd ? (
          <Button size="sm" variant="outline" className="w-full text-xs border-dashed" onClick={() => setShowManualAdd(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />添加手动支付方式
          </Button>
        ) : (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">添加手动支付方式</p>
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setShowManualAdd(false); setManualForm({ ...EMPTY_MANUAL_FORM }); }}>取消</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">名称 *</Label>
                <Input className="mt-0.5 h-8 text-sm" value={manualForm.name}
                  onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="微信支付" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">图标（emoji）</Label>
                <Input className="mt-0.5 h-8 text-sm" value={manualForm.icon}
                  onChange={e => setManualForm(f => ({ ...f, icon: e.target.value }))} placeholder="💬" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">颜色（Tailwind class）</Label>
                <Input className="mt-0.5 h-8 text-sm" value={manualForm.color}
                  onChange={e => setManualForm(f => ({ ...f, color: e.target.value }))} placeholder="bg-green-100 text-green-700" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">图片（收款码）</Label>
                <div className="flex gap-1 mt-0.5">
                  <Input className="h-8 text-sm flex-1" value={manualForm.image_url}
                    onChange={e => setManualForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
                  <label className="cursor-pointer">
                    <div className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded bg-white hover:bg-gray-50">
                      <Upload className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files[0]; if (f) handleUpload(f, 'manual'); }}
                      disabled={uploading} />
                  </label>
                </div>
                {uploading && <p className="text-xs text-blue-500 mt-0.5">上传中...</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-500">支付货币</Label>
                <select className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={manualForm.payment_currency} onChange={e => setManualForm(f => ({ ...f, payment_currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500">说明</Label>
                <Input className="mt-0.5 h-8 text-sm" value={manualForm.description}
                  onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))} placeholder="微信扫码支付" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-500">付款时说明（显示给用户）</Label>
                <Textarea rows={2} className="mt-0.5 text-sm" value={manualForm.payment_note}
                  onChange={e => setManualForm(f => ({ ...f, payment_note: e.target.value }))}
                  placeholder="请扫码付款，付款后截图上传凭证，备注订单号" />
              </div>
            </div>
            {manualForm.image_url && (
              <img src={manualForm.image_url} alt="" className="h-20 rounded object-contain border border-gray-200" />
            )}
            <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-xs" onClick={handleAddManual} disabled={saving || !manualForm.name}>
              <Plus className="w-3.5 h-3.5 mr-1" />{saving ? "添加中..." : "添加"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}