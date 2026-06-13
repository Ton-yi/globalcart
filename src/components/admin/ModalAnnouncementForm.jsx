import { useState, useRef, useCallback } from "react";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

function ImageDropZone({ images, onChange }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const uploadFile = async (file) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(prev => [...prev, file_url]);
    setUploading(false);
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) await uploadFile(f);
  }, []);

  const handlePaste = useCallback(async (e) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) await uploadFile(file);
      }
    }
  }, []);

  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) await uploadFile(f);
    e.target.value = "";
  };

  const removeImage = (idx) => {
    onChange(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((url, idx) => (
            <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 py-2 text-gray-400">
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        ) : (
          <ImageIcon className="w-6 h-6" />
        )}
        <p className="text-xs text-center">拖拽图片到此处 · 粘贴截图 · 或点击上传</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-3 h-3 mr-1" />选择图片
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>
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
            <Label className="text-sm">内容（支持 Markdown，含图片语法）</Label>
            <Textarea rows={4} className="mt-1 font-mono text-sm" value={form.content} onChange={e => f("content", e.target.value)} placeholder="支持 **加粗**、*斜体*、[链接](url)、![图片](url) 等 Markdown 语法" />
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

        {/* Image uploader */}
        <div>
          <Label className="text-sm">弹窗图片（可拖拽/粘贴/上传，将在弹窗中展示）</Label>
          <div className="mt-1">
            <ImageDropZone
              images={form.image_urls}
              onChange={(updater) => setForm(p => ({ ...p, image_urls: typeof updater === "function" ? updater(p.image_urls) : updater }))}
            />
          </div>
        </div>

        {/* Flags */}
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