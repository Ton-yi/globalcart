import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Plus, Download, Copy } from "lucide-react";
import PermissionGrid from "@/components/admin/PermissionGrid.jsx";
import ImageUploader from "@/components/common/ImageUploader";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";

// 内置角色模板（与 GlobalRoleManager 保持一致）
const ALL_PERM_IDS = [];
PERMISSIONS_PRESET.forEach(cat => {
  cat.permissions.forEach(p => {
    ALL_PERM_IDS.push(p.name);
    (p.children || []).forEach(child => ALL_PERM_IDS.push(child.name));
  });
});

const BUILTIN_ROLE_TEMPLATES = [
  {
    id: '__builtin_user__',
    name: '普通用户',
    direct_permissions: [
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
    ],
    is_builtin: true,
  },
  {
    id: '__builtin_transit_manager__',
    name: '中转人',
    direct_permissions: [
      "shipping:view_transit_panel",
      "shipping:edit_transit_pool",
      "view:other_user_consolidation_pool",
    ],
    is_builtin: true,
  },
  {
    id: '__builtin_tenant_admin__',
    name: '租户管理员（全权限）',
    direct_permissions: ALL_PERM_IDS,
    is_builtin: true,
  },
];

// Build permissionsByCategory directly from PERMISSIONS_PRESET
function buildPermissionsByCategory(preset) {
  const result = {};
  preset.forEach(cat => {
    const perms = [];
    cat.permissions.forEach(p => {
      perms.push({ id: p.name, name: p.display_name, isChild: false });
      (p.children || []).forEach(child => {
        perms.push({ id: child.name, name: child.display_name, isChild: true });
      });
    });
    result[cat.category] = perms;
  });
  return result;
}

const PERMISSIONS_BY_CATEGORY = buildPermissionsByCategory(PERMISSIONS_PRESET);

export default function RoleCreationPanel({ tenantId, onRoleCreated, existingRoles = [], isPlatformAdmin = false }) {
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#3b82f6");
  const [roleImage, setRoleImage] = useState("");
  const [parentRoleId, setParentRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [globalTemplates, setGlobalTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (open && globalTemplates.length === 0) {
      setLoadingTemplates(true);
      base44.functions.invoke('manageRoles', { action: 'listGlobalTemplates', data: {} })
        .then(res => setGlobalTemplates(res.data?.templates || []))
        .catch(() => {})
        .finally(() => setLoadingTemplates(false));
    }
  }, [open]);

  const handleApplyTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setSelectedPermissions([]);
      return;
    }
    const tpl = BUILTIN_ROLE_TEMPLATES.find(t => t.id === templateId) || globalTemplates.find(t => t.id === templateId);
    if (tpl) {
      setSelectedPermissions([...(tpl.direct_permissions || [])]);
      if (!roleName) setRoleName(tpl.name + " (副本)");
      if (tpl.color) setRoleColor(tpl.color);
    }
  };

  const togglePermission = (names, forceOn) => {
    setSelectedPermissions(prev => {
      let perms = [...prev];
      names.forEach(name => {
        const shouldAdd = forceOn !== undefined ? forceOn : !perms.includes(name);
        if (shouldAdd) { if (!perms.includes(name)) perms.push(name); }
        else { perms = perms.filter(x => x !== name); }
      });
      return perms;
    });
  };



  const handleCreateRole = async () => {
    if (!roleName) {
      setMsg({ type: "error", text: "请输入角色名称" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('manageRoles', {
        action: 'create',
        data: {
          name: roleName,
          description: "",
          color: roleColor,
          parent_role_id: parentRoleId || null,
          direct_permissions: selectedPermissions,
          is_global: false,
        }
      });
      setMsg({ type: "success", text: `角色"${roleName}"创建成功` });
      setRoleName("");
      setRoleColor("#3b82f6");
      setRoleImage("");
      setParentRoleId("");
      setSelectedTemplateId("");
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
      description: "",
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

  const permissionsByCategory = PERMISSIONS_BY_CATEGORY;

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
          <ImageUploader value={roleImage} onChange={setRoleImage} label="角色图片（可选）" />

          {/* 从模板套用 */}
          <div>
            <Label className="text-xs text-gray-500 block mb-1.5">从模板套用（可选）</Label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleApplyTemplate("")}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  !selectedTemplateId
                    ? "bg-gray-100 border-gray-300 text-gray-700 font-medium"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                空白自定义
              </button>
              {/* 内置模板 */}
              {BUILTIN_ROLE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl.id)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1 ${
                    selectedTemplateId === tpl.id
                      ? "bg-gray-700 border-gray-700 text-white font-medium"
                      : "bg-gray-50 border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  {tpl.name}
                  <span className="ml-0.5 text-2xs opacity-60">内置</span>
                </button>
              ))}
              {/* 全局自定义模板 */}
              {loadingTemplates ? (
                <span className="text-xs text-gray-400 self-center">加载中...</span>
              ) : globalTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl.id)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1 ${
                    selectedTemplateId === tpl.id
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  {tpl.name}
                </button>
              ))}
            </div>
            {selectedTemplateId && (
              <p className="text-xs text-indigo-600 mt-1">已套用模板权限，可在下方继续自定义调整</p>
            )}
          </div>

          {/* 权限详细设置 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-500">权限设置</Label>
              <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                已选 {selectedPermissions.length} 项
              </span>
            </div>
            <PermissionGrid
              selected={selectedPermissions}
              onToggle={togglePermission}
              accentColor="purple"
            />
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