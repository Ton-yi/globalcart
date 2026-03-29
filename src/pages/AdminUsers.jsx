import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Search, UserPlus, Shield, AlertTriangle, ChevronDown, ChevronUp,
  Pencil, Trash2, Ban, CheckCircle, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_LABELS = {
  platform_admin: { label: "平台管理员", color: "bg-purple-100 text-purple-700" },
  tenant_admin:   { label: "租户管理员", color: "bg-red-100 text-red-700" },
  admin:          { label: "管理员",     color: "bg-red-100 text-red-700" },
  staff:          { label: "员工",       color: "bg-blue-100 text-blue-700" },
  user:           { label: "用户",       color: "bg-gray-100 text-gray-600" },
};

function EditUserModal({ user: targetUser, currentUser, onClose, onSaved }) {
  const isPlatformAdmin = currentUser?.role === 'platform_admin';
  const [role, setRole] = useState(targetUser.role || 'user');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const roleOptions = isPlatformAdmin
    ? [
        { value: 'platform_admin', label: '平台管理员' },
        { value: 'tenant_admin',   label: '租户管理员' },
        { value: 'admin',          label: '管理员' },
        { value: 'staff',          label: '员工' },
        { value: 'user',           label: '用户' },
      ]
    : [
        { value: 'admin',          label: '管理员' },
        { value: 'tenant_admin',   label: '租户管理员' },
        { value: 'staff',          label: '员工' },
        { value: 'user',           label: '用户' },
      ];

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const res = await base44.functions.invoke('manageUser', {
      action: 'update_role',
      target_user_id: targetUser.id,
      role,
    });
    if (res.data?.error) {
      setError(res.data.error);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">编辑用户权限</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">用户</p>
            <p className="text-sm font-medium text-gray-800">{targetUser.full_name || "-"}</p>
            <p className="text-xs text-gray-400">{targetUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">角色</p>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tenantMap, setTenantMap] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [actioning, setActioning] = useState({});
  const { user: currentUser } = useCurrentUser();

  // Tenant diagnosis state
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState(null);
  const [assigning, setAssigning] = useState({});
  const [assignTarget, setAssignTarget] = useState({});

  const isPlatformAdmin = currentUser?.role === 'platform_admin';
  const isTenantAdmin = currentUser?.role === 'admin' || currentUser?.role === 'tenant_admin';

  const loadData = () => {
    setLoading(true);
    base44.functions.invoke('getAdminUsersPageData', {}).then(r => {
      const { users: u = [], orders: o = [], tenants = [], diagnose } = r.data || {};
      const map = {};
      tenants.forEach(t => { map[t.id] = t; });
      setTenantMap(map);
      setUsers(u);
      setOrders(o);
      if (diagnose) setDiagData(diagnose);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const runDiagnose = async () => {
    setDiagLoading(true);
    setDiagError(null);
    const r = await base44.functions.invoke('adminAssignTenant', { action: 'diagnose' });
    if (r.data?.error) setDiagError(r.data.error);
    else setDiagData(r.data);
    setDiagLoading(false);
  };

  const handleAssign = async (email) => {
    const tid = assignTarget[email];
    if (!tid) return;
    setAssigning(a => ({ ...a, [email]: true }));
    await base44.functions.invoke('adminAssignTenant', { action: 'assign', target_email: email, tenant_id: tid });
    setAssigning(a => ({ ...a, [email]: false }));
    await runDiagnose();
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviteMsg(`已发送邀请至 ${inviteEmail}`);
    setInviteEmail("");
    setInviting(false);
    setTimeout(() => setInviteMsg(""), 3000);
  };

  const handleToggleActive = async (u) => {
    setActioning(a => ({ ...a, [u.id]: 'toggle' }));
    await base44.functions.invoke('manageUser', {
      action: 'toggle_active',
      target_user_id: u.id,
      is_active: !u.is_active,
    });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
    setActioning(a => ({ ...a, [u.id]: null }));
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`确定要删除用户 ${u.email} 吗？此操作不可撤销。`)) return;
    setActioning(a => ({ ...a, [u.id]: 'delete' }));
    const res = await base44.functions.invoke('manageUser', {
      action: 'delete',
      target_user_id: u.id,
    });
    if (!res.data?.error) {
      setUsers(prev => prev.filter(x => x.id !== u.id));
    }
    setActioning(a => ({ ...a, [u.id]: null }));
  };

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getUserOrderCount = (email) => orders.filter(o => o.user_email === email).length;
  const getUserTotalPaid = (email) => orders.filter(o => o.user_email === email).reduce((s, o) => s + (o.paid_amount || 0), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">用户管理</h1>

      {/* Tenant Assignment Diagnostics */}
      {(isPlatformAdmin || isTenantAdmin) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800"
            onClick={() => { setDiagOpen(o => !o); if (!diagOpen && !diagData) runDiagnose(); }}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              租户分配诊断（排查 403 错误）
            </span>
            {diagOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {diagOpen && (
            <div className="border-t border-amber-200 px-4 py-4 space-y-3 bg-white">
              {diagLoading ? (
                <p className="text-sm text-gray-400">诊断中...</p>
              ) : diagError ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">⚠️ {diagError}</p>
              ) : diagData ? (
                <>
                  <p className="text-xs text-gray-500">
                    共 {diagData.total_users} 名用户，
                    <span className={`font-semibold ${diagData.missing_tenant_users?.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {diagData.missing_tenant_users?.length} 名未分配租户
                    </span>
                  </p>
                  {diagData.missing_tenant_users?.length === 0 ? (
                    <p className="text-xs text-green-600">✓ 所有用户均已分配租户</p>
                  ) : (
                    <div className="space-y-2">
                      {diagData.missing_tenant_users.map(u => (
                        <div key={u.email} className="flex items-center gap-2 flex-wrap py-1.5 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800 font-medium">{u.email}</span>
                            <span className="text-xs text-gray-400 ml-2">{u.role}</span>
                          </div>
                          <Select value={assignTarget[u.email] || ""} onValueChange={v => setAssignTarget(a => ({ ...a, [u.email]: v }))}>
                            <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="选择租户" /></SelectTrigger>
                            <SelectContent>
                              {(diagData.tenants || []).map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                            disabled={!assignTarget[u.email] || assigning[u.email]}
                            onClick={() => handleAssign(u.email)}>
                            {assigning[u.email] ? "分配中..." : "分配"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={runDiagnose}>刷新诊断</Button>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Invite User */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />邀请新用户
        </h3>
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="输入邮箱地址" className="h-8 text-sm flex-1 min-w-48"
            value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">用户</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 bg-gray-900 hover:bg-gray-800 text-xs"
            onClick={handleInvite} disabled={inviting || !inviteEmail}>
            {inviting ? "发送中..." : "发送邀请"}
          </Button>
        </div>
        {inviteMsg && <p className="text-xs text-green-600 mt-2">{inviteMsg}</p>}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input placeholder="搜索用户..." className="pl-8 h-8 text-sm"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">用户</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">邮箱</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">角色</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">订单数</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">注册时间</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">租户</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">状态</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">暂无用户</td></tr>
            ) : filtered.map(u => {
              const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.user;
              const isDisabled = u.is_active === false;
              return (
                <tr key={u.id} className={`hover:bg-gray-50 ${isDisabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.full_name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${roleInfo.color}`}>
                      {u.role === 'platform_admin' && <Shield className="w-2.5 h-2.5 mr-1 inline" />}
                      {roleInfo.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{getUserOrderCount(u.email)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                    {u.created_date ? new Date(u.created_date).toLocaleDateString("zh-CN") : "-"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {u.tenant_id
                      ? <span className="text-xs text-gray-700">{tenantMap[u.tenant_id]?.name || '...'}</span>
                      : <Badge className="text-xs bg-red-100 text-red-600">未分配</Badge>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {isDisabled
                      ? <Badge className="text-xs bg-gray-100 text-gray-500">已停用</Badge>
                      : <Badge className="text-xs bg-green-100 text-green-700">正常</Badge>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Edit role */}
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        title="编辑角色"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={!!actioning[u.id]}
                        className={`p-1.5 rounded hover:bg-gray-100 ${isDisabled ? 'text-green-500 hover:text-green-700' : 'text-amber-500 hover:text-amber-700'}`}
                        title={isDisabled ? "启用用户" : "停用用户"}
                      >
                        {isDisabled
                          ? <CheckCircle className="w-3.5 h-3.5" />
                          : <Ban className="w-3.5 h-3.5" />
                        }
                      </button>
                      {/* Delete — only platform_admin can see for all; tenant_admin cannot delete platform_admin */}
                      {(isPlatformAdmin || (isTenantAdmin && u.role !== 'platform_admin')) && (
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={!!actioning[u.id]}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="删除用户"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          currentUser={currentUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); loadData(); }}
        />
      )}
    </div>
  );
}