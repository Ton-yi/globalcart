/**
 * EditProfileModal — 编辑自己的个人资料
 * 头像（上传+裁剪）/ 昵称 / Handle / 个人简介（公开资料页展示）
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import AvatarEditor from "@/components/common/AvatarEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Lock } from "lucide-react";
import { toast } from "sonner";

export default function EditProfileModal({ userProfile, onClose, onSaved }) {
  const { setUser } = useAuth();
  const { can, isAdmin } = usePermissions();
  const canChangeAvatar = isAdmin || can("profile:change_avatar");
  const canChangeDisplayName = isAdmin || can("profile:change_display_name");

  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatar_url || "");
  const [displayName, setDisplayName] = useState(userProfile.display_name || userProfile.full_name || "");
  const [handle, setHandle] = useState(userProfile.handle || "");
  const [bio, setBio] = useState(userProfile.public_profile_bio || "");
  const [handleStatus, setHandleStatus] = useState(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const validateHandle = async () => {
    if (!handle || handle === userProfile.handle) { setHandleStatus(null); return; }
    setValidating(true);
    try {
      const res = await base44.functions.invoke('validateHandle', { handle: handle.toLowerCase().trim() });
      setHandleStatus(res.data?.valid ? 'valid' : 'invalid');
    } catch {
      setHandleStatus('invalid');
    }
    setValidating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 头像 + 昵称（平台用户自更新）
      const updateMe = {};
      if (canChangeAvatar) updateMe.avatar_url = avatarUrl;
      if (canChangeDisplayName) updateMe.display_name = displayName;
      if (Object.keys(updateMe).length > 0) await base44.auth.updateMe(updateMe);
      // Handle + 简介（服务端校验格式、保留词、唯一性）
      await base44.functions.invoke('updatePublicProfileSettings', {
        handle: handle ? handle.toLowerCase().trim() : undefined,
        public_profile_bio: bio,
      });
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      toast.success('资料已保存');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || '保存失败');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">编辑个人资料</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          {/* 头像 */}
          <div className="flex items-center gap-4">
            <AvatarEditor value={avatarUrl} onChange={setAvatarUrl} size={72} disabled={!canChangeAvatar} />
            <div className="flex-1">
              <Label className="text-sm font-medium">用户昵称</Label>
              <Input
                className="mt-1"
                placeholder="输入昵称"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                disabled={!canChangeDisplayName}
              />
              {!canChangeDisplayName && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Lock className="w-3 h-3" />无权更改昵称</p>
              )}
            </div>
          </div>

          {/* Handle */}
          <div>
            <Label className="text-sm font-medium">Handle（公开资料页地址）</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/u/</span>
                <Input
                  className="pl-10"
                  placeholder="myhandle"
                  value={handle}
                  onChange={e => { setHandle(e.target.value); setHandleStatus(null); }}
                  onBlur={validateHandle}
                />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={validateHandle} disabled={validating || !handle}>
                {validating ? '验证中...' : '验证'}
              </Button>
            </div>
            {handleStatus === 'valid' && <p className="text-xs text-green-600 mt-1">✓ Handle 可用</p>}
            {handleStatus === 'invalid' && <p className="text-xs text-red-600 mt-1">✗ Handle 不可用</p>}
            <p className="text-xs text-gray-400 mt-1">3-24 位小写字母和数字，必须包含至少一个字母</p>
          </div>

          {/* 简介 */}
          <div>
            <Label className="text-sm font-medium">个人简介（用于公开资料页展示）</Label>
            <Textarea
              className="mt-1"
              rows={4}
              placeholder="介绍一下自己..."
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>取消</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || handleStatus === 'invalid'}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}