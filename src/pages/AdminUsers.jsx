import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, UserPlus, Shield, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Tenant diagnosis state
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [assigning, setAssigning] = useState({});
  const [assignTarget, setAssignTarget] = useState({}); // email -> selected tenant_id

  useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      // Auto-run diagnosis for any admin so the panel is immediately useful
      if (u?.role === 'platform_admin' || u?.role === 'admin' || u?.role === 'tenant_admin') {
        setDiagOpen(true);
        runDiagnose();
      }
    }).catch(() => {});
    Promise.all([
      base44.functions.invoke('listNonAdminUsers', {}).then(r => r.data?.users || []),
      base44.functions.invoke('getTenantOrders', { all: true }).then(r => r.data?.orders || []),
    ]).then(([u, o]) => {
      setUsers(u);
      setOrders(o);
      setLoading(false);
    });
  }, []);

  const isPlatformAdmin = currentUser?.role === 'platform_admin';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'tenant_admin';
  const showDiagPanel = isPlatformAdmin || isAdmin;

  const runDiagnose = async () => {
    setDiagLoading(true);
    const r = await base44.functions.invoke('adminAssignTenant', { action: 'diagnose' });
    setDiagData(r.data);
    setDiagLoading(false);
  };

  const handleAssign = async (email) => {
    const tid = assignTarget[email];
    if (!tid) return;
    setAssigning(a => ({ ...a, [email]: true }));
    await base44.functions.invoke('adminAssignTenant', { action: 'assign', target_email: email, tenant_id: tid });
    setAssigning(a => ({ ...a, [email]: false }));
    // Refresh diagnosis
    await runDiagnose();
  };

  const handleSelfAssign = async (email) => {
    setAssigning(a => ({ ...a, [email]: true }));
    await base44.functions.invoke('adminAssignTenant', { action: 'self_assign', target_email: email });
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

  const filtered = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getUserOrderCount = (email) => orders.filter(o => o.user_email === email).length;
  const getUserTotalPaid = (email) => orders.filter(o => o.user_email === email).reduce((s, o) => s + (o.paid_amount || 0), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">用户管理</h1>

      {/* Tenant Assignment Diagnostics — platform_admin and tenant admins without tenant */}
      {showDiagPanel && (
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
              ) : diagData ? (
                <>
                  <p className="text-xs text-gray-500">
                    共 {diagData.total_users} 名用户，
                    <span className={`font-semibold ${diagData.missing_tenant_users.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {diagData.missing_tenant_users.length} 名未分配租户
                    </span>
                  </p>
                  {diagData.missing_tenant_users.length === 0 ? (
                    <p className="text-xs text-green-600">✓ 所有用户均已分配租户，无 403 风险</p>
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
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                            disabled={!assignTarget[u.email] || assigning[u.email]}
                            onClick={() => handleAssign(u.email)}
                          >
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
          <Input placeholder="输入邮箱地址" className="h-8 text-sm flex-1 min-w-48" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">用户</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 bg-gray-900 hover:bg-gray-800 text-xs" onClick={handleInvite} disabled={inviting || !inviteEmail}>
            {inviting ? "发送中..." : "发送邀请"}
          </Button>
        </div>
        {inviteMsg && <p className="text-xs text-green-600 mt-2">{inviteMsg}</p>}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input placeholder="搜索用户..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">用户</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">邮箱</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">角色</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">订单数</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">累计付款</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">注册时间</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">租户ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
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
                  <Badge className={`text-xs ${u.role === "admin" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.role === "admin" ? <><Shield className="w-2.5 h-2.5 mr-1 inline" />管理员</> : "用户"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{getUserOrderCount(u.email)}</td>
                <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">
                  {getUserTotalPaid(u.email) > 0 ? `USD ${getUserTotalPaid(u.email).toFixed(2)}` : "-"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                  {new Date(u.created_date).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-4 py-3">
                  {u.tenant_id
                    ? <span className="text-xs font-mono text-gray-500">{u.tenant_id.slice(-8)}</span>
                    : <Badge className="text-xs bg-red-100 text-red-600">未分配</Badge>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}