import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Upload, Loader2 } from "lucide-react";

export default function ImageUploader({ value, onChange, label = "图片（可选）", className = "" }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const uploadImage = async (file) => {
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      onChange(res.file_url);
    } catch (err) {
      setError("上传失败，请重试");
    }
    setUploading(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadImage(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        uploadImage(file);
        break;
      }
    }
  };

  return (
    <div className={className}>
      <Label className="text-xs text-gray-500 block mb-2">{label}</Label>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          {value ? (
            <>
              <img src={value} alt="预览" className="h-12 w-12 rounded object-cover" />
              <p className="text-xs text-gray-600 font-medium">已上传</p>
            </>
          ) : uploading ? (
            <>
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <p className="text-xs text-gray-600">上传中...</p>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-gray-400" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700">
                  拖拽图片到此 或{" "}
                  <label className="text-indigo-600 hover:underline cursor-pointer">
                    点击选择
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </p>
                <p className="text-xs text-gray-500">或使用 Ctrl+V / Cmd+V 粘贴剪切板图片</p>
              </div>
            </>
          )}
        </div>

        {/* 粘贴区域 */}
        <input
          type="text"
          onPaste={handlePaste}
          placeholder="也可粘贴在此"
          className="mt-3 w-full h-8 text-xs border border-gray-300 rounded px-2 py-1 text-gray-400 placeholder-gray-400 focus:outline-none focus:border-indigo-400"
        />
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {value && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-500">已选择图片</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-red-400 hover:text-red-600"
            onClick={() => onChange("")}
          >
            <X className="w-3 h-3 mr-1" />移除
          </Button>
        </div>
      )}
    </div>
  );
}