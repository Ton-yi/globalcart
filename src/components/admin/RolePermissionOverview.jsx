import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

const PERMISSION_LABELS = {
  "order:read": "订单查看",
  "order:create": "订单创建",
  "order:update": "订单编辑",
  "order:delete": "订单删除",
  "shipping_pool:read": "发货池查看",
  "shipping_pool:create": "发货池创建",
  "shipping_pool:update": "发货池编辑",
  "shipping_pool:delete": "发货池删除",
  "user:read": "用户查看",
  "user:create": "用户创建",
  "user:update": "用户编辑",
  "user:delete": "用户删除",
  "payment:read": "支付查看",
  "payment:confirm": "确认支付",
};

const PERMISSION_CATEGORIES = {
  订单: ["order:read", "order:create", "order:update", "order:delete"],
  发货: ["shipping_pool:read", "shipping_pool:create", "shipping_pool:update", "shipping_pool:delete"],
  用户: ["user:read", "user:create", "user:update", "user:delete"],
  支付: ["payment:read", "payment:confirm"],
};

const PREDEFINED_ROLES = {
  "user": { label: "普通用户", color: "bg-gray-100", priority: 1 },
  "tenant_admin": { label: "租户管理员", color: "bg-red-100", priority: 2 },
};

export default function RolePermissionOverview({ roles = [] }) {
  const [expandedRole, setExpandedRole] = useState(null);

  // Merge predefined roles with tenant-custom roles
  const allRolesToDisplay = [
    ...Object.entries(PREDEFINED_ROLES).map(([key, meta]) => ({
      id: key,
      name: meta.label,
      color: meta.color,
      is_global: true,
      is_predefined: true,
      direct_permissions: key === "user" 
        ? ["order:read", "shipping_pool:read"]
        : key === "tenant_admin"
          ? ["order:read", "order:create", "order:update", "order:delete", "shipping_pool:read", "shipping_pool:create", "shipping_pool:update", "shipping_pool:delete", "user:read", "user:create", "user:update", "payment:read", "payment:confirm"]
          : [],
    })),
    ...roles.filter(r => !r.is_global),
  ];

  if (!allRolesToDisplay || allRolesToDisplay.length === 0) {
    return (
      <Card className="mt-8 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />角色权限总览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 text-center py-4">暂无角色数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />角色权限总览
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">共 {allRolesToDisplay.length} 个角色（含 {Object.keys(PREDEFINED_ROLES).length} 个预定义）</p>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">角色名称</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">类型</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">权限数量</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">详细权限</th>
            </tr>
          </thead>
          <tbody>
            {allRolesToDisplay.map((role) => {
              const isExpanded = expandedRole === role.id;
              const permCount = role.direct_permissions?.length || 0;
              
              return (
                <tbody key={role.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {role.image_url ? (
                          <img src={role.image_url} alt={role.name} className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: role.color || "#9ca3af" }}
                          />
                        )}
                        <span className="font-medium text-gray-900">{role.name}</span>
                        {role.is_predefined && (
                          <span className="text-2xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">预定义</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {role.is_global ? (
                        <Badge className="bg-blue-100 text-blue-700 text-2xs px-2 py-0.5">全局</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 text-2xs px-2 py-0.5">租户</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-gray-800">{permCount}</span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />隐藏
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />查看
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr className="bg-indigo-50 border-b border-gray-100">
                      <td colSpan="4" className="py-3 px-3">
                        <div className="space-y-3">
                          {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                            const categoryPerms = role.direct_permissions?.filter(p => perms.includes(p)) || [];
                            return (
                              <div key={category}>
                                <p className="text-xs font-semibold text-gray-700 mb-1.5">{category}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {perms.map(perm => {
                                    const hasPermission = categoryPerms.includes(perm);
                                    return (
                                      <div
                                        key={perm}
                                        className={`text-2xs px-2 py-1 rounded border ${
                                          hasPermission
                                            ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium"
                                            : "bg-gray-100 border-gray-200 text-gray-400"
                                        }`}
                                      >
                                        {PERMISSION_LABELS[perm]}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {(!role.direct_permissions || role.direct_permissions.length === 0) && (
                            <p className="text-gray-400 text-2xs italic">无权限分配</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}