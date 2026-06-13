import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircleQuestion, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

const STATUS_MAP = {
  pending:  { label: "待回复", color: "bg-yellow-100 text-yellow-700" },
  answered: { label: "已回复", color: "bg-green-100 text-green-700" },
  closed:   { label: "已关闭", color: "bg-gray-100 text-gray-500" },
};

function QuestionItem({ q, onRead }) {
  const [open, setOpen] = useState(q.unread_by_user);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && q.unread_by_user) {
      await base44.functions.invoke('manageFaqQuestions', { action: 'mark_read', id: q.id });
      onRead?.(q.id);
    }
  };

  const st = STATUS_MAP[q.status] || STATUS_MAP.pending;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-start justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors gap-2"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
            {q.unread_by_user && q.status === 'answered' && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">新回复</span>
            )}
            <span className="text-xs text-gray-400">{q.category_title || "未分类"}</span>
          </div>
          <p className="text-sm text-gray-800 mt-1 font-medium truncate">{q.question}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-gray-50 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">您的问题</p>
            <p className="text-sm text-gray-700">{q.question}</p>
          </div>
          {q.answer ? (
            <div>
              <p className="text-xs text-gray-400 mb-1">管理员回复</p>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <ReactMarkdown className="prose prose-sm max-w-none text-gray-700">{q.answer}</ReactMarkdown>
              </div>
              {q.answered_at && (
                <p className="text-xs text-gray-400 mt-1">{new Date(q.answered_at).toLocaleString('zh-CN')}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">管理员尚未回复，请耐心等待…</p>
          )}
          <p className="text-xs text-gray-300">
            提问时间：{new Date(q.created_date).toLocaleString('zh-CN')}
          </p>
        </div>
      )}
    </div>
  );
}

export default function MyFaqQuestionsCard() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await base44.functions.invoke('manageFaqQuestions', { action: 'list' });
    setQuestions(r.data?.questions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRead = (id) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, unread_by_user: false } : q));
  };

  const unreadCount = questions.filter(q => q.unread_by_user && q.status === 'answered').length;

  if (!loading && questions.length === 0) return null;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-teal-500" />
          我的历史提问
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs px-1.5">{unreadCount} 新回复</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">加载中…</p>
        ) : (
          <div className="space-y-2">
            {questions.map(q => (
              <QuestionItem key={q.id} q={q} onRead={handleRead} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}