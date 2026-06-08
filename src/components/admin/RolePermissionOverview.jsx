import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Shield, Pencil, Trash2, X } from "lucide-react";
import ImageUploader from "@/components/common/ImageUploader";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";
import PermissionGrid from "@/components/admin/PermissionGrid.jsx";

// Build label map and categories from PERMISSIONS_PRESET
const PERMISSION_LABELS = {};
const PERMISSION_CATEGORIES = {};

PERMISSIONS_PRESET.forEach(cat => {
  const ids = [];
  cat.permissions.forEach(p => {
    PERMISSION_LABELS[p.name] = p.display_name;
    ids.push(p.name);
    (p.children || []).forEach(child => {
      PERMISSION_LABELS[child.name] = child.display_name;
      ids.push(child.name);
    });
  });
  PERMISSION_CATEGORIES[cat.category] = ids;
});

const COLOR_PRESETS = [
  "#dc2626", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899", "#6b7280"
];

export default function RolePermissionOverview({ roles = [], isPlatformAdmin = false, isTenantAdmin = false, onRoleUpdated }) {
  const [expandedRole, setExpandedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [deleting, setDeleting] = useState({});

  // Only show tenant-owned roles (backend already filters is_global: false)
  const allRolesToDisplay = roles;

  const handleEdit = (role) => {
    setEditingRole({ ...role });
  };

  const handleDelete = async (roleId, roleName) => {
    if (!window.confirm(`确定要删除角色"${roleName}"吗？`)) return;
    setDeleting(prev => ({ ...prev, [roleId]: true }));
    try {
      const payload = {
        action: 'delete',
        data: {
          role_id: roleId,
        }
      };
      console.log('[RolePermissionOverview] Deleting role:', payload);
      const res = await base44.functions.invoke('manageRoles', payload);
      console.log('[RolePermissionOverview] Delete response:', res);
      if (!res.data?.error) {
        if (onRoleUpdated) onRoleUpdated();
      } else {
        alert('删除失败: ' + res.data.error);
      }
    } catch (e) {
      console.error('[RolePermissionOverview] Delete error:', e);
      alert('删除失败: ' + e.message);
    }
    setDeleting(prev => ({ ...prev, [roleId]: false }));
  };

  if (!allRolesToDisplay || allRolesToDisplay.length === 0) {
    return (
      <Card className="mt-8 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />角色权限总览（租户自有）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 text-center py-4">暂无自定义角色</p>
        </CardContent>
        {editingRole && (
          <RoleEditModal
            role={editingRole}
            onClose={() => setEditingRole(null)}
            onSaved={() => {
              setEditingRole(null);
              if (onRoleUpdated) onRoleUpdated();
            }}
          />
        )}
      </Card>
    );
  }

  return (
    <Card className="mt-8 border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />角色权限总览（租户自有）
          </CardTitle>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{allRolesToDisplay.length} 个角色</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {allRolesToDisplay.map((role) => {
            const isExpanded = expandedRole === role.id;
            const permCount = role.direct_permissions?.length || 0;

            return (
              <div key={role.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Role header row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                  {/* Color dot / image */}
                  {role.image_url ? (
                    <img src={role.image_url} alt={role.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                      style={{ backgroundColor: role.color || "#9ca3af" }} />
                  )}

                  {/* Name + badge */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-900 truncate">{role.name}</span>
                    {role.is_predefined && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded flex-shrink-0">预定义</span>
                    )}
                  </div>

                  {/* Perm count badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    permCount > 0 ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "bg-gray-100 text-gray-400"
                  }`}>
                    {permCount} 项权限
                  </span>

                  {/* Expand button */}
                  <button
                    onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors flex-shrink-0"
                  >
                    {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" />收起</> : <><ChevronDown className="w-3.5 h-3.5" />详情</>}
                  </button>

                  {/* Action buttons */}
                  {(isTenantAdmin || isPlatformAdmin) && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => handleEdit(role)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors" title="编辑">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {(!role.is_predefined || isPlatformAdmin) && (
                        <button onClick={() => handleDelete(role.id, role.name)} disabled={deleting[role.id]}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors" title="删除">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded permissions */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                    {permCount === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-2">暂无权限分配</p>
                    ) : (
                      Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                        const granted = role.direct_permissions?.filter(p => perms.includes(p)) || [];
                        if (granted.length === 0) return null;
                        return (
                          <div key={category}>
                            <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{category}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {granted.map(perm => (
                                <span key={perm}
                                  className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-medium">
                                  {PERMISSION_LABELS[perm] || perm}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      {editingRole && (
        <RoleEditModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            if (onRoleUpdated) onRoleUpdated();
          }}
        />
      )}
    </Card>
  );
}

function RoleEditModal({ role, onClose, onSaved }) {
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color || "#dc2626");
  const [imageUrl, setImageUrl] = useState(role.image_url || "");
  const [permissions, setPermissions] = useState(role.direct_permissions || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleTogglePermission = (names, forceOn) => {
    setPermissions(prev => {
      let perms = [...prev];
      names.forEach(name => {
        const shouldAdd = forceOn !== undefined ? forceOn : !perms.includes(name);
        if (shouldAdd) { if (!perms.includes(name)) perms.push(name); }
        else { perms = perms.filter(x => x !== name); }
      });
      return perms;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setMsg({ type: "error", text: "角色名称不能为空" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        action: 'update',
        data: {
          role_id: role.id,
          updates: {
            name: name.trim(),
            color,
            image_url: imageUrl || null,
            direct_permissions: permissions,
          }
        }
      };
      console.log('[RoleEditModal] Sending payload:', payload);
      const res = await base44.functions.invoke('manageRoles', payload);
      console.log('[RoleEditModal] Response:', res);
      console.log('[RoleEditModal] Response status:', res.status);
      console.log('[RoleEditModal] Response data:', res.data);
      
      if (res.status >= 400) {
        const errorMsg = res.data?.error || res.data?.details || res.statusText || '未知错误';
        setMsg({ type: "error", text: errorMsg });
      } else if (res.data?.error) {
        setMsg({ type: "error", text: res.data.error });
      } else {
        setMsg({ type: "success", text: "角色已更新" });
        setTimeout(() => onSaved(), 1000);
      }
    } catch (e) {
      console.error('[RoleEditModal] Error:', e);
      console.error('[RoleEditModal] Error details:', e.response?.data || e.message);
      setMsg({ type: "error", text: e.response?.data?.error || e.message });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-3 border-b">
          <h3 className="font-semibold text-gray-900">编辑角色</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-3 pb-4 border-b">
            <h4 className="text-xs font-semibold text-gray-700">基本信息</h4>
            
            <div>
              <label className="text-xs text-gray-500 block mb-1">角色名称</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* 颜色选择 */}
            <div>
              <label className="text-xs text-gray-500 block mb-2">角色颜色</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      color === c ? "border-gray-900 ring-2 ring-offset-2 ring-gray-300" : "border-gray-200"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* 自定义颜色 */}
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="#dc2626"
              />
            </div>

            {/* 图片上传 */}
            <div>
              <ImageUploader
                value={imageUrl}
                onChange={setImageUrl}
                label="角色图片（可选）"
              />
            </div>
          </div>

          {/* 权限管理 */}
          <div className="space-y-2 pb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700">权限管理</h4>
              <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                已选 {permissions.length} 项
              </span>
            </div>
            <PermissionGrid
              selected={permissions}
              onToggle={handleTogglePermission}
              accentColor="blue"
            />
          </div>

          {/* 消息 */}
          {msg && (
            <div className={`text-xs px-3 py-2 rounded ${msg?.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
              {msg?.text || msg}
            </div>
          )}
        </div>

        {/* 按钮 */}
        <div className="flex gap-2 justify-end mt-5 border-t pt-4 sticky bottom-0 bg-white">
          <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}