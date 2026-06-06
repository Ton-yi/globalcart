/**
 * GroupBuyJoinForm - 用户加入拼单的表单
 */
import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

// Detect template from URL using keywords
function detectTemplate(url, templates) {
  if (!url || !templates?.length) return null;
  for (const t of templates) {
    if (t.status !== 'approved' || t.is_active === false) continue;
    const keywords = t.url_keywords || [];
    if (keywords.some(kw => url.toLowerCase().includes(kw.toLowerCase()))) return t;
  }
  return null;
}

export default function GroupBuyJoinForm({ request, currentUser, onSuccess, onCancel, isCreateMode = false, onDataChange, templates = [], onTemplateDetected, currentTemplateId }) {
  const [form, setForm] = useState({
    product_url: '',
    product_name: '',
    product_description: '',
    product_image_url: '',
    estimated_jpy: '',
    user_note: '',
    custom_deadline: request?.deadline || '',
    deadline_action: 'cancel',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [urlConflict, setUrlConflict] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  const sf = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    onDataChange?.(updated);
  };

  const handleProductUrlChange = (url) => {
    sf('product_url', url);
    if (!url) { setUrlConflict(null); return; }
    const firstUrl = url.split('\n').find(l => l.trim())?.trim() || '';
    const detected = detectTemplate(firstUrl, templates);
    if (detected) {
      if (currentTemplateId && detected.id !== currentTemplateId) {
        // Conflict: URL belongs to a different store
        setUrlConflict(detected);
      } else {
        setUrlConflict(null);
        onTemplateDetected?.(detected);
      }
    } else {
      setUrlConflict(null);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    sf('product_image_url', file_url);
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          await handleImageUpload(file);
          break;
        }
      } else if (item.type === 'text/plain') {
        item.getAsString((text) => {
          if (text.trim().match(/^https?:\/\//)) {
            setImageUrlInput(text.trim());
            sf('product_image_url', text.trim());
          }
        });
        break;
      }
    }
  };

  const handleImageUrlSubmit = () => {
    if (imageUrlInput.trim()) {
      sf('product_image_url', imageUrlInput.trim());
      setImageUrlInput('');
    }
  };

  const handleSubmit = async () => {
    if (!form.product_name || !form.estimated_jpy) return;
    setSubmitting(true);
    await base44.functions.invoke('manageGroupBuy', {
      action: 'join_request',
      request_id: request.id,
      ...form,
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
    });
    setSubmitting(false);
    onSuccess?.();
  };

  const isEarlier = form.custom_deadline && request?.deadline && form.custom_deadline < request.deadline;
  const isLater   = form.custom_deadline && request?.deadline && form.custom_deadline > request.deadline;

  return (
    <div className={`${!isCreateMode ? 'border border-indigo-200 rounded-xl p-4 bg-indigo-50/20 space-y-3' : 'space-y-3'}`}>
      {!isCreateMode && <h4 className="text-sm font-semibold text-indigo-800">填写我的需求</h4>}

      <div>
        <Label className="text-xs text-gray-500">商品链接（多个链接请每行一个）</Label>
        <Textarea
          className="mt-1 text-sm"
          rows={2}
          placeholder={"https://...\nhttps://...（可多行）"}
          value={form.product_url}
          onChange={e => handleProductUrlChange(e.target.value)}
          onKeyDown={e => {
            // Allow Enter to add newline; Shift+Enter also adds newline (default textarea behavior)
            // No special handling needed — just prevent form submission on Enter
            if (e.key === 'Enter' && !e.shiftKey) e.stopPropagation();
          }}
        />
        {urlConflict && (
          <p className="mt-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
            ⚠️ 该链接属于「{urlConflict.name}」，与当前拼单店铺不同，请分开提交
          </p>
        )}
        {!urlConflict && form.product_url && isCreateMode && !currentTemplateId && (
          (() => {
            const firstUrl = form.product_url.split('\n').find(l => l.trim());
            const det = firstUrl ? detectTemplate(firstUrl.trim(), templates) : null;
            return det ? (
              <p className="mt-1 text-xs text-green-600">✓ 已识别店铺：{det.name}</p>
            ) : null;
          })()
        )}
      </div>

      <div>
        <Label className="text-xs text-gray-500">订单名称 *</Label>
        <Input className="mt-1 h-8 text-sm" placeholder="订单名称" required value={form.product_name}
          onChange={e => sf('product_name', e.target.value)} />
      </div>

      <div>
        <Label className="text-xs text-gray-500">商品描述/规格</Label>
        <Textarea className="mt-1 text-sm" rows={2} placeholder="颜色、尺码、数量..." value={form.product_description}
          onChange={e => sf('product_description', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">日元金额 (JPY) *</Label>
          <Input className="mt-1 h-8 text-sm" placeholder="0"
            value={form.estimated_jpy} onChange={e => sf('estimated_jpy', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">商品图片（可选）</Label>
          {form.product_image_url ? (
            <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-md p-2 bg-gray-50">
              <img src={form.product_image_url} alt="" className="h-10 w-10 object-cover rounded" />
              <span className="text-xs text-green-600 truncate flex-1">已上传</span>
              <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => sf('product_image_url', '')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              className={`mt-1 border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors outline-none focus:border-indigo-400 ${
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
              }`}
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onClick={() => document.getElementById('gb-img-input')?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('gb-img-input')?.click();
                }
              }}
            >
              {uploading ? (
                <span className="text-xs text-blue-400">上传中...</span>
              ) : (
                <div className="text-xs text-gray-400">
                  <Upload className="w-3.5 h-3.5 inline mr-1" />
                  点击上传 / 拖拽 / 粘贴
                </div>
              )}
            </div>
          )}
          <input id="gb-img-input" type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files[0]; if (f) handleImageUpload(f); }} />
          {!form.product_image_url && (
            <div className="mt-2 flex gap-2">
              <Input
                className="h-8 text-xs flex-1"
                placeholder="或输入图片 URL..."
                value={imageUrlInput}
                onChange={e => setImageUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImageUrlSubmit()}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleImageUrlSubmit}>使用 URL</Button>
            </div>
          )}
        </div>
      </div>

      {/* Custom deadline */}
      <div>
        <Label className="text-xs text-gray-500">我的截止日期（可选，默认与申请一致）</Label>
        <Input type="date" className="mt-1 h-8 text-sm" value={form.custom_deadline}
          onChange={e => sf('custom_deadline', e.target.value)} />
        {isEarlier && (
          <div className="mt-1 space-y-1">
            <p className="text-xs text-orange-500">比申请截止日早，到期时如何处理？</p>
            <Select value={form.deadline_action} onValueChange={v => sf('deadline_action', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cancel">退出拼单（取消）</SelectItem>
                <SelectItem value="extend">延后至申请截止日继续参团</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isLater && (
          <p className="text-xs text-blue-500 mt-1">比申请截止日晚，将在原截止日后更新期限，继续参团</p>
        )}
      </div>

      <div>
        <Label className="text-xs text-gray-500">备注</Label>
        <Textarea className="mt-1 text-sm" rows={1} value={form.user_note}
          onChange={e => sf('user_note', e.target.value)} placeholder="特殊要求..." />
      </div>

      {!isCreateMode && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !form.product_name || !form.estimated_jpy}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8">
            {submitting ? '提交中...' : '确认加入'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="text-xs h-8">取消</Button>
        </div>
      )}
    </div>
  );
}