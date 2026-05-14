import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

const ALL_PERMISSIONS = [
  { id: "order:read",          name: "订单查看",   category: "订单" },
  { id: "order:create",        name: "订单创建",   category: "订单" },
  { id: "order:update",        name: "订单编辑",   category: "订单" },
  { id: "order:delete",        name: "订单删除",   category: "订单" },
  { id: "shipping_pool:read",  name: "发货池查看", category: "发货" },
  { id: "shipping_pool:create",name: "发货池创建", category: "发货" },
  { id: "shipping_pool:update",name: "发货池编辑", category: "发货" },
  { id: "shipping_pool:delete",name: "发货池删除", category: "发货" },
  { id: "user:read",           name: "用户查看",   category: "用户" },
  { id: "user:create",         name: "用户创建",   category: "用户" },
  { id: "user:update",         name: "用户编辑",   category: "用户" },
  { id: "user:delete",         name: "用户删除",   category: "用户" },
  { id: "payment:read",        name: "支付查看",   category: "支付" },
  { id: "payment:confirm",     name: "确认支付",   category: "支付" },
];

const CATEGORIES = [...new Set(ALL_PERMISSIONS.map(p => p.category))];

/**
 * Compute base permissions from a set of role IDs.
 */
function computeBasePerms(roleIds, allRoles) {
  const set = new Set();
  roleIds.forEach(id => {
    const role = allRoles.find(r => r.id === id);
    (role?.direct_permissions || []).forEach(p => set.add(p));
  });
  return set;
}

/**
 * Derive permission_overrides map from (basePerms, effectivePerms):
 *   - perm in effective but NOT in base → "add"
 *   - perm in base but NOT in effective → "remove"
 *   - otherwise omit (no override)
 */
function deriveOverrides(basePerms, effectivePerms) {
  const overrides = {};
  effectivePerms.forEach(p => { if (!basePerms.has(p)) overrides[p] = "add"; });
  basePerms.forEach(p => { if (!effectivePerms.has(p)) overrides[p] = "remove"; });
  return overrides;
}

/**
 * Apply stored permission_overrides to base perms to get effective set.
 */
function applyOverrides(basePerms, overrides) {
  const set = new Set(basePerms);
  Object.entries(overrides || {}).forEach(([p, action]) => {
    if (action === "add") set.add(p);
    else if (action === "remove") set.delete(p);
  });
  return set;
}

export default function UserPermissionManager({ user, allRoles, onClose }) {
  const [selectedRoleIds, setSelectedRoleIds] = useState(user.assigned_role_ids || []);

  // Effective permission set (what user actually has — includes overrides)
  // Initialized from stored overrides applied on top of base
  const [effectivePerms, setEffectivePerms] = useState(() => {
    const base = computeBasePerms(user.assigned_role_ids || [], allRoles);
    return applyOverrides(base, user.permission_overrides || {});
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // When role selection changes, recompute base perms and RE-APPLY existing effective perms
  // (keep manual toggles, only add new perms from new roles)
  const handleRoleToggle = (roleId) => {
    const newRoleIds = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter(id => id !== roleId)
      : [...selectedRoleIds, roleId];
    setSelectedRoleIds(newRoleIds);
    // Don't reset effectivePerms — keep manual choices
  };

  // Toggle a single permission on/off in the effective set
  const togglePerm = (permId) => {
    setEffectivePerms(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const basePerms = useMemo(
    () => computeBasePerms(selectedRoleIds, allRoles),
    [selectedRoleIds, allRoles]
  );

  // Which perms are "overridden" vs base role
  const overrides = useMemo(
    () => deriveOverrides(basePerms, effectivePerms),
    [basePerms, effectivePerms]
  );

  const hasAnyOverride = Object.keys(overrides).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageUser', {
        action: 'update_user_permissions',
        target_user_id: user.id,
        assigned_role_ids: selectedRoleIds,
        permission_overrides: overrides,
      });
      if (res.data?.error) {
        setMsg({ type: "error", text: res.data.error });
      } else {
        setMsg({ type: "success", text: "权限已更新" });
        setTimeout(() => { onClose(); }, 1200);
      }
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
    setSaving(false);
  };

  const permsByCategory = useMemo(() => {
    return CATEGORIES.map(cat => ({
      category: cat,
      perms: ALL_PERMISSIONS.filter(p => p.category === cat),
    }));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">用户权限管理</h3>
            <p className="text-xs text-gray-500 mt-0.5">{user.full_name || user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="space-y-5">
          {/* Role selection */}
          <div>
            <Label className="text-xs text-gray-500 font-semibold block mb-2">分配角色（可多选）</Label>
            {allRoles.length === 0 ? (
              <p className="text-xs text-gray-400">暂无可用角色</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allRoles.map(role => {
                  const isOn = selectedRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => handleRoleToggle(role.id)}
                      className={`px-3 py-2 rounded-lg border-2 text-left text-sm font-medium transition-colors ${
                        isOn ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Permission grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-500 font-semibold">权限设置（直接开关，不受角色限制）</Label>
              <div className="flex items-center gap-2">
                {hasAnyOverride && (
                  <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200">
                    已覆盖 {Object.keys(overrides).length} 项
                  </Badge>
                )}
                <span className="text-xs text-gray-400">{effectivePerms.size} / {ALL_PERMISSIONS.length} 已开启</span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden divide-y divide-gray-100">
              {permsByCategory.map(({ category, perms }) => (
                <div key={category}>
                  <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-600 flex items-center justify-between">
                    <span>{category}</span>
                    <span className="text-gray-400 font-normal">
                      {perms.filter(p => effectivePerms.has(p.id)).length}/{perms.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    {perms.map(p => {
                      const isOn = effectivePerms.has(p.id);
                      const inBase = basePerms.has(p.id);
                      const isOverridden = overrides[p.id] !== undefined;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePerm(p.id)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-gray-100 last:border-b-0 ${
                            isOn ? 'bg-green-50 hover:bg-green-100' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                            isOn ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
                          }`}>
                            {isOn && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </span>
                          <span className={`text-xs flex-1 ${isOn ? 'text-green-900 font-medium' : 'text-gray-500'}`}>
                            {p.name}
                          </span>
                          {isOverridden && (
                            <span className={`text-2xs font-bold px-1 rounded flex-shrink-0 ${
                              overrides[p.id] === 'add' ? 'text-blue-600 bg-blue-50' : 'text-red-500 bg-red-50'
                            }`}>
                              {overrides[p.id] === 'add' ? '＋改' : '−改'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-2xs text-gray-400">
              <span className="flex items-center gap-1"><span className="text-blue-500 font-bold">＋改</span> 超出角色新增</span>
              <span className="flex items-center gap-1"><span className="text-red-400 font-bold">−改</span> 角色有但已移除</span>
            </div>
          </div>

          {msg && (
            <div className={`text-xs px-3 py-2 rounded ${msg.type === 'success' ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>
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
            disabled={saving}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}