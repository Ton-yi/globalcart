import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ChevronDown, ChevronUp, Check, Shield, Lock } from "lucide-react";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";

// Flat map of all permission names -> display_name for lookup
const PERM_LABEL_MAP = {};
PERMISSIONS_PRESET.forEach(cat => {
  cat.permissions.forEach(p => {
    PERM_LABEL_MAP[p.name] = { label: p.display_name, category: cat.category, color: cat.color };
    (p.children || []).forEach(child => {
      PERM_LABEL_MAP[child.name] = { label: child.display_name, category: cat.category, color: cat.color };
    });
  });
});

const BUILTIN_ROLES = [
  {
    id: 'user',
    name: '普通用户',
    description: '基础用户角色，默认所有注册用户',
    permissions: [
      "order:submit_purchase_request",
      "shipping:notify_shipment",
      "shipping:direct_shipment",
      "message:send_message",
      "message:send_order_message",
      "message:send_shipping_message",
      "message:send_image",
      "payment:self_pay",
      "payment:manual_pay",
      "payment:pre_pay",
      "payment:pay_full_amount",
      "order:archive_order",
      "profile:change_display_name",
      "profile:change_avatar",
      "profile:change_auto_archive_settings",
      "view:my_orders_module",
      "addon:select_value_added_services",
      "addon:select_order_value_added_services",
      "addon:select_shipping_value_added_services",
    ]
  },
  {
    id: 'tenant_admin',
    name: '租户管理员',
    description: '租户级管理员，拥有完整租户管理权限，所有权限均开放',
    permissions: Object.keys(PERM_LABEL_MAP),
  },
];

function groupByResource(permissions) {
  return permissions.reduce((acc, p) => {
    const cat = p.resource_type || '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});
}

// Permission item (single row, supports children indented below)
function PermItem({ perm, selected, onToggle, accent, disabled, indent = false }) {
  const isOn = selected.includes(perm.name);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(perm.name)}
        className={`w-full text-left rounded-lg border-2 px-3 py-2 transition-all focus:outline-none ${
          indent ? "ml-4 w-[calc(100%-1rem)]" : ""
        } ${isOn ? accent.card : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isOn ? accent.check : "border-gray-300 bg-white"
          }`}>
            {isOn && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium leading-tight ${isOn ? "text-gray-900" : "text-gray-700"}`}>
              {perm.display_name}
            </p>
            {perm.description && (
              <p className="text-2xs text-gray-400 mt-0.5 leading-tight">{perm.description}</p>
            )}
            <code className="text-2xs text-gray-400 bg-gray-100 px-1 rounded mt-0.5 inline-block">{perm.name}</code>
          </div>
        </div>
      </button>
      {(perm.children || []).map(child => (
        <PermItem key={child.name} perm={child} selected={selected} onToggle={onToggle} accent={accent} disabled={disabled} indent />
      ))}
    </>
  );
}

// Permission grid from PERMISSIONS_PRESET (full granularity, includes children)
function PermissionGrid({ selected, onToggle, accentColor = "purple", disabled = false }) {
  const accent = {
    purple: { card: "border-purple-300 bg-purple-50 shadow-sm", check: "bg-purple-600 border-purple-600", heading: "text-purple-700 border-purple-200 bg-purple-50" },
    green:  { card: "border-green-300 bg-green-50 shadow-sm",   check: "bg-green-600 border-green-600",   heading: "text-green-700 border-green-200 bg-green-50"   },
  }[accentColor];

  // Count all permissions including children
  const countAll = (perms) => perms.reduce((n, p) => n + 1 + (p.children?.length || 0), 0);
  const countSelected = (perms) => perms.reduce((n, p) => {
    let c = selected.includes(p.name) ? 1 : 0;
    c += (p.children || []).filter(ch => selected.includes(ch.name)).length;
    return n + c;
  }, 0);

  return (
    <div className="space-y-4">
      {PERMISSIONS_PRESET.map(cat => (
        <div key={cat.category}>
          <div className={`text-xs font-semibold px-2 py-1 rounded mb-2 border inline-flex items-center gap-1.5 ${accent.heading}`}>
            <Shield className="w-3 h-3" />{cat.category}
            <span className="text-gray-400 font-normal">
              ({countSelected(cat.permissions)}/{countAll(cat.permissions)})
            </span>
          </div>
          <div className="space-y-1.5">
            {cat.permissions.map(perm => (
              <PermItem key={perm.name} perm={perm} selected={selected} onToggle={onToggle} accent={accent} disabled={disabled} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        base44.functions.invoke('manageRoles', { action: 'listRoles', data: { tenant_id_filter: null } }),
        base44.functions.invoke('managePermissions', { action: 'listPermissions', data: { tenant_id_filter: null } }),
      ]);
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
        data: { name: newPerm.name, description: newPerm.description, resource_type: newPerm.resource_type, action: newPerm.action, is_global: true },
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
        data: { name: newRole.name, description: newRole.description, is_global: true, direct_permissions: newRole.permissions },
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

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("确定删除此全局角色吗？")) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageRoles', { action: 'delete', data: { role_id: roleId } });
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

  if (loading) return <div className="text-xs text-gray-400 py-4">加载中...</div>;

  return (
    <div className="space-y-5">
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
              <Label className="text-xs text-gray-500">权限名称 *</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="如：订单查看" value={newPerm.name}
                onChange={e => setNewPerm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">资源类型 *</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="如：Order、ShippingPool" value={newPerm.resource_type}
                onChange={e => setNewPerm(p => ({ ...p, resource_type: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">操作 *</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="如：read、create、update" value={newPerm.action}
                onChange={e => setNewPerm(p => ({ ...p, action: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">说明</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="权限说明" value={newPerm.description}
                onChange={e => setNewPerm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          {permMsg && (
            <p className={`text-xs px-2 py-1 rounded ${permMsg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>{permMsg.text}</p>
          )}
          <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={handleCreatePermission}
            disabled={saving || !newPerm.name || !newPerm.resource_type || !newPerm.action}>
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
          <p className="text-xs text-gray-400 mt-1">系统内置角色不可修改，点击展开查看权限策略</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {BUILTIN_ROLES.map(role => {
            const isExpanded = expandedRole === `builtin_${role.id}`;
            // Group permissions by category
            const grouped = {};
            role.permissions.forEach(permId => {
              const info = PERM_LABEL_MAP[permId];
              if (!info) return;
              if (!grouped[info.category]) grouped[info.category] = [];
              grouped[info.category].push({ id: permId, label: info.label, color: info.color });
            });
            return (
              <div key={role.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedRole(isExpanded ? null : `builtin_${role.id}`)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{role.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                      {role.permissions.length} 项权限
                    </span>
                    <Badge className="text-xs bg-gray-200 text-gray-600">内置</Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-4 bg-white">
                    <div className="space-y-3">
                      {Object.entries(grouped).map(([category, perms]) => (
                        <div key={category}>
                          <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                            <Shield className="w-3 h-3" />{category}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {perms.map(p => (
                              <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full ${p.color}`}>
                                {p.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">角色名称 *</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="如：审计员、财务管理"
                value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">描述</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="此角色的权限描述"
                value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-600 font-semibold">分配权限</Label>
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                已选 {newRole.permissions.length} 项
              </span>
            </div>
            <PermissionGrid
              selected={newRole.permissions}
              onToggle={id => setNewRole(p => ({
                ...p,
                permissions: p.permissions.includes(id)
                  ? p.permissions.filter(x => x !== id)
                  : [...p.permissions, id]
              }))}
              accentColor="purple"
            />
          </div>

          {roleMsg && (
            <p className={`text-xs px-2 py-1 rounded ${roleMsg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>{roleMsg.text}</p>
          )}
          <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 w-full"
            onClick={handleCreateRole} disabled={saving || !newRole.name}>
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
        <CardContent className="space-y-3">
          {customRoles.length === 0 ? (
            <p className="text-xs text-gray-400">暂无自定义角色模板</p>
          ) : (
            customRoles.map(role => (
              <div key={role.id} className="border border-purple-200 rounded-lg overflow-hidden">
                {/* Role header row */}
                <div className="flex items-center justify-between px-4 py-3 bg-purple-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{role.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="text-xs text-purple-600 bg-white border border-purple-200 px-2 py-0.5 rounded-full">
                      {(role.direct_permissions || []).length} 权限
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500 hover:text-gray-700"
                      onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}>
                      {expandedRole === role.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className="text-xs ml-1">{expandedRole === role.id ? "收起" : "编辑权限"}</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteRole(role.id)} disabled={saving}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded permission grid */}
                {expandedRole === role.id && (
                  <div className="border-t border-purple-200 px-4 py-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-700">权限分配</span>
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        已开启 {(role.direct_permissions || []).length} 项
                      </span>
                    </div>
                    <PermissionGrid
                      selected={role.direct_permissions || []}
                      onToggle={(permId) => {
                        const isOn = (role.direct_permissions || []).includes(permId);
                        handleAssignPermission(role, permId, !isOn);
                      }}
                      accentColor="green"
                      disabled={saving}
                    />
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