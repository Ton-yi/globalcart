import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Plus, Download, Copy } from "lucide-react";
import ImageUploader from "@/components/common/ImageUploader";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";

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
    const tpl = globalTemplates.find(t => t.id === templateId);
    if (tpl) {
      setSelectedPermissions([...(tpl.direct_permissions || [])]);
      if (!roleName) setRoleName(tpl.name + " (副本)");
      if (tpl.color) setRoleColor(tpl.color);
    }
  };

  const togglePermission = (permId) => {
    setSelectedPermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
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

          {/* 从全局模板套用 */}
          <div>
            <Label className="text-xs text-gray-500 block mb-1.5">从全局模板套用（可选）</Label>
            {loadingTemplates ? (
              <p className="text-xs text-gray-400">加载模板中...</p>
            ) : globalTemplates.length === 0 ? (
              <p className="text-xs text-gray-400">暂无全局模板</p>
            ) : (
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
                {globalTemplates.map(tpl => (
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
            )}
            {selectedTemplateId && (
              <p className="text-xs text-indigo-600 mt-1">已套用模板权限，可在下方继续自定义调整</p>
            )}
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
                        <label key={p.id} className={`flex items-center gap-2 cursor-pointer py-0.5 ${p.isChild ? "pl-4" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(p.id)}
                            onChange={() => togglePermission(p.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300"
                          />
                          <span className={`text-xs ${p.isChild ? "text-gray-500" : "text-gray-700"}`}>{p.name}</span>
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