import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Shield, Pencil, Trash2 } from "lucide-react";

const PERMISSION_LABELS = {
  "order:read": "订单查看",
  "order:create": "订单创建",
  "order:update": "订单编辑",
  "order:delete": "订单删除",
  "shipping_pool:read": "发货池查看",
  "shipping_pool:create": "发货池创建",
  "shipping_pool:update": "发货池编辑",
  "shipping_pool:delete": "发货池删除",
  "user:read": "用户查看",
  "user:create": "用户创建",
  "user:update": "用户编辑",
  "user:delete": "用户删除",
  "payment:read": "支付查看",
  "payment:confirm": "确认支付",
};

const PERMISSION_CATEGORIES = {
  订单: ["order:read", "order:create", "order:update", "order:delete"],
  发货: ["shipping_pool:read", "shipping_pool:create", "shipping_pool:update", "shipping_pool:delete"],
  用户: ["user:read", "user:create", "user:update", "user:delete"],
  支付: ["payment:read", "payment:confirm"],
};

const PREDEFINED_ROLES = {
  "user": { label: "普通用户", color: "bg-gray-100", priority: 1 },
  "tenant_admin": { label: "租户管理员", color: "bg-red-100", priority: 2 },
};

export default function RolePermissionOverview({ roles = [], isPlatformAdmin = false, isTenantAdmin = false, onRoleUpdated }) {
  const [expandedRole, setExpandedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [deleting, setDeleting] = useState({});

  // Only show tenant-owned roles (not predefined/global)
  const allRolesToDisplay = roles.filter(r => !r.is_global);

  const handleEdit = (role) => {
    setEditingRole(role);
  };

  const handleDelete = async (roleId, roleName) => {
    if (!window.confirm(`确定要删除角色"${roleName}"吗？`)) return;
    setDeleting(prev => ({ ...prev, [roleId]: true }));
    try {
      await base44.functions.invoke('manageRoles', {
        action: 'delete_role',
        role_id: roleId,
      });
      if (onRoleUpdated) onRoleUpdated();
    } catch (e) {
      console.error('删除角色失败:', e);
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

        function RoleEditModal({ role, onClose, onSaved }) {
        const [name, setName] = useState(role.name);
        const [saving, setSaving] = useState(false);
        const [msg, setMsg] = useState("");

        const handleSave = async () => {
        if (!name.trim()) {
        setMsg({ type: "error", text: "角色名称不能为空" });
        return;
        }
        setSaving(true);
        try {
        await base44.functions.invoke('manageRoles', {
         action: 'update_role',
         role_id: role.id,
         name: name.trim(),
        });
        setMsg({ type: "success", text: "角色已更新" });
        setTimeout(() => onSaved(), 1000);
        } catch (e) {
        setMsg({ type: "error", text: e.message });
        }
        setSaving(false);
        };

        return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-semibold text-gray-900">编辑角色</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
         </div>
         <div className="space-y-3">
           <div>
             <label className="text-xs text-gray-500 block mb-1">角色名称</label>
             <input
               type="text"
               className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
               value={name}
               onChange={e => setName(e.target.value)}
             />
           </div>
           {msg && (
             <div className={`text-xs px-3 py-2 rounded ${msg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
               {msg.text}
             </div>
           )}
         </div>
         <div className="flex gap-2 justify-end mt-5 border-t pt-4">
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

  return (
    <Card className="mt-8 border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />角色权限总览（租户自有）
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">共 {allRolesToDisplay.length} 个自定义角色</p>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">角色名称</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">权限数量</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">详细权限</th>
              {(isTenantAdmin || isPlatformAdmin) && <th className="text-right py-2 px-3 font-medium text-gray-600">操作</th>}
            </tr>
          </thead>
          <tbody>
            {allRolesToDisplay.map((role) => {
              const isExpanded = expandedRole === role.id;
              const permCount = role.direct_permissions?.length || 0;
              
              return (
                <tbody key={role.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {role.image_url ? (
                          <img src={role.image_url} alt={role.name} className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: role.color || "#9ca3af" }}
                          />
                        )}
                        <span className="font-medium text-gray-900">{role.name}</span>
                        {role.is_predefined && (
                          <span className="text-2xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">预定义</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-gray-800">{permCount}</span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />隐藏
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />查看
                          </>
                        )}
                      </button>
                    </td>
                    {(isTenantAdmin || isPlatformAdmin) && (
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                            title="编辑角色"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id, role.name)}
                            disabled={deleting[role.id]}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
                            title="删除角色"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  
                  {isExpanded && (
                    <tr className="bg-indigo-50 border-b border-gray-100">
                      <td colSpan="4" className="py-3 px-3">
                        <div className="space-y-3">
                          {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                            const categoryPerms = role.direct_permissions?.filter(p => perms.includes(p)) || [];
                            return (
                              <div key={category}>
                                <p className="text-xs font-semibold text-gray-700 mb-1.5">{category}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {perms.map(perm => {
                                    const hasPermission = categoryPerms.includes(perm);
                                    return (
                                      <div
                                        key={perm}
                                        className={`text-2xs px-2 py-1 rounded border ${
                                          hasPermission
                                            ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium"
                                            : "bg-gray-100 border-gray-200 text-gray-400"
                                        }`}
                                      >
                                        {PERMISSION_LABELS[perm]}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {(!role.direct_permissions || role.direct_permissions.length === 0) && (
                            <p className="text-gray-400 text-2xs italic">无权限分配</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}