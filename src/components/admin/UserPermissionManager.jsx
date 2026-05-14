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
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [basePermissions, setBasePermissions] = useState([]);
  const [overridePermissions, setOverridePermissions] = useState({});
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user.assigned_role_ids && user.assigned_role_ids.length > 0) {
      setSelectedRoleIds(user.assigned_role_ids);
      updatePermissionsFromRoles(user.assigned_role_ids);
    }
    setOverridePermissions(user.permission_overrides || {});
  }, [user, allRoles]);

  const updatePermissionsFromRoles = (roleIds) => {
    let allPerms = new Set();
    roleIds.forEach(roleId => {
      const role = allRoles.find(r => r.id === roleId);
      if (role?.direct_permissions) {
        role.direct_permissions.forEach(p => allPerms.add(p));
      }
    });
    setBasePermissions(Array.from(allPerms));
  };

  const handleRoleToggle = (roleId) => {
    const newRoleIds = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter(id => id !== roleId)
      : [...selectedRoleIds, roleId];
    setSelectedRoleIds(newRoleIds);
    updatePermissionsFromRoles(newRoleIds);
  };

  const togglePermissionOverride = (permId) => {
    setOverridePermissions(prev => {
      const current = prev[permId];
      // 循环：无覆盖 -> add -> remove -> 无覆盖
      let newState;
      if (!current) {
        newState = "add";
      } else if (current === "add") {
        newState = "remove";
      } else {
        newState = undefined;
      }
      return { ...prev, [permId]: newState };
    });
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageUser', {
        action: 'update_user_permissions',
        target_user_id: user.id,
        assigned_role_ids: selectedRoleIds,
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

  // 计算最终权限（基础权限 + 添加的 - 移除的）
  const getFinalPermissions = () => {
    let perms = new Set(basePermissions);
    Object.entries(overridePermissions).forEach(([permId, action]) => {
      if (action === "add") {
        perms.add(permId);
      } else if (action === "remove") {
        perms.delete(permId);
      }
    });
    return Array.from(perms);
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

          {/* 角色选择 - 多选按钮式 */}
          <div>
            <Label className="text-xs text-gray-500 block mb-2">分配角色（可多选）</Label>
            {allRoles.length === 0 ? (
              <p className="text-xs text-gray-400">暂无可用角色</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {allRoles.map(role => {
                    const isSelected = selectedRoleIds.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        onClick={() => handleRoleToggle(role.id)}
                        className={`p-2 rounded border-2 text-left transition-colors text-sm font-medium ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                </div>
                {selectedRoleIds.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    已选 {selectedRoleIds.length} 个角色，共 {basePermissions.length} 项权限
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 权限概览 */}
          {selectedRoleIds.length > 0 && (
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
          {selectedRoleIds.length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-xs text-gray-500 font-semibold block mb-2">
                权限覆盖（仅对此用户）
              </Label>
              <p className="text-xs text-gray-400 mb-2">
                勾选状态：✓=保持该权限 ◯=移除该权限 ✚=新增该权限
              </p>
              <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200 max-h-96 overflow-y-auto">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} className="border-b last:border-b-0">
                    <button
                      className="text-xs font-medium text-gray-600 py-2 flex items-center gap-1 w-full hover:text-gray-800"
                      onClick={() => toggleCategory(category)}
                    >
                      {expandedCategories.has(category) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {category}
                    </button>
                    {expandedCategories.has(category) && (
                      <div className="pl-4 space-y-2 pb-2">
                        {perms.map(p => {
                          const isInBase = basePermissions.includes(p.id);
                          const override = overridePermissions[p.id];
                          const isChecked = override === "add" || (isInBase && override !== "remove");
                          return (
                            <div key={p.id} className="border-l-2 border-gray-300 pl-2">
                              <label className="flex items-center gap-2 cursor-pointer py-0.5 text-xs">
                                <div className="relative w-3.5 h-3.5 flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermissionOverride(p.id)}
                                    className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer"
                                  />
                                  {override === "add" && (
                                    <span className="absolute inset-0 flex items-center justify-center text-2xs font-bold text-green-600 pointer-events-none">+</span>
                                  )}
                                  {override === "remove" && (
                                    <span className="absolute inset-0 flex items-center justify-center text-lg leading-none text-red-600 pointer-events-none">−</span>
                                  )}
                                </div>
                                <span className={`text-gray-700 ${override === "add" ? "font-semibold text-green-700" : override === "remove" ? "text-red-600 line-through" : ""}`}>
                                  {p.name}
                                </span>
                                {!isInBase && override !== "add" && (
                                  <span className="text-gray-400 text-2xs">（角色不含）</span>
                                )}
                                {override === "add" && (
                                  <span className="text-green-600 text-2xs font-medium">（新增）</span>
                                )}
                              </label>
                              {p.description && (
                                <p className="text-2xs text-gray-500 ml-5 mt-0.5">{p.description}</p>
                              )}
                            </div>
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
            disabled={saving || selectedRoleIds.length === 0}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}