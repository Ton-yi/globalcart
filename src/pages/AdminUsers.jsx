import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, UserPlus, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('listNonAdminUsers', {}).then(r => r.data?.users || []),
      base44.functions.invoke('getTenantOrders', {}).then(r => r.data?.orders || []),
    ]).then(([u, o]) => {
      setUsers(u);
      setOrders(o);
      setLoading(false);
    });
  }, []);

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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">加载中...</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}