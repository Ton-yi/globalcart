import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function UserEditModal({ user, isPlatformAdmin, onClose, onSaved }) {
  const [role, setRole] = useState(user.role || "user");
  const [isActive, setIsActive] = useState(user.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invoke = (action, extra = {}) =>
    base44.functions.invoke('manageUser', { action, target_user_id: user.id, ...extra });

  const handleSave = async () => {
    setSaving(true);
    await invoke('update_role', { role });
    await invoke('toggle_active', { is_active: isActive });
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await invoke('delete');
    setDeleting(false);
    onSaved();
  };

  const roleOptions = isPlatformAdmin
    ? [
        { value: "platform_admin", label: "平台管理员" },
        { value: "tenant_admin", label: "租户管理员" },
        { value: "admin", label: "管理员" },
        { value: "staff", label: "员工" },
        { value: "user", label: "普通用户" },
      ]
    : [
        { value: "admin", label: "管理员" },
        { value: "staff", label: "员工" },
        { value: "user", label: "普通用户" },
      ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{user.full_name || user.email}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Role */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />角色权限
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">账号状态</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsActive(true)}
                className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${isActive ? 'border-green-500 bg-green-50 text-green-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                ✓ 正常启用
              </button>
              <button
                onClick={() => setIsActive(false)}
                className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${!isActive ? 'border-red-400 bg-red-50 text-red-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                ✗ 停用账号
              </button>
            </div>
          </div>

          {/* Delete zone */}
          <div className="border-t pt-3">
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs w-full"
                onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />删除用户
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-600 text-center">确认永久删除该用户？此操作不可撤销。</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmDelete(false)}>取消</Button>
                  <Button size="sm" className="flex-1 text-xs bg-red-600 hover:bg-red-700"
                    onClick={handleDelete} disabled={deleting}>
                    {deleting ? "删除中..." : "确认删除"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}