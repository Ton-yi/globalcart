import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";

export default function TenantRoleManagerForUsers({ tenantId, tenantName }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        base44.functions.invoke('manageRoles', {
          action: 'list_tenant_roles',
          tenant_id: tenantId,
        }),
        base44.functions.invoke('managePermissions', {
          action: 'list_permissions',
          tenant_id: tenantId,
        }),
      ]);
      setRoles(rolesRes.data?.roles || []);
      setPermissions(permsRes.data?.permissions || []);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setLoading(false);
  };

  const handleCreateRole = async () => {
    if (!newRole.name) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageRoles', {
        action: 'create_role',
        tenant_id: tenantId,
        name: newRole.name,
        description: newRole.description,
      });
      if (res.data?.error) {
        setMsg({ type: 'error', text: res.data.error });
      } else {
        setMsg({ type: 'success', text: `角色"${newRole.name}"创建成功` });
        setNewRole({ name: "", description: "" });
        await loadData();
        setTimeout(() => setMsg(""), 2000);
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("确定删除此角色吗？")) return;
    setSaving(true);
    try {
      await base44.functions.invoke('manageRoles', {
        action: 'delete_role',
        role_id: roleId,
      });
      await loadData();
      setMsg({ type: 'success', text: "角色删除成功" });
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  const handleAssignPermission = async (roleId, permissionId, assign) => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageRoles', {
        action: assign ? 'add_permission' : 'remove_permission',
        role_id: roleId,
        permission_id: permissionId,
      });
      await loadData();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-xs text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Create New Role */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-500" />创建新角色
          </CardTitle>
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
          {msg && (
            <p className={`text-xs px-2 py-1 rounded ${msg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
              {msg.text}
            </p>
          )}
          <Button
            size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={handleCreateRole}
            disabled={saving || !newRole.name}
          >
            <Plus className="w-3 h-3 mr-1" />{saving ? '创建中...' : '创建角色'}
          </Button>
        </CardContent>
      </Card>

      {/* Roles List */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">现有角色 ({roles.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.length === 0 ? (
            <p className="text-xs text-gray-400">暂无角色</p>
          ) : (
            roles.map(role => (
              <div key={role.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
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
                  <div className="border-t pt-2 mt-2 bg-gray-50 p-2 rounded space-y-1">
                    <p className="text-xs font-medium text-gray-600 mb-2">权限分配</p>
                    {permissions.length === 0 ? (
                      <p className="text-xs text-gray-400">暂无可用权限</p>
                    ) : (
                      permissions.map(perm => {
                        const hasPermission = role.direct_permissions?.includes(perm.id);
                        return (
                          <label key={perm.id} className="flex items-center gap-2 cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={hasPermission}
                              onChange={e => handleAssignPermission(role.id, perm.id, e.target.checked)}
                              disabled={saving}
                              className="w-3.5 h-3.5 rounded border-gray-300"
                            />
                            <span className="text-xs text-gray-700 flex-1">{perm.name}</span>
                            <Badge className="text-xs bg-gray-100 text-gray-600">{perm.action}</Badge>
                          </label>
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