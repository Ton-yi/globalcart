/**
 * MemberStatsScanCard - 会员统计数据手动全局扫描卡片
 * 放置在 MemberTierManager 顶部，管理员可手动触发全量扫描
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database } from "lucide-react";

export default function MemberStatsScanCard() {
  const [scanning, setScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState(null);
  const [statsCount, setStatsCount] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    base44.functions.invoke('recalculateMemberStats', { action: 'status' })
      .then(res => {
        setLastScanAt(res.data?.last_scan_at || null);
        setStatsCount(res.data?.stats_count ?? null);
      })
      .catch(() => {});
  }, []);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('recalculateMemberStats', { action: 'scan_all' });
      setLastScanAt(res.data?.last_scan_at || new Date().toISOString());
      setStatsCount(res.data?.scanned ?? null);
      setResult({ ok: true, msg: `扫描完成，已更新 ${res.data?.scanned ?? 0} 位用户的统计数据` });
    } catch (e) {
      setResult({ ok: false, msg: e?.response?.data?.error || '扫描失败，请稍后重试' });
    }
    setScanning(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 flex items-center gap-3">
      <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">会员统计数据（自动触发的判断依据）</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {lastScanAt
            ? `上次全量扫描：${new Date(lastScanAt).toLocaleString('zh-CN')}${statsCount != null ? ` · ${statsCount} 位用户` : ''}`
            : '尚未执行过全量扫描'}
        </p>
        {result && (
          <p className={`text-xs mt-0.5 ${result.ok ? 'text-green-600' : 'text-red-500'}`}>{result.msg}</p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning}>
        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${scanning ? 'animate-spin' : ''}`} />
        {scanning ? "扫描中..." : "全量扫描"}
      </Button>
    </div>
  );
}