/**
 * GroupBuyJoinForm - 用户加入拼单的表单
 */
import { useState, useEffect, useRef } from "react";
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

// Check if a URL matches a specific template's keywords
function urlMatchesTemplate(url, template) {
  if (!url || !template) return false;
  const keywords = template.url_keywords || [];
  return keywords.some(kw => url.toLowerCase().includes(kw.toLowerCase()));
}

export default function GroupBuyJoinForm({ request, currentUser, onSuccess, onCancel, isCreateMode = false, onDataChange, templates = [], onTemplateDetected, currentTemplateId }) {
  // When joining (not creating), restrict URLs to the request's template
  const restrictTemplate = !isCreateMode && currentTemplateId
    ? templates.find(t => t.id === currentTemplateId) || null
    : null;
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
  const [urlMismatch, setUrlMismatch] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const sf = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    onDataChange?.(updated);
  };

  const handleProductUrlChange = (url) => {
    sf('product_url', url);
    if (!url) { setUrlConflict(null); setUrlMismatch(false); return; }

    const lines = url.split('\n').map(l => l.trim()).filter(l => l);

    // Join mode: validate every URL must belong to the request's template
    if (restrictTemplate) {
      const hasInvalidLine = lines.some(line => !urlMatchesTemplate(line, restrictTemplate));
      setUrlMismatch(hasInvalidLine);
      setUrlConflict(null);
      return;
    }

    const detectedTemplates = lines.map(line => detectTemplate(line, templates)).filter(Boolean);
    const uniqueTemplates = [...new Map(detectedTemplates.map(t => [t.id, t])).values()];
    
    // Check if multiple stores detected
    if (uniqueTemplates.length > 1) {
      setUrlConflict({ multiStore: true, templates: uniqueTemplates });
      return;
    }
    
    const firstDetected = uniqueTemplates[0];
    if (firstDetected) {
      if (currentTemplateId && firstDetected.id !== currentTemplateId) {
        // Conflict: URL belongs to a different store
        setUrlConflict(firstDetected);
      } else {
        // Matched current template or no template selected yet - clear conflict
        setUrlConflict(null);
        onTemplateDetected?.(firstDetected);
      }
    } else {
      // No template detected - clear conflict
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
    e.preventDefault();
    const items = e.clipboardData?.items;
    if (!items) return;
    
    // First, look for images in clipboard
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          await handleImageUpload(file);
          return;
        }
      }
    }
    
    // If no image found, check for text URL
    for (const item of items) {
      if (item.type === 'text/plain') {
        item.getAsString((text) => {
          const trimmed = text.trim();
          if (trimmed.match(/^https?:\/\//)) {
            setImageUrlInput(trimmed);
            sf('product_image_url', trimmed);
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
    if (urlMismatch) return;
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

  // Auto-focus paste input when component mounts - allows Ctrl+V anywhere
  useEffect(() => {
    const timer = setTimeout(() => {
      const pasteInput = document.querySelector('input[tabIndex="-1"][onPaste]');
      if (pasteInput) {
        pasteInput.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Re-check URL conflict when template changes
  useEffect(() => {
    if (currentTemplateId && form.product_url) {
      const lines = form.product_url.split('\n').map(l => l.trim()).filter(l => l);
      const detectedTemplates = lines.map(line => detectTemplate(line, templates)).filter(Boolean);
      const uniqueTemplates = [...new Map(detectedTemplates.map(t => [t.id, t])).values()];
      
      if (uniqueTemplates.length > 1) {
        // Still multi-store - keep warning
        setUrlConflict({ multiStore: true, templates: uniqueTemplates });
      } else if (uniqueTemplates.length === 1 && uniqueTemplates[0].id !== currentTemplateId) {
        // Single store but different from current - show conflict
        setUrlConflict(uniqueTemplates[0]);
      } else {
        // Matched or no template - clear conflict
        setUrlConflict(null);
      }
    }
  }, [currentTemplateId]);

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
        {urlMismatch && restrictTemplate && (
          <p className="mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            ⚠️ 只能添加「{restrictTemplate.name}」的商品链接，请检查输入的网址
          </p>
        )}
        {urlConflict && urlConflict.multiStore && (
          <p className="mt-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
            ⚠️ 检测到多个店铺的商品：{urlConflict.templates.map(t => t.name).join('、')}，请分开提交
          </p>
        )}
        {urlConflict && !urlConflict.multiStore && (
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
              className={`mt-1 border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <span className="text-xs text-blue-400">上传中...</span>
              ) : (
                <div className="text-xs text-gray-400">
                  <Upload className="w-3.5 h-3.5 inline mr-1" />
                  点击上传 / 拖拽 / 粘贴图片
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              {/* Hidden paste input - receives Ctrl+V / Cmd+V */}
              <input
                type="text"
                onPaste={handlePaste}
                className="opacity-0 absolute pointer-events-none"
                tabIndex={-1}
              />
            </div>
          )}
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
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !form.product_name || !form.estimated_jpy || urlMismatch}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8">
            {submitting ? '提交中...' : '确认加入'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="text-xs h-8">取消</Button>
        </div>
      )}
    </div>
  );
}