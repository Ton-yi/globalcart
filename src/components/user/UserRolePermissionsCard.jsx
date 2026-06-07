import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { tenantEntity } from "@/lib/tenantApi";
import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ChevronDown, ChevronUp, Star } from "lucide-react";

export default function UserRolePermissionsCard() {
  const { user, permissions } = useAuth();
  const isAdmin = user?.role === 'platform_admin' || user?.role === 'admin' || user?.role === 'tenant_admin';

  const [roles, setRoles] = useState([]);
  const [memberTier, setMemberTier] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const promises = [];

    // Fetch assigned roles
    if (user.assigned_role_ids?.length > 0) {
      promises.push(
        tenantEntity.list('Role', { is_archived: false })
          .then(allRoles => {
            const assigned = (allRoles || []).filter(r => user.assigned_role_ids.includes(r.id));
            setRoles(assigned);
          }).catch(() => {})
      );
    }

    // Fetch member tier
    if (user.member_tier_id) {
      promises.push(
        tenantEntity.list('MemberTier', { is_active: true })
          .then(tiers => {
            const tier = (tiers || []).find(t => t.id === user.member_tier_id);
            setMemberTier(tier || null);
          }).catch(() => {})
      );
    }
  }, [user?.email]);

  // Flatten all permissions with display names from preset
  const permissionMap = {};
  const flattenPreset = (items) => {
    items.forEach(item => {
      permissionMap[item.name] = item.display_name;
      if (item.children) flattenPreset(item.children);
    });
  };
  PERMISSIONS_PRESET.forEach(cat => flattenPreset(cat.permissions));

  // Group user permissions by category
  const groupedPermissions = PERMISSIONS_PRESET.map(cat => {
    const flatCatPerms = [];
    const flatten = (items) => items.forEach(p => {
      flatCatPerms.push(p);
      if (p.children) flatten(p.children);
    });
    flatten(cat.permissions);
    const userHas = flatCatPerms.filter(p => permissions.includes(p.name));
    return { ...cat, userHas };
  }).filter(cat => cat.userHas.length > 0);

  const totalPermissions = permissions.length;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Shield className="w-4 h-4" />我的等级与权限
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Member Tier */}
        {memberTier && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-yellow-500" />会员等级
            </span>
            <Badge className={`text-xs ${memberTier.color || 'bg-gray-100 text-gray-700'}`}>
              {memberTier.name}
            </Badge>
          </div>
        )}

        {/* Assigned Roles */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-gray-500 shrink-0">角色标签</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {isAdmin ? (
              <Badge className="text-xs bg-red-100 text-red-700">管理员</Badge>
            ) : roles.length > 0 ? (
              roles.map(r => (
                <Badge key={r.id} className="text-xs"
                  style={{ backgroundColor: r.color ? r.color + '22' : undefined, color: r.color || undefined, borderColor: r.color ? r.color + '44' : undefined }}>
                  {r.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-gray-400">暂无角色</span>
            )}
          </div>
        </div>

        {/* Permissions Summary */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span>
              {isAdmin
                ? "权限：全部（管理员）"
                : totalPermissions > 0
                  ? `已开放权限 · ${totalPermissions} 项`
                  : "暂无特殊权限"}
            </span>
            {!isAdmin && totalPermissions > 0 && (
              expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Expanded permission list */}
          {!isAdmin && expanded && groupedPermissions.length > 0 && (
            <div className="mt-3 space-y-3">
              {groupedPermissions.map(cat => (
                <div key={cat.category}>
                  <p className="text-xs font-medium mb-1.5">
                    <Badge className={`text-[10px] ${cat.color}`}>{cat.category}</Badge>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cat.userHas.map(p => (
                      <span key={p.name} className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                        {p.display_name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}