import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageCirclePlus, Send, ChevronDown, ChevronUp } from "lucide-react";

export default function AskQuestionForm({ categories, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [categoryId, setCategoryId] = useState("unclassified");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const categoryOptions = [
    { id: "unclassified", title: "未分类" },
    ...(categories || []).filter(c => c.is_active !== false),
  ];

  const handleSubmit = async () => {
    if (!question.trim()) { setError("请输入您的问题"); return; }
    setError("");
    setSubmitting(true);
    const cat = categoryOptions.find(c => c.id === categoryId);
    const r = await base44.functions.invoke('manageFaqQuestions', {
      action: 'submit',
      data: {
        question: question.trim(),
        category_id: categoryId,
        category_title: cat?.title || "未分类",
      },
    });
    setSubmitting(false);
    if (r.data?.success) {
      setSubmitted(true);
      setQuestion("");
      setCategoryId("unclassified");
      onSubmitted?.();
      setTimeout(() => { setSubmitted(false); setOpen(false); }, 3000);
    } else {
      setError(r.data?.error || "提交失败，请稍后再试");
    }
  };

  return (
    <div className="border border-teal-200 rounded-xl overflow-hidden bg-teal-50/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-teal-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCirclePlus className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-medium text-teal-700">没有找到答案？向我们提问</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-teal-400" /> : <ChevronDown className="w-4 h-4 text-teal-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-teal-100">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm text-teal-700 font-medium">问题已提交！</p>
              <p className="text-xs text-gray-500 mt-1">管理员收到通知后将尽快回复，回复后您会收到站内通知。</p>
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">选择问题分类</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">您的问题</Label>
                <Textarea
                  className="resize-none text-sm"
                  rows={3}
                  placeholder="请尽量详细描述您的问题…"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                size="sm"
                className="w-full bg-teal-600 hover:bg-teal-700 h-8 text-xs"
                onClick={handleSubmit}
                disabled={submitting || !question.trim()}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {submitting ? "提交中…" : "提交问题"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}