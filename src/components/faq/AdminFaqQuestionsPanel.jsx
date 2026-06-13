import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircleQuestion, ChevronDown, ChevronUp, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

const STATUS_MAP = {
  pending:  { label: "待回复", color: "bg-yellow-100 text-yellow-700" },
  answered: { label: "已回复", color: "bg-green-100 text-green-700" },
  closed:   { label: "已关闭", color: "bg-gray-100 text-gray-500" },
};

function QuestionAdminItem({ q, categories, onAnswered }) {
  const [open, setOpen] = useState(q.status === 'pending');
  const [answer, setAnswer] = useState(q.answer || "");
  const [saveToFaq, setSaveToFaq] = useState(false);
  const [saveCatId, setSaveCatId] = useState(q.category_id !== 'unclassified' ? q.category_id : "");
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = (categories || []).filter(c => c.is_active !== false);
  const st = STATUS_MAP[q.status] || STATUS_MAP.pending;

  const handleAnswer = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    await base44.functions.invoke('manageFaqQuestions', {
      action: 'answer',
      id: q.id,
      data: {
        answer: answer.trim(),
        save_to_faq: saveToFaq,
        save_category_id: saveToFaq ? saveCatId : null,
      },
    });
    setSubmitting(false);
    onAnswered?.();
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors gap-2"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
            <span className="text-xs text-gray-400">{q.category_title || "未分类"}</span>
            <span className="text-xs text-gray-500">{q.user_name || q.user_email}</span>
          </div>
          <p className="text-sm text-gray-800 mt-1 font-medium">{q.question}</p>
          <p className="text-xs text-gray-400 mt-0.5">{new Date(q.created_date).toLocaleString('zh-CN')}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-3 pb-4 pt-2 border-t border-gray-100 bg-gray-50 space-y-3">
          <div className="text-xs text-gray-500">来自：<span className="text-gray-700">{q.user_email}</span></div>

          {q.status === 'answered' && q.answer && (
            <div>
              <p className="text-xs text-gray-400 mb-1">已有回复</p>
              <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                <ReactMarkdown className="prose prose-sm max-w-none text-gray-700">{q.answer}</ReactMarkdown>
              </div>
              {q.save_to_faq && (
                <p className="text-xs text-teal-600 mt-1">✓ 已保存至公开 FAQ（{q.category_title}）</p>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs text-gray-500 block mb-1">
              {q.status === 'answered' ? "修改回复" : "回复内容（支持 Markdown）"}
            </Label>
            <textarea
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-teal-300"
              rows={4}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="输入回复内容…"
            />
          </div>

          {/* Save to FAQ checkbox */}
          <div className="space-y-2">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setSaveToFaq(v => !v)}
            >
              <Checkbox checked={saveToFaq} onCheckedChange={v => setSaveToFaq(!!v)} />
              <span className="text-xs text-gray-600 select-none">将此问答保存至公开常见问题</span>
            </div>
            {saveToFaq && (
              <div className="ml-6">
                <Label className="text-xs text-gray-500 block mb-1">保存至分类</Label>
                <Select value={saveCatId} onValueChange={setSaveCatId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon && <span className="mr-1">{c.icon}</span>}{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {saveToFaq && !saveCatId && (
                  <p className="text-xs text-red-400 mt-1">请选择保存分类</p>
                )}
              </div>
            )}
          </div>

          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 h-8 text-xs"
            onClick={handleAnswer}
            disabled={submitting || !answer.trim() || (saveToFaq && !saveCatId)}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {submitting ? "提交中…" : "发送回复"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminFaqQuestionsPanel({ categories }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await base44.functions.invoke('manageFaqQuestions', { action: 'list' });
    setQuestions(r.data?.questions || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? questions : questions.filter(q => q.status === filter);
  const pendingCount = questions.filter(q => q.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {[
          { key: "pending", label: "待回复", count: pendingCount },
          { key: "answered", label: "已回复" },
          { key: "all", label: "全部" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === tab.key ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-sm text-gray-400 py-8">加载中…</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <MessageCircleQuestion className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">暂无{filter === "pending" ? "待回复" : ""}用户提问</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(q => (
          <QuestionAdminItem key={q.id} q={q} categories={categories} onAnswered={load} />
        ))}
      </div>
    </div>
  );
}