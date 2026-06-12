/**
 * CustomerNotesPanel - 客户备注 Tab
 * 新增 / 编辑 / 删除 / 置顶，区分内部备注与客户可见备注
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pin, PinOff, Pencil, Trash2, Plus, Lock, Eye } from "lucide-react";
import { toast } from "sonner";

export default function CustomerNotesPanel({ notes, customerUserId, canManage, formatDate, onReload }) {
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("internal");
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [busy, setBusy] = useState(false);

  const invoke = async (payload, successMsg) => {
    setBusy(true);
    try {
      await base44.functions.invoke('manageCustomerNote', payload);
      toast.success(successMsg);
      await onReload?.();
    } catch (e) {
      toast.error(e.response?.data?.error || '操作失败');
    }
    setBusy(false);
  };

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    await invoke({ action: 'create', userId: customerUserId, content: newContent, note_type: newType }, '备注已添加');
    setNewContent("");
  };

  const handleSaveEdit = async (noteId) => {
    await invoke({ action: 'update', noteId, content: editContent }, '备注已更新');
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">客户备注（{notes?.length || 0}）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 新增备注 */}
        {canManage && (
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <Textarea
              rows={3}
              placeholder="输入备注内容..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="bg-white text-sm"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="newNoteType" checked={newType === "internal"} onChange={() => setNewType("internal")} />
                  <Lock className="w-3 h-3 text-gray-400" />内部备注
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" name="newNoteType" checked={newType === "customer_visible"} onChange={() => setNewType("customer_visible")} />
                  <Eye className="w-3 h-3 text-gray-400" />客户可见
                </label>
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={busy || !newContent.trim()}>
                <Plus className="w-3 h-3 mr-1" />添加备注
              </Button>
            </div>
          </div>
        )}

        {/* 备注列表 */}
        {notes && notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map(note => (
              <div key={note.id} className={`p-3 border rounded-lg ${note.is_pinned ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {note.is_pinned && <Pin className="w-3.5 h-3.5 text-yellow-600" />}
                    <Badge className={note.note_type === 'customer_visible' ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                      {note.note_type === 'customer_visible' ? '客户可见' : '内部备注'}
                    </Badge>
                    <span className="text-xs text-gray-400">{note.created_by_name || note.created_by_email} · {formatDate(note.created_date)}</span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-yellow-600" title={note.is_pinned ? '取消置顶' : '置顶'}
                        disabled={busy}
                        onClick={() => invoke({ action: 'toggle_pin', noteId: note.id }, note.is_pinned ? '已取消置顶' : '已置顶')}>
                        {note.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600" title="编辑"
                        disabled={busy}
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600" title="删除"
                        disabled={busy}
                        onClick={() => { if (confirm('确定删除此备注？')) invoke({ action: 'delete', noteId: note.id }, '备注已删除'); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === note.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea rows={3} value={editContent} onChange={e => setEditContent(e.target.value)} className="text-sm bg-white" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setEditingId(null)}>取消</Button>
                      <Button size="sm" className="h-6 text-xs" disabled={busy || !editContent.trim()} onClick={() => handleSaveEdit(note.id)}>保存</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{note.content}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">暂无备注</p>
        )}
      </CardContent>
    </Card>
  );
}