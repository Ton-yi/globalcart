/**
 * TierEvaluateCard - 立即评估全员会员阶级
 * 调用 evaluateTierTriggers (evaluate_all) 并展示升降级结果
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Crown, Play, ArrowUp, ArrowDown } from "lucide-react";

export default function TierEvaluateCard({ onChanged }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('evaluateTierTriggers', { action: 'evaluate_all' });
      setResult({ ok: true, evaluated: res.data?.evaluated ?? 0, changes: res.data?.changes || [] });
      if ((res.data?.changes || []).length > 0) onChanged?.();
    } catch (e) {
      setResult({ ok: false, msg: e?.response?.data?.error || '评估失败，请稍后重试' });
    }
    setRunning(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
      <div className="flex items-center gap-3">
        <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700">全员阶级评估</p>
          <p className="text-xs text-gray-400 mt-0.5">根据触发条件立即评估所有用户的阶级升降级（日常变更已自动评估）</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
          <Play className={`w-3.5 h-3.5 mr-1 ${running ? 'animate-pulse' : ''}`} />
          {running ? "评估中..." : "立即评估"}
        </Button>
      </div>
      {result && (
        <div className="mt-2 ml-7">
          {result.ok ? (
            <>
              <p className="text-xs text-green-600">
                已评估 {result.evaluated} 位用户，{result.changes.length > 0 ? `${result.changes.length} 位阶级发生变更：` : '无阶级变更'}
              </p>
              {result.changes.map((c, i) => (
                <p key={i} className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                  {c.direction === 'upgrade'
                    ? <ArrowUp className="w-3 h-3 text-green-500" />
                    : <ArrowDown className="w-3 h-3 text-orange-500" />}
                  {c.user_email}：{c.from || '（无）'} → {c.to}
                </p>
              ))}
            </>
          ) : (
            <p className="text-xs text-red-500">{result.msg}</p>
          )}
        </div>
      )}
    </div>
  );
}