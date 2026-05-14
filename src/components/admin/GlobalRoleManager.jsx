import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

// Built-in global roles
const BUILTIN_ROLES = [
  { id: 'user', name: '普通用户', description: '基础用户角色，具有基本操作权限' },
  { id: 'tenant_admin', name: '租户管理员', description: '租户级管理员，可管理该租户下的所有资源' },
];

export default function GlobalRoleManager() {
  const [customRoles, setCustomRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);

  const [newRole, setNewRole] = useState({ name: "", description: "", permissions: [] });
  const [newPerm, setNewPerm] = useState({ name: "", description: "", resource_type: "", action: "" });
  const [saving, setSaving] = useState(false);
  const [permMsg, setPermMsg] = useState("");
  const [roleMsg, setRoleMsg] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        base44.functions.invoke('manageRoles', {
          action: 'listRoles',
          data: { tenant_id_filter: null },
        }),
        base44.functions.invoke('managePermissions', {
          action: 'listPermissions',
          data: { tenant_id_filter: null },
        }),
      ]);
      // listRoles returns all roles; filter to only global/custom ones (tenant_id === null, not built-in)
      const allRoles = rolesRes.data?.roles || [];
      setCustomRoles(allRoles.filter(r => r.is_global === true));
      setPermissions(permsRes.data?.permissions || []);
    } catch (e) {
      setPermMsg({ type: 'error', text: e.message });
    }
    setLoading(false);
  };

  const handleCreatePermission = async () => {
    if (!newPerm.name || !newPerm.resource_type || !newPerm.action) {
      setPermMsg({ type: 'error', text: '请填写所有必填字段' });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('managePermissions', {
        action: 'create',
        data: {
          name: newPerm.name,
          description: newPerm.description,
          resource_type: newPerm.resource_type,
          action: newPerm.action,
          is_global: true,
        },
      });
      setPermMsg({ type: 'success', text: '权限创建成功' });
      setNewPerm({ name: "", description: "", resource_type: "", action: "" });
      await loadData();
      setTimeout(() => setPermMsg(""), 2000);
    } catch (e) {
      setPermMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  const handleCreateRole = async () => {
    if (!newRole.name) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageRoles', {
        action: 'create',
        data: {
          name: newRole.name,
          description: newRole.description,
          is_global: true,
          direct_permissions: newRole.permissions,
        },
      });
      if (res.data?.error) {
        setRoleMsg({ type: 'error', text: res.data.error });
      } else {
        setRoleMsg({ type: 'success', text: `全局角色"${newRole.name}"创建成功` });
        setNewRole({ name: "", description: "", permissions: [] });
        await loadData();
        setTimeout(() => setRoleMsg(""), 2000);
      }
    } catch (e) {
      setRoleMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  const togglePermissionForNewRole = (permId) => {
    setNewRole(p => ({
      ...p,
      permissions: p.permissions.includes(permId)
        ? p.permissions.filter(id => id !== permId)
        : [...p.permissions, permId]
    }));
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("确定删除此全局角色吗？")) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageRoles', {
        action: 'delete',
        data: { role_id: roleId },
      });
      if (res.data?.error) {
        setRoleMsg({ type: 'error', text: res.data.error });
      } else {
        await loadData();
        setRoleMsg({ type: 'success', text: "全局角色删除成功" });
        setTimeout(() => setRoleMsg(""), 2000);
      }
    } catch (e) {
      setRoleMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  const handleAssignPermission = async (role, permissionId, assign) => {
    setSaving(true);
    const updatedPerms = assign
      ? [...(role.direct_permissions || []), permissionId]
      : (role.direct_permissions || []).filter(id => id !== permissionId);
    try {
      await base44.functions.invoke('manageRoles', {
        action: 'update',
        data: { role_id: role.id, updates: { direct_permissions: updatedPerms } },
      });
      await loadData();
    } catch (e) {
      setRoleMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-xs text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Create Permission */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-500" />创建权限属性
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">定义全局权限属性，供角色分配使用</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">权限名称</Label>
              <Input
                className="mt-0.5 h-8 text-sm"
                placeholder="如：订单查看"
                value={newPerm.name}
                onChange={e => setNewPerm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">资源类型</Label>
              <Input
                className="mt-0.5 h-8 text-sm"
                placeholder="如：Order、ShippingPool"
                value={newPerm.resource_type}
                onChange={e => setNewPerm(p => ({ ...p, resource_type: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">操作</Label>
              <Input
                className="mt-0.5 h-8 text-sm"
                placeholder="如：read、create、update"
                value={newPerm.action}
                onChange={e => setNewPerm(p => ({ ...p, action: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">说明</Label>
              <Input
                className="mt-0.5 h-8 text-sm"
                placeholder="权限说明"
                value={newPerm.description}
                onChange={e => setNewPerm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          {permMsg && (
            <p className={`text-xs px-2 py-1 rounded ${permMsg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
              {permMsg.text}
            </p>
          )}
          <Button
            size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={handleCreatePermission}
            disabled={saving || !newPerm.name || !newPerm.resource_type || !newPerm.action}
          >
            <Plus className="w-3 h-3 mr-1" />{saving ? '创建中...' : '创建权限'}
          </Button>
        </CardContent>
      </Card>

      {/* Built-in Global Roles */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Badge className="bg-gray-100 text-gray-700 text-xs">内置</Badge>
            系统角色 ({BUILTIN_ROLES.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {BUILTIN_ROLES.map(role => (
            <div key={role.id} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{role.name}</p>
                  <p className="text-xs text-gray-500">{role.description}</p>
                </div>
                <Badge className="text-xs bg-gray-200 text-gray-700">内置</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create New Custom Global Role */}
      <Card className="border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-500" />创建全局角色
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">全局角色可被所有租户管理员选取使用</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">角色名称</Label>
            <Input
              className="mt-0.5 h-8 text-sm"
              placeholder="如：审计员、财务管理"
              value={newRole.name}
              onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">描述</Label>
            <Input
              className="mt-0.5 h-8 text-sm"
              placeholder="此角色的权限描述"
              value={newRole.description}
              onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
            />
          </div>

          {/* Permission selection for new role */}
          {permissions.length > 0 && (
            <div className="border rounded-lg p-3 bg-purple-50">
              <Label className="text-xs text-gray-600 block mb-2 font-medium">分配权限</Label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {permissions.map(perm => {
                  const isSelected = newRole.permissions.includes(perm.id);
                  return (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePermissionForNewRole(perm.id)}
                        className="w-3.5 h-3.5 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700 flex-1">{perm.name}</span>
                      <Badge className="text-xs bg-white text-gray-600 border border-gray-300">{perm.action}</Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {roleMsg && (
            <p className={`text-xs px-2 py-1 rounded ${roleMsg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
              {roleMsg.text}
            </p>
          )}
          <Button
            size="sm"
            className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
            onClick={handleCreateRole}
            disabled={saving || !newRole.name}
          >
            <Plus className="w-3 h-3 mr-1" />{saving ? '创建中...' : '创建全局角色'}
          </Button>
        </CardContent>
      </Card>

      {/* Custom Global Roles List */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Badge className="bg-purple-100 text-purple-700 text-xs">自定义</Badge>
            角色模板 ({customRoles.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customRoles.length === 0 ? (
            <p className="text-xs text-gray-400">暂无自定义角色模板</p>
          ) : (
            customRoles.map(role => (
              <div key={role.id} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-purple-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{role.name}</p>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                    >
                      {expandedRole === role.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-red-400"
                      onClick={() => handleDeleteRole(role.id)}
                      disabled={saving}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Permission list when expanded */}
                {expandedRole === role.id && (
                  <div className="border-t pt-2 mt-2 bg-white p-2 rounded space-y-1">
                    <p className="text-xs font-medium text-gray-600 mb-2">权限分配</p>
                    {permissions.length === 0 ? (
                      <p className="text-xs text-gray-400">暂无可用权限</p>
                    ) : (
                      permissions.map(perm => {
                        const hasPermission = role.direct_permissions?.includes(perm.id);
                        return (
                          <div key={perm.id} className="border-l-2 border-gray-300 pl-2">
                            <label className="flex items-center gap-2 cursor-pointer py-1">
                              <input
                                type="checkbox"
                                checked={hasPermission}
                                onChange={e => handleAssignPermission(role, perm.id, e.target.checked)}
                                disabled={saving}
                                className="w-3.5 h-3.5 rounded border-gray-300"
                              />
                              <span className="text-xs text-gray-700 flex-1">{perm.name}</span>
                              <Badge className="text-xs bg-gray-100 text-gray-600">{perm.action}</Badge>
                            </label>
                            {perm.description && (
                              <p className="text-2xs text-gray-500 ml-5 mt-0.5">{perm.description}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}