/**
 * FileDropzone — 通用文件拖拽/点击/粘贴上传区
 *
 * Props:
 *   onFile(file)   — 用户选择/拖入/粘贴文件时的回调，返回 File 对象（不上传）
 *   uploading      — 是否正在上传中
 *   uploaded       — 是否已上传完成
 *   label          — 已上传时的提示文字（默认"已上传，点击或拖拽可更换"）
 *   placeholder    — 未上传时的提示文字（默认"点击选择或拖拽图片至此处"）
 *   borderColor    — 未上传时的边框颜色类（默认"border-gray-200"）
 *   uploadedColor  — 已上传时的边框颜色类（默认"border-green-300 bg-green-50 text-green-700"）
 *   uploadingColor — 上传中的边框颜色类（默认"border-blue-200 bg-blue-50 text-blue-500"）
 *   accept         — input accept（默认"image/*"）
 *   pasteHint      — 粘贴区占位文字（false = 不渲染粘贴输入框）
 *   className      — 额外的容器 class
 */
import { useRef } from "react";
import { Upload, Loader2, CheckCircle } from "lucide-react";

export default function FileDropzone({
  onFile,
  uploading = false,
  uploaded = false,
  label = "已上传，点击或拖拽可更换",
  placeholder = "点击选择或拖拽图片至此处",
  borderColor = "border-gray-200",
  uploadedColor = "border-green-300 bg-green-50 text-green-700",
  uploadingColor = "border-blue-200 bg-blue-50 text-blue-500",
  accept = "image/*",
  pasteHint = "或点击此处后粘贴截图（Ctrl+V / ⌘V）",
  className = "",
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) { onFile(file); e.target.value = ""; }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith("image/"));
    if (file) onFile(file);
  };

  const handlePaste = (e) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) onFile(f); }
  };

  const stateClass = uploaded
    ? uploadedColor
    : uploading
    ? uploadingColor
    : `${borderColor} text-gray-400 hover:border-blue-300 hover:text-blue-500`;

  return (
    <div className={className}>
      {/* Drop / click zone */}
      <div
        className={`flex flex-col items-center justify-center gap-1.5 px-3 py-5 border-2 border-dashed rounded-lg text-sm transition-colors cursor-pointer ${stateClass}`}
        onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {uploaded
          ? <><CheckCircle className="w-5 h-5" /><span>{label}</span></>
          : uploading
          ? <><Loader2 className="w-5 h-5 animate-spin" /><span>上传中...</span></>
          : <><Upload className="w-5 h-5" /><span>{placeholder}</span></>}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {/* Paste input (optional) */}
      {pasteHint !== false && (
        <input
          type="text"
          readOnly
          placeholder={pasteHint}
          disabled={uploading}
          className="w-full h-9 px-3 mt-2 text-xs border border-gray-300 rounded-md bg-white text-gray-500 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
          onPaste={handlePaste}
        />
      )}
    </div>
  );
}