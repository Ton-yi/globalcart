import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Save, ChevronDown, ChevronUp, GripVertical,
  HelpCircle, FolderOpen, ArrowLeft, Eye, EyeOff
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";

function genId() { return `faq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// Markdown editor with preview toggle
function MarkdownEditor({ label, value, onChange, placeholder, rows = 4 }) {
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-gray-500">{label}</Label>
        <button
          type="button"
          onClick={() => setPreview(p => !p)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          {preview ? <><EyeOff className="w-3 h-3" />编辑</> : <><Eye className="w-3 h-3" />预览</>}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[80px] border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
          <ReactMarkdown className="prose prose-sm max-w-none text-gray-700">
            {value || "*（空）*"}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-gray-300"
          rows={rows}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function FaqItemEditor({ item, idx, total, onChange, onDelete, onMoveUp, onMoveDown }) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200 cursor-pointer"
        onClick={() => setCollapsed(c => !c)}>
        <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-600 flex-1 truncate">
          Q{idx + 1}：{item.question ? item.question.slice(0, 60) : "（无问题）"}
        </span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={idx === total - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-0.5 text-red-400 hover:text-red-600 ml-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <button className="p-0.5 text-gray-400" onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="p-3 space-y-3">
          <MarkdownEditor
            label="问题（支持 Markdown）"
            value={item.question}
            onChange={v => onChange({ ...item, question: v })}
            placeholder="用户常见的问题…"
            rows={2}
          />
          <MarkdownEditor
            label="答案（支持 Markdown）"
            value={item.answer}
            onChange={v => onChange({ ...item, answer: v })}
            placeholder="详细解答，支持 **加粗**、`代码`、链接等 Markdown 格式…"
            rows={5}
          />
        </div>
      )}
    </div>
  );
}

function CategoryEditor({ category, onSave, onDelete, onCancel, isNew }) {
  const [form, setForm] = useState({
    title: category?.title || "",
    description: category?.description || "",
    icon: category?.icon || "",
    sort_order: category?.sort_order ?? 0,
    is_active: category?.is_active !== false,
    items: category?.items || [],
  });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const updateItem = (i, val) => f("items", form.items.map((it, idx) => idx === i ? val : it));
  const addItem = () => f("items", [...form.items, { _id: genId(), question: "", answer: "" }]);
  const removeItem = (i) => f("items", form.items.filter((_, idx) => idx !== i));
  const moveItem = (i, dir) => {
    const arr = [...form.items];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    f("items", arr);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Card className="border-teal-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">
            {isNew ? "新建分类" : `编辑：${category.title}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>取消</Button>
            )}
            {!isNew && onDelete && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50" onClick={onDelete}>
                <Trash2 className="w-3 h-3 mr-1" />删除分类
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving || !form.title.trim()}>
              <Save className="w-3 h-3 mr-1" />{saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">分类标题 *</Label>
            <Input className="mt-0.5 h-8 text-sm" value={form.title} onChange={e => f("title", e.target.value)} placeholder="例：购物流程" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">图标（emoji 或留空）</Label>
            <Input className="mt-0.5 h-8 text-sm" value={form.icon} onChange={e => f("icon", e.target.value)} placeholder="🛒" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-500">分类简介</Label>
          <Input className="mt-0.5 h-8 text-sm" value={form.description} onChange={e => f("description", e.target.value)} placeholder="可选，简短描述本分类的用途" />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Label className="text-xs text-gray-500">排序权重</Label>
            <Input type="number" className="mt-0.5 h-8 text-sm w-24" value={form.sort_order} onChange={e => f("sort_order", Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => f("is_active", !form.is_active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? "bg-teal-600" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${form.is_active ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <span className="text-xs text-gray-600">{form.is_active ? "已启用" : "已禁用"}</span>
          </div>
        </div>

        {/* FAQ items */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">问答列表 <Badge variant="outline" className="text-xs ml-1">{form.items.length}</Badge></span>
            <Button size="sm" variant="outline" onClick={addItem} className="h-7 text-xs border-dashed border-teal-300 text-teal-600 hover:bg-teal-50">
              <Plus className="w-3.5 h-3.5 mr-1" />新增问答
            </Button>
          </div>
          <div className="space-y-2">
            {form.items.map((item, i) => (
              <FaqItemEditor
                key={item._id || i}
                item={item} idx={i} total={form.items.length}
                onChange={val => updateItem(i, val)}
                onDelete={() => removeItem(i)}
                onMoveUp={() => moveItem(i, -1)}
                onMoveDown={() => moveItem(i, 1)}
              />
            ))}
            {form.items.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs border border-dashed border-gray-200 rounded-lg">
                暂无问答，点击上方「新增问答」添加
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminFaq() {
  const { user } = useCurrentUser();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null=list, "new"=create, id=edit
  const [editingCategory, setEditingCategory] = useState(null);

  const isAdmin = user?.role === "admin" || user?.role === "tenant_admin" || user?.role === "platform_admin";

  const load = useCallback(async () => {
    setLoading(true);
    const r = await base44.functions.invoke('manageFaqCategories', { action: 'list' });
    setCategories(r.data?.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return <div className="text-center py-8 text-red-500 text-sm">仅管理员可访问</div>;
  }

  const handleSave = async (form) => {
    if (editingId === "new") {
      await base44.functions.invoke('manageFaqCategories', { action: 'create', data: form });
    } else {
      await base44.functions.invoke('manageFaqCategories', { action: 'update', id: editingId, data: form });
    }
    await load();
    setEditingId(null);
    setEditingCategory(null);
  };

  const handleDelete = async () => {
    if (!editingId || editingId === "new") return;
    if (!confirm(`确认删除分类「${editingCategory?.title}」及其所有问答？`)) return;
    await base44.functions.invoke('manageFaqCategories', { action: 'delete', id: editingId });
    await load();
    setEditingId(null);
    setEditingCategory(null);
  };

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl("AdminSettings")} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <HelpCircle className="w-5 h-5 text-teal-500" />
          <h1 className="text-xl font-bold text-gray-900">帮助中心管理</h1>
        </div>
        <Link to={createPageUrl("helpcenter/faq")} target="_blank">
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <Eye className="w-3.5 h-3.5 mr-1" />预览帮助中心
          </Button>
        </Link>
        {editingId === null && (
          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700"
            onClick={() => { setEditingId("new"); setEditingCategory(null); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />新建分类
          </Button>
        )}
      </div>

      {/* New category editor */}
      {editingId === "new" && (
        <CategoryEditor
          category={null}
          isNew={true}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Edit category */}
      {editingId && editingId !== "new" && (
        <CategoryEditor
          category={editingCategory}
          isNew={false}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => { setEditingId(null); setEditingCategory(null); }}
        />
      )}

      {/* Category list */}
      {editingId === null && (
        <>
          {loading && <div className="text-center py-8 text-gray-400 text-sm">加载中…</div>}
          {!loading && categories.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
              <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">暂无问答分类</p>
              <p className="text-gray-300 text-xs mt-1">点击右上角「新建分类」开始添加</p>
            </div>
          )}
          {!loading && categories.length > 0 && (
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat.id}
                  className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-teal-200 transition-colors cursor-pointer"
                  onClick={() => { setEditingId(cat.id); setEditingCategory(cat); }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cat.icon || "📁"}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{cat.title}</span>
                        {!cat.is_active && <Badge variant="outline" className="text-xs text-gray-400">已禁用</Badge>}
                      </div>
                      {cat.description && <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{(cat.items || []).length} 条问答</span>
                    <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}