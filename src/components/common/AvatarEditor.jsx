/**
 * AvatarEditor — 统一的用户头像模块
 * 头像预览 + 选择图片 + 裁剪（AvatarCropModal）+ 上传
 * 用于 UserPreferences 和 EditProfileModal
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import AvatarCropModal from "@/components/common/AvatarCropModal";
import { User, Camera, Lock } from "lucide-react";

export default function AvatarEditor({ value, onChange, size = 64, disabled = false }) {
  const [cropSrc, setCropSrc] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (blob) => {
    setUploading(true);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setCropSrc(null);
    setUploading(false);
  };

  return (
    <>
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          uploading={uploading}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <div className="relative inline-block flex-shrink-0">
        <div
          className="rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {value ? (
            <img src={value} alt="头像" className="w-full h-full object-cover" />
          ) : (
            <User className="text-gray-400" style={{ width: size / 2, height: size / 2 }} />
          )}
        </div>
        {disabled ? (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        ) : (
          <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-700">
            <Camera className="w-3 h-3 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
          </label>
        )}
        {uploading && (
          <p className="absolute -bottom-5 left-0 right-0 text-center text-xs text-gray-400">上传中...</p>
        )}
      </div>
    </>
  );
}