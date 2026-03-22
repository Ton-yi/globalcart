import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { Plus, Edit2, Trash2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_LABELS = { info: "一般", warning: "警告", success: "成功", urgent: "紧急" };
const TYPE_COLORS = { info: "bg-blue-100 text-blue-700", warning: "bg-yellow-100 text-yellow-700", success: "bg-green-100 text-green-700", urgent: "bg-red-100 text-red-700" };
const AUDIENCE_LABELS = { all: "全部用户", users: "一般用户", admins: "管理员" };

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", type: "info", is_active: true, target_audience: "all", expires_at: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await tenantEntity.list('Announcement');
    setAnnouncements(data);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, type: a.type, is_active: a.is_active, target_audience: a.target_audience, expires_at: a.expires_at || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await tenantEntity.update('Announcement', editing.id, form);
    } else {
      await tenantEntity.create('Announcement', form);
    }
    await load();
    setShowForm(false);
    setEditing(null);
    setForm({ title: "", content: "", type: "info", is_active: true, target_audience: "all", expires_at: "" });
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await tenantEntity.delete('Announcement', id);
    await load();
  };

  const handleToggle = async (a) => {
    await tenantEntity.update('Announcement', a.id, { is_active: !a.is_active });
    await load();
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">公告管理</h1>
        <Button className="bg-red-600 hover:bg-red-700 text-sm" onClick={() => { setEditing(null); setShowForm(!showForm); }}>
          <Plus className="w-4 h-4 mr-1" />新增公告
        </Button>
      </div>

      {showForm && (
        <Card className="border-gray-200">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">{editing ? "编辑公告" : "新增公告"}</h3>
            <div>
              <Label className="text-sm">标题 *</Label>
              <Input className="mt-1" value={form.title} onChange={e => f("title", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">内容 *</Label>
              <Textarea rows={3} className="mt-1" value={form.content} onChange={e => f("content", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">类型</Label>
                <Select value={form.type} onValueChange={v => f("type", v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">受众</Label>
                <Select value={form.target_audience} onValueChange={v => f("target_audience", v)}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">过期日期</Label>
                <Input type="date" className="mt-1" value={form.expires_at} onChange={e => f("expires_at", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.is_active} onChange={e => f("is_active", e.target.checked)} className="w-4 h-4" />
              <Label htmlFor="active" className="text-sm cursor-pointer">立即显示</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditing(null); }}>取消</Button>
              <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave} disabled={saving || !form.title || !form.content}>
                {saving ? "保存中..." : "发布公告"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">暂无公告</p>
          </div>
        ) : announcements.map(a => (
          <div key={a.id} className={`bg-white border rounded-xl p-4 ${!a.is_active ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{a.title}</span>
                  <Badge className={`text-xs ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</Badge>
                  <Badge className="bg-gray-100 text-gray-600 text-xs">{AUDIENCE_LABELS[a.target_audience]}</Badge>
                  {!a.is_active && <Badge className="bg-gray-100 text-gray-400 text-xs">已隐藏</Badge>}
                </div>
                <p className="text-sm text-gray-600">{a.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(a.created_date).toLocaleDateString("zh-CN")}{a.expires_at ? ` · 过期：${a.expires_at}` : ""}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleToggle(a)}>
                  {a.is_active ? "隐藏" : "显示"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(a)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}