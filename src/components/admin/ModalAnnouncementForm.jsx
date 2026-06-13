import { useState, useRef, useCallback } from "react";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

const TYPE_LABELS = { info: "一般", warning: "警告", success: "成功", urgent: "紧急" };
const AUDIENCE_LABELS = { all: "全部用户", users: "一般用户", admins: "管理员" };

const EMPTY_FORM = {
  title: "", content: "", type: "info", is_active: true,
  target_audience: "all", expires_at: "", dismissible: false,
  display_position: "modal", image_urls: [],
};

// 内容输入框 + 图片上传集成
function ContentEditor({ value, onChange, onImageUrlsChange }) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef();
  const fileInputRef = useRef();

  // 在光标位置插入文本
  const insertAtCursor = (text) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = value.slice(0, start) + text + value.slice(end);
    onChange(newVal);
    // 恢复光标
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    });
  };

  const uploadAndInsert = async (file) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    insertAtCursor(`![图片](${file_url})`);
    onImageUrlsChange(prev => [...prev, file_url]);
    setUploading(false);
  };

  const handlePaste = useCallback(async (e) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(i => i.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) await uploadAndInsert(file);
    }
  }, [value]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) await uploadAndInsert(f);
  }, [value]);

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) await uploadAndInsert(f);
    e.target.value = "";
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${dragging ? "border-blue-400 ring-2 ring-blue-200" : "border-input"}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-400 mr-1">支持 Markdown</span>
        <div className="flex-1" />
        <button
          type="button"
          title="上传图片（将插入 Markdown 图片语法）"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
          {uploading ? "上传中..." : "插入图片"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        rows={6}
        value={value}
        onChange={e => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={"支持 **加粗**、*斜体*、[链接](url) 等 Markdown 语法\n可直接粘贴截图或拖拽图片到此处自动上传插入"}
        className="w-full px-3 py-2 text-sm font-mono bg-white resize-y outline-none min-h-[140px]"
      />

      {/* Drag hint */}
      {dragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-lg pointer-events-none">
          <p className="text-blue-600 font-medium text-sm">松开以上传图片</p>
        </div>
      )}
    </div>
  );
}

export default function ModalAnnouncementForm({ editing, onSave, onCancel, saving }) {
  const [form, setForm] = useState(editing ? {
    title: editing.title,
    content: editing.content,
    type: editing.type,
    is_active: editing.is_active,
    target_audience: editing.target_audience,
    expires_at: editing.expires_at || "",
    dismissible: editing.dismissible || false,
    display_position: "modal",
    image_urls: editing.image_urls || [],
  } : EMPTY_FORM);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">{editing ? "编辑弹窗公告" : "新增弹窗公告"}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-sm">标题 *</Label>
            <Input className="mt-1" value={form.title} onChange={e => f("title", e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label className="text-sm">内容 *</Label>
            <div className="mt-1 relative">
              <ContentEditor
                value={form.content}
                onChange={v => f("content", v)}
                onImageUrlsChange={(updater) => setForm(p => ({ ...p, image_urls: typeof updater === "function" ? updater(p.image_urls) : updater }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">类型</Label>
            <Select value={form.type} onValueChange={v => f("type", v)}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">受众</Label>
            <Select value={form.target_audience} onValueChange={v => f("target_audience", v)}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">过期日期</Label>
            <Input type="date" className="mt-1" value={form.expires_at} onChange={e => f("expires_at", e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.is_active} onCheckedChange={v => f("is_active", !!v)} />
            <span className="text-sm">立即显示</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.dismissible} onCheckedChange={v => f("dismissible", !!v)} />
            <span className="text-sm">用户可确认（已知晓后不再显示）</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onSave(form)} disabled={saving || !form.title || !form.content}>
            {saving ? "保存中..." : "发布弹窗公告"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}