import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

const ALL_PERMISSIONS = [
  { id: "order:read", name: "订单查看", category: "订单" },
  { id: "order:create", name: "订单创建", category: "订单" },
  { id: "order:update", name: "订单编辑", category: "订单" },
  { id: "order:delete", name: "订单删除", category: "订单" },
  { id: "shipping_pool:read", name: "发货池查看", category: "发货" },
  { id: "shipping_pool:create", name: "发货池创建", category: "发货" },
  { id: "shipping_pool:update", name: "发货池编辑", category: "发货" },
  { id: "shipping_pool:delete", name: "发货池删除", category: "发货" },
  { id: "user:read", name: "用户查看", category: "用户" },
  { id: "user:create", name: "用户创建", category: "用户" },
  { id: "user:update", name: "用户编辑", category: "用户" },
  { id: "user:delete", name: "用户删除", category: "用户" },
  { id: "payment:read", name: "支付管理查看", category: "支付" },
  { id: "payment:confirm", name: "确认支付", category: "支付" },
];

export default function UserPermissionManager({ user, allRoles, onClose }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [basePermissions, setBasePermissions] = useState([]);
  const [overridePermissions, setOverridePermissions] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user.assigned_role_ids && user.assigned_role_ids.length > 0) {
      const firstRoleId = user.assigned_role_ids[0];
      setSelectedRole(firstRoleId);
      const role = allRoles.find(r => r.id === firstRoleId);
      if (role?.direct_permissions) {
        setBasePermissions(role.direct_permissions);
      }
    }
    // 加载用户已有的权限覆盖
    setOverridePermissions(user.permission_overrides || {});
  }, [user, allRoles]);

  const handleRoleChange = (roleId) => {
    setSelectedRole(roleId);
    const role = allRoles.find(r => r.id === roleId);
    if (role?.direct_permissions) {
      setBasePermissions(role.direct_permissions);
    }
  };

  const togglePermissionOverride = (permId) => {
    setOverridePermissions(prev => ({
      ...prev,
      [permId]: prev[permId] ? undefined : "remove", // toggle remove状态
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageUser', {
        action: 'update_user_permissions',
        target_user_id: user.id,
        assigned_role_id: selectedRole || null,
        permission_overrides: Object.fromEntries(
          Object.entries(overridePermissions).filter(([_, v]) => v !== undefined)
        ),
      });
      setMsg({ type: "success", text: "权限已更新" });
      setTimeout(() => { onClose(); setMsg(""); }, 1500);
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
    setSaving(false);
  };

  const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // 计算最终权限（基础权限 - 覆盖移除的）
  const getFinalPermissions = () => {
    let perms = [...basePermissions];
    Object.entries(overridePermissions).forEach(([permId, action]) => {
      if (action === "remove") {
        perms = perms.filter(p => p !== permId);
      }
    });
    return perms;
  };

  const finalPerms = getFinalPermissions();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">用户权限管理</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          {/* 用户信息 */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">用户</p>
            <p className="text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
          </div>

          {/* 角色选择 */}
          <div>
            <Label className="text-xs text-gray-500 block mb-2">分配角色</Label>
            <Select value={selectedRole || ""} onValueChange={v => handleRoleChange(v === "" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="选择一个角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>无角色</SelectItem>
                {allRoles && allRoles.length > 0 && allRoles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && (
              <p className="text-xs text-gray-400 mt-1">
                此角色包含 {basePermissions.length} 项权限
              </p>
            )}
          </div>

          {/* 权限概览 */}
          {selectedRole && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-1">该用户拥有的权限：</p>
                  <div className="flex flex-wrap gap-1">
                    {finalPerms.length > 0 ? (
                      finalPerms.map(perm => {
                        const permInfo = ALL_PERMISSIONS.find(p => p.id === perm);
                        return (
                          <Badge key={perm} className="text-xs bg-blue-100 text-blue-700">
                            {permInfo?.name || perm}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-gray-500">（无权限）</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 权限覆盖设置 */}
          {selectedRole && (
            <div className="border-t pt-4">
              <Label className="text-xs text-gray-500 font-semibold block mb-2">
                权限覆盖（仅对此用户）
              </Label>
              <p className="text-xs text-gray-400 mb-2">
                在此处移除某项权限，该用户即使拥有此角色也不会有该权限
              </p>
              <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <button
                      className="text-xs font-medium text-gray-600 py-1 flex items-center gap-1 w-full"
                      onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    >
                      {expandedCategory === category ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {category}
                    </button>
                    {expandedCategory === category && (
                      <div className="pl-4 space-y-1">
                        {perms.map(p => {
                          const isInBase = basePermissions.includes(p.id);
                          const isRemoved = overridePermissions[p.id] === "remove";
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-2 cursor-pointer py-0.5 text-xs ${
                                !isInBase ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isInBase && !isRemoved}
                                onChange={() => togglePermissionOverride(p.id)}
                                disabled={!isInBase}
                                className="w-3.5 h-3.5 rounded border-gray-300 disabled:opacity-50"
                              />
                              <span className="text-gray-700">{p.name}</span>
                              {!isInBase && <span className="text-gray-400 text-2xs">（角色不含此权限）</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
            className="bg-gray-900 hover:bg-gray-800"
            onClick={handleSave}
            disabled={saving || !selectedRole}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}