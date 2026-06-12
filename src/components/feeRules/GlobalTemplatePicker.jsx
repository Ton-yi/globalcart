/**
 * 全局服务费规则模板选用模块（租户服务费规则中心内）
 * 选取模板 → 复制为本租户草稿规则 → 管理员可再自定义
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, ChevronDown, ChevronUp, Download } from "lucide-react";

const MODE_LABELS = { simple: '简单比例', tiered: '阶梯费率', formula: '高级公式' };
const PHASE_LABELS = { order: '下单服务费', shipping: '发货前服务费' };
const PHASE_COLORS = { order: 'bg-teal-50 text-teal-700', shipping: 'bg-indigo-50 text-indigo-700' };

export default function GlobalTemplatePicker({ onApplied }) {
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    base44.functions.invoke('serviceFeeRuleEngine', { action: 'list_global_templates' })
      .then(res => setTemplates(res.data?.templates || []))
      .catch(() => {});
  }, []);

  if (templates.length === 0) return null;

  const handleApply = async (t) => {
    setApplying(t.id);
    setMsg(null);
    const res = await base44.functions.invoke('serviceFeeRuleEngine', { action: 'apply_global_template', template_id: t.id });
    if (res.data?.error) {
      setMsg({ type: 'error', text: res.data.error });
    } else {
      setMsg({ type: 'success', text: `已套用「${t.name}」为本租户草稿规则，可在下方列表中编辑后启用。` });
      onApplied?.();
    }
    setApplying(null);
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardContent className="py-3 px-4">
        <button className="w-full flex items-center justify-between text-sm font-medium text-orange-800"
          onClick={() => setOpen(o => !o)}>
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />全局规则模板（{templates.length}）
            <span className="text-xs font-normal text-orange-600">选取模板快速套用，再自定义调整</span>
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {open && (
          <div className="mt-3 space-y-2">
            {msg && (
              <p className={`text-xs px-3 py-2 rounded border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {msg.type === 'success' ? '✓ ' : '⚠ '}{msg.text}
              </p>
            )}
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <Badge className={`text-xs ${PHASE_COLORS[t.fee_phase || 'order']}`}>{PHASE_LABELS[t.fee_phase || 'order']}</Badge>
                    <Badge className="text-xs bg-gray-100 text-gray-600">{MODE_LABELS[t.mode]}</Badge>
                  </div>
                  {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => handleApply(t)} disabled={applying === t.id}>
                  <Download className="w-3 h-3 mr-1" />{applying === t.id ? "套用中..." : "套用"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}