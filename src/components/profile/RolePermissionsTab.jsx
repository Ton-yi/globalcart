/**
 * RolePermissionsTab — 角色权限 Tab（查看自己的系统角色、角色标签和权限开放情况）
 */
import { useAuth } from "@/lib/AuthContext";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Minus } from "lucide-react";

const SYSTEM_ROLE_LABELS = {
  platform_admin: "平台管理员",
  tenant_admin: "管理员",
  admin: "管理员",
  staff: "员工",
  user: "普通用户",
};

export default function RolePermissionsTab() {
  const { user, permissions = [], assignedRoles = [] } = useAuth();
  const isAdmin = ['platform_admin', 'admin', 'tenant_admin'].includes(user?.role);

  if (!user) return null;

  return (
    <div className="space-y-4">
      {/* 系统角色与角色标签 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />系统角色与角色标签
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">系统角色</span>
            <Badge className={isAdmin ? "text-xs bg-red-100 text-red-700" : user.role === 'staff' ? "text-xs bg-orange-100 text-orange-700" : "text-xs bg-gray-100 text-gray-600"}>
              {SYSTEM_ROLE_LABELS[user.role] || user.role}
            </Badge>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500 shrink-0">角色标签</span>
            {assignedRoles.length > 0 ? (
              <div className="flex flex-wrap gap-1 justify-end">
                {assignedRoles.map(r => (
                  <Badge key={r.id} className="text-xs"
                    style={{ backgroundColor: r.color + '22', color: r.color, borderColor: r.color + '55', border: '1px solid' }}>
                    {r.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400">无角色标签</span>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500">权限开放</span>
            <span className="text-sm font-medium text-gray-800">
              {isAdmin ? "全部权限（管理员）" : `${permissions.length} 项`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 权限开放详情 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">权限开放情况</CardTitle>
          <p className="text-xs text-gray-400 mt-1">角色标签与权限由管理员在用户管理中分配</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              您是管理员，拥有以下全部权限
            </div>
          )}
          {PERMISSIONS_PRESET.map(cat => {
            const flatPerms = [];
            const flatten = (items) => items.forEach(p => {
              flatPerms.push(p);
              if (p.children) flatten(p.children);
            });
            flatten(cat.permissions);
            return (
              <div key={cat.category}>
                <p className="text-xs font-medium mb-2">
                  <Badge className={`text-[10px] ${cat.color}`}>{cat.category}</Badge>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {flatPerms.map(p => {
                    const granted = isAdmin || permissions.includes(p.name);
                    return (
                      <div key={p.name}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs ${
                          granted ? "border-green-200 bg-green-50 text-green-800" : "border-gray-100 bg-gray-50 text-gray-400"
                        }`}>
                        {granted
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          : <Minus className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span className="truncate" title={p.display_name}>{p.display_name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}