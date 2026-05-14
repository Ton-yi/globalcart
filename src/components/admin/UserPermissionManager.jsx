import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, AlertCircle, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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

const CYCLE_LABELS = { weekly: "周结（7天）", monthly: "月结（月初）" };
const STATUS_LABELS = {
  pending: { label: "待审核", color: "bg-amber-100 text-amber-700" },
  approved: { label: "已通过", color: "bg-green-100 text-green-700" },
  rejected: { label: "已拒绝", color: "bg-red-100 text-red-600" },
};

export default function UserPermissionManager({ user, allRoles, onClose }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [basePermissions, setBasePermissions] = useState([]);
  const [overridePermissions, setOverridePermissions] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [applications, setApplications] = useState([]);
  const [memberTiers, setMemberTiers] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewData, setReviewData] = useState({ admin_note: "", override_limit_jpy: "", override_cycle: "", member_tier_id: "" });

  useEffect(() => {
    if (user.assigned_role_ids && user.assigned_role_ids.length > 0) {
      const firstRoleId = user.assigned_role_ids[0];
      setSelectedRole(firstRoleId);
      const role = allRoles.find(r => r.id === firstRoleId);
      if (role?.direct_permissions) {
        setBasePermissions(role.direct_permissions);
      }
    }
    setOverridePermissions(user.permission_overrides || {});
    loadCreditData();
  }, [user, allRoles]);

  const loadCreditData = async () => {
    setLoadingApps(true);
    try {
      const [appsRes, settingsRes] = await Promise.all([
        base44.functions.invoke('manageCreditApplication', { action: 'list' }),
        base44.functions.invoke('getAdminSettingsPageData', {}).catch(() => ({ data: { memberTiers: [] } })),
      ]);
      const userApps = (appsRes.data?.applications || []).filter(a => a.user_email === user.email);
      setApplications(userApps);
      setMemberTiers(settingsRes.data?.memberTiers || []);
    } catch (err) {
      console.error('Load credit data error:', err);
    }
    setLoadingApps(false);
  };

  const handleRoleChange = (roleId) => {
    setSelectedRole(roleId);
    const role = allRoles.find(r => r.id === roleId);
    if (role?.direct_permissions) {
      setBasePermissions(role.direct_permissions);
    }
  };

  const togglePermissionOverride = (permId) => {
    setOverridePermissions(prev => ({
      ...prev,
      [permId]: prev[permId] ? undefined : "remove", // toggle remove状态
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageUser', {
        action: 'update_user_permissions',
        target_user_id: user.id,
        assigned_role_id: selectedRole || null,
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

  const handleReview = async (app, decision) => {
    setReviewing(app.id + '_' + decision);
    await base44.functions.invoke('manageCreditApplication', {
      action: 'review',
      application_id: app.id,
      decision,
      admin_note: reviewData.admin_note,
      override_limit_jpy: reviewData.override_limit_jpy || undefined,
      override_cycle: reviewData.override_cycle || undefined,
    });
    if (decision === 'approved' && reviewData.member_tier_id) {
      const tier = memberTiers.find(t => t.id === reviewData.member_tier_id);
      await base44.functions.invoke('manageCreditApplication', {
        action: 'admin_update_user_credit',
        target_user_email: app.user_email,
        member_tier_id: reviewData.member_tier_id,
        member_tier_name: tier?.name || "",
      });
    }
    setReviewing(null);
    setReviewData({ admin_note: "", override_limit_jpy: "", override_cycle: "", member_tier_id: "" });
    await loadCreditData();
  };

  const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // 计算最终权限（基础权限 - 覆盖移除的）
  const getFinalPermissions = () => {
    let perms = [...basePermissions];
    Object.entries(overridePermissions).forEach(([permId, action]) => {
      if (action === "remove") {
        perms = perms.filter(p => p !== permId);
      }
    });
    return perms;
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

          {/* 角色选择 + 记账申请 */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 block mb-2">分配角色</Label>
              <Select value={selectedRole || ""} onValueChange={v => handleRoleChange(v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={allRoles?.length > 0 ? "选择一个角色" : "暂无可选角色"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>无角色</SelectItem>
                  {allRoles && allRoles.length > 0 && allRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole && (
                <p className="text-xs text-gray-400 mt-1">
                  此角色包含 {basePermissions.length} 项权限
                </p>
              )}
            </div>

            {/* 记账申请审核 */}
            {!loadingApps && applications.length > 0 && (
              <div className="border border-amber-200 rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800 mb-2">待审核的记账申请</p>
                {applications.filter(a => a.status === 'pending').length > 0 ? (
                  <div className="space-y-2">
                    {applications.filter(a => a.status === 'pending').map(app => (
                      <div key={app.id} className="bg-white rounded p-2 space-y-1.5 border border-amber-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">{app.application_type === 'apply' ? '首次申请' : app.application_type === 'adjust' ? '调整申请' : '关闭申请'}</span>
                          <Badge className={`text-xs ${STATUS_LABELS[app.status]?.color}`}>{STATUS_LABELS[app.status]?.label}</Badge>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>周期：{CYCLE_LABELS[app.requested_cycle]}</p>
                          <p>额度：¥{(app.requested_limit_jpy || 0).toLocaleString()} JPY</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <Input type="number" placeholder="覆盖额度" className="h-7 text-xs"
                              value={reviewData.override_limit_jpy} onChange={e => setReviewData(d => ({ ...d, override_limit_jpy: e.target.value }))} />
                          </div>
                          <div>
                            <Select value={reviewData.override_cycle || "__same__"} onValueChange={v => setReviewData(d => ({ ...d, override_cycle: v === "__same__" ? "" : v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="周期" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__same__">同申请</SelectItem>
                                <SelectItem value="weekly">周结</SelectItem>
                                <SelectItem value="monthly">月结</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-xs flex-1 bg-green-600 hover:bg-green-700"
                            disabled={!!reviewing} onClick={() => handleReview(app, 'approved')}>
                            <Check className="w-3 h-3 mr-0.5" />批准
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs flex-1 border-red-200 text-red-600"
                            disabled={!!reviewing} onClick={() => handleReview(app, 'rejected')}>
                            <X className="w-3 h-3 mr-0.5" />拒绝
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">暂无待审核申请</p>
                )}
              </div>
            )}
          </div>

          {/* 权限概览 */}
          {selectedRole && (
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
          {selectedRole && (
            <div className="border-t pt-4">
              <Label className="text-xs text-gray-500 font-semibold block mb-2">
                权限覆盖（仅对此用户）
              </Label>
              <p className="text-xs text-gray-400 mb-2">
                在此处移除某项权限，该用户即使拥有此角色也不会有该权限
              </p>
              <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">
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
                        {perms.map(p => {
                          const isInBase = basePermissions.includes(p.id);
                          const isRemoved = overridePermissions[p.id] === "remove";
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-2 cursor-pointer py-0.5 text-xs ${
                                !isInBase ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isInBase && !isRemoved}
                                onChange={() => togglePermissionOverride(p.id)}
                                disabled={!isInBase}
                                className="w-3.5 h-3.5 rounded border-gray-300 disabled:opacity-50"
                              />
                              <span className="text-gray-700">{p.name}</span>
                              {!isInBase && <span className="text-gray-400 text-2xs">（角色不含此权限）</span>}
                            </label>
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
            disabled={saving || !selectedRole}
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}