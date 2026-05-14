import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Plus, Download, X } from "lucide-react";

// 权限预设 - 包含全局角色和自定义预设
const PERMISSION_PRESETS = {
  user: {
    name: "用户",
    description: "基础用户权限",
    isGlobalRole: true,
    permissions: ["order:read", "shipping_pool:read"],
  },
  staff: {
    name: "员工",
    description: "员工权限",
    isGlobalRole: true,
    permissions: ["order:read", "order:create", "order:update", "shipping_pool:read", "shipping_pool:create", "payment:read"],
  },
  admin: {
    name: "管理员",
    description: "租户管理员权限",
    isGlobalRole: true,
    permissions: ["order:read", "order:create", "order:update", "order:delete", "shipping_pool:read", "shipping_pool:create", "shipping_pool:update", "shipping_pool:delete", "user:read", "payment:read", "payment:confirm"],
  },
  tenant_admin: {
    name: "租户管理员",
    description: "完整租户管理权限",
    isGlobalRole: true,
    permissions: ["order:read", "order:create", "order:update", "order:delete", "shipping_pool:read", "shipping_pool:create", "shipping_pool:update", "shipping_pool:delete", "user:read", "user:create", "user:update", "payment:read", "payment:confirm"],
  },
  viewer: {
    name: "查看者",
    description: "仅读取权限",
    permissions: ["order:read", "shipping_pool:read", "user:read"],
  },
  operator: {
    name: "操作员",
    description: "可创建和更新订单、发货",
    permissions: ["order:read", "order:create", "order:update", "shipping_pool:read", "shipping_pool:create", "user:read"],
  },
  custom: {
    name: "自定义",
    description: "自定义权限组合",
    permissions: [],
  },
};

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

export default function RoleCreationPanel({ tenantId, onRoleCreated, existingRoles = [], isPlatformAdmin = false }) {
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#3b82f6");
  const [roleImage, setRoleImage] = useState("");
  const [parentRoleId, setParentRoleId] = useState("");
  const [presetType, setPresetType] = useState("custom");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // 获取可用的预设（非平台管理员不显示平台相关角色）
  const getAvailablePresets = () => {
    const presets = { ...PERMISSION_PRESETS };
    if (!isPlatformAdmin) {
      delete presets.platform_admin;
    }
    return presets;
  };

  const handlePresetChange = (preset) => {
    setPresetType(preset);
    if (preset !== "custom") {
      setSelectedPermissions([...PERMISSION_PRESETS[preset].permissions]);
    }
  };

  const togglePermission = (permId) => {
    setSelectedPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setRoleImage(res.file_url);
    } catch (err) {
      setMsg({ type: "error", text: "图片上传失败" });
    }
  };

  const handleCreateRole = async () => {
    if (!roleName) {
      setMsg({ type: "error", text: "请输入角色名称" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('manageRoles', {
        action: 'create_role',
        tenant_id: tenantId,
        name: roleName,
        description: PERMISSION_PRESETS[presetType]?.description || "",
        parent_role_id: parentRoleId || null,
        direct_permissions: selectedPermissions,
        color: roleColor,
        image_url: roleImage,
      });
      setMsg({ type: "success", text: `角色"${roleName}"创建成功` });
      setRoleName("");
      setRoleColor("#3b82f6");
      setRoleImage("");
      setParentRoleId("");
      setPresetType("custom");
      setSelectedPermissions([]);
      onRoleCreated?.();
      setTimeout(() => { setOpen(false); setMsg(""); }, 1500);
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
    setSaving(false);
  };

  const handleExportRole = () => {
    const roleData = {
      name: roleName,
      description: PERMISSION_PRESETS[presetType]?.description || "",
      parent_role_id: parentRoleId || null,
      permissions: selectedPermissions,
      color: roleColor,
      image_url: roleImage,
      export_date: new Date().toISOString(),
    };
    const json = JSON.stringify(roleData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `role_${roleName || "export"}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setOpen(!open)}
        >
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />创建新角色
          </CardTitle>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          {msg && (
            <div className={`text-xs px-2 py-1.5 rounded ${msg.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
              {msg.text}
            </div>
          )}

          {/* 角色基本信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">角色名称 *</Label>
              <Input
                className="mt-0.5 h-8 text-sm"
                placeholder="如：订单专员"
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">角色颜色</Label>
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  type="color"
                  value={roleColor}
                  onChange={e => setRoleColor(e.target.value)}
                  className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-xs font-mono text-gray-500">{roleColor}</span>
              </div>
            </div>
          </div>

          {/* 角色继承 */}
          <div>
            <Label className="text-xs text-gray-500">继承于（父角色）</Label>
            <Select value={parentRoleId} onValueChange={setParentRoleId}>
              <SelectTrigger className="mt-0.5 h-8 text-sm">
                <SelectValue placeholder="无继承" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>无继承</SelectItem>
                {existingRoles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 角色图片 */}
          <div>
            <Label className="text-xs text-gray-500">角色图片（可选）</Label>
            <div className="flex items-center gap-2 mt-1">
              {roleImage && <img src={roleImage} alt="角色图片" className="h-8 w-8 rounded object-cover" />}
              <label className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                  {roleImage ? "更换图片" : "上传图片"}
                </span>
              </label>
              {roleImage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-red-400"
                  onClick={() => setRoleImage("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* 权限预设 */}
          <div>
            <Label className="text-xs text-gray-500 block mb-2">权限预设</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(getAvailablePresets()).map(([key, preset]) => {
                const isGlobalRole = preset.isGlobalRole;
                return (
                  <button
                    key={key}
                    onClick={() => handlePresetChange(key)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1 ${
                      presetType === key
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {preset.name}
                    {isGlobalRole && <span className="text-2xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">全局</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 权限详细设置 */}
          <div>
            <Label className="text-xs text-gray-500 block mb-2">权限设置</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto bg-gray-50 p-2 rounded border border-gray-200">
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
                      {perms.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(p.id)}
                            onChange={() => togglePermission(p.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300"
                          />
                          <span className="text-xs text-gray-700">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              已选 {selectedPermissions.length} 项权限
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              className="flex-1 h-8 text-sm bg-indigo-600 hover:bg-indigo-700"
              onClick={handleCreateRole}
              disabled={saving || !roleName}
            >
              <Plus className="w-3 h-3 mr-1" />{saving ? "创建中..." : "创建角色"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-sm"
              onClick={handleExportRole}
              disabled={!roleName}
            >
              <Download className="w-3 h-3 mr-1" />导出
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}