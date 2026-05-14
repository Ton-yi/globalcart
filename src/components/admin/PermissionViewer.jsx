import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";

const PermissionRow = ({ permission, level = 0 }) => {
  const indent = level > 0 ? "ml-5 pl-3 border-l-2 border-gray-200" : "";

  return (
    <div className={`group flex items-start gap-2 py-1.5 ${indent}`}>
      {level > 0 && <span className="text-gray-300 text-xs mt-0.5">└</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-medium ${level > 0 ? "text-gray-600" : "text-gray-800"}`}>
            {permission.display_name}
          </span>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline">{permission.name}</span>
        </div>
        {permission.description && (
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{permission.description}</p>
        )}
      </div>
    </div>
  );
};

const CategoryBlock = ({ group }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
      <Badge className={`text-xs ${group.color}`}>{group.category}</Badge>
      <span className="text-xs text-gray-400">{group.permissions.length} 项</span>
    </div>
    <div className="px-4 py-2 divide-y divide-gray-50">
      {group.permissions.map(perm => (
        <div key={perm.name}>
          <PermissionRow permission={perm} level={0} />
          {perm.children?.map(child => (
            <PermissionRow key={child.name} permission={child} level={1} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default function PermissionViewer() {
  const totalCount = PERMISSIONS_PRESET.reduce(
    (acc, g) => acc + g.permissions.length + g.permissions.reduce((s, p) => s + (p.children?.length || 0), 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <p className="text-xs text-gray-500">
          以下列出系统支持的全部权限（共 <strong>{totalCount}</strong> 项），可用于角色配置和用户权限覆写。
          子权限以缩进形式展示，代表逻辑上属于父权限的细分控制。
        </p>
      </div>

      <div className="grid gap-3">
        {PERMISSIONS_PRESET.map(group => (
          <CategoryBlock key={group.category} group={group} />
        ))}
      </div>
    </div>
  );
}