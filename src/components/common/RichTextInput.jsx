/**
 * RichTextInput — 富文本输入框（通用组件）
 * 支持：文字输入 / 图片点击上传 / 拖拽上传 / Ctrl+V 粘贴上传
 * 
 * Props:
 *   value          - string          文字内容（受控）
 *   onChange       - (text) => void  文字变更回调
 *   imageUrls      - string[]        已上传图片列表（受控）
 *   onImageUrls    - (urls) => void  图片列表变更回调
 *   onSubmit       - () => void      提交回调（Ctrl+Enter 触发）
 *   placeholder    - string          输入框占位文字
 *   rows           - number          行数，默认 3
 *   maxImages      - number          最大图片数，默认 4
 *   disabled       - boolean         是否禁用
 *   submitLoading  - boolean         提交中状态
 *   submitLabel    - string          提交按钮文字，默认"发布"
 *   className      - string          外层容器额外样式
 *   footerActions  - ReactNode       底部操作栏自定义按钮（放在发送按钮左侧）
 */
import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function RichTextInput({
  value = "",
  onChange,
  imageUrls = [],
  onImageUrls,
  onSubmit,
  placeholder = "输入内容... 可拖拽或 Ctrl+V 粘贴图片",
  rows = 3,
  maxImages = 4,
  disabled = false,
  submitLoading = false,
  submitLabel = "发布",
  className = "",
  footerActions,
}) {
  const fileRef = useRef(null);
  const dragCounter = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = async (files) => {
    const all = Array.from(files).filter(f => f && f.type?.startsWith("image/"));
    if (!all.length) return;
    const remaining = maxImages - imageUrls.length;
    if (remaining <= 0) { toast.error(`最多上传 ${maxImages} 张图片`); return; }
    const imgs = all.slice(0, remaining);
    if (all.length > remaining) toast.error(`最多还能上传 ${remaining} 张，已自动截取前 ${remaining} 张`);
    setUploading(true);
    try {
      const newUrls = [];
      for (const f of imgs) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        newUrls.push(file_url);
      }
      onImageUrls?.([...imageUrls, ...newUrls]);
    } catch {
      toast.error("图片上传失败，请重试");
    }
    setUploading(false);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) if (it.type.startsWith("image/")) files.push(it.getAsFile());
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const removeImage = (idx) => {
    onImageUrls?.(imageUrls.filter((_, i) => i !== idx));
  };

  const canSubmit = !submitLoading && !uploading && !disabled && (value.trim() || imageUrls.length > 0);

  return (
    <div
      className={`border rounded-lg p-2 transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"} ${className}`}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setDragOver(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { dragCounter.current = 0; handleDrop(e); }}
    >
      <Textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            if (canSubmit) onSubmit?.();
          }
        }}
        disabled={disabled || submitLoading}
        className="bg-white text-sm h-8 py-1"
      />

      {/* 图片预览和工具栏（紧凑模式下隐藏） */}
      {rows === 1 ? null : (
        <>
          {imageUrls.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img src={url} alt="" className="h-16 w-16 rounded object-cover border" />
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5 opacity-80 hover:opacity-100"
                    onClick={() => removeImage(idx)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || disabled || imageUrls.length >= maxImages}
          >
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ImagePlus className="w-3.5 h-3.5" />}
            {uploading ? "上传中..." : "添加图片"}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
          />

          <div className="flex items-center gap-2">
            {footerActions}
            {onSubmit && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={onSubmit}
                disabled={!canSubmit}
              >
                {submitLoading ? "发布中..." : submitLabel}
              </Button>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}