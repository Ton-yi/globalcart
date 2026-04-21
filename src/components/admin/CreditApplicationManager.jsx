/**
 * CreditApplicationManager - Admin panel to review pending credit applications
 * Shown in AdminUsers page and potentially AdminDashboard
 */
import { useState, useEffect } from "react";
import { CreditCard, Check, X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CYCLE_LABELS = { weekly: "周结（7天）", monthly: "月结（月初）" };
const STATUS_LABELS = {
  pending: { label: "待审核", color: "bg-amber-100 text-amber-700" },
  approved: { label: "已通过", color: "bg-green-100 text-green-700" },
  rejected: { label: "已拒绝", color: "bg-red-100 text-red-600" },
};

export default function CreditApplicationManager({ compact = false }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(!compact);
  const [reviewing, setReviewing] = useState(null); // application_id being reviewed
  const [reviewData, setReviewData] = useState({ admin_note: "", override_limit_jpy: "", override_cycle: "" });

  const load = async () => {
    setLoading(true);
    const r = await base44.functions.invoke('manageCreditApplication', { action: 'list' });
    setApplications(r.data?.applications || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingCount = applications.filter(a => a.status === 'pending').length;

  const handleReview = async (app, decision) => {
    setReviewing(app.id + '_' + decision);
    await base44.functions.invoke('manageCreditApplication', {
      action: 'review',
      application_id: app.id,
      decision,
      admin_note: reviewData.admin_note,
      override_limit_jpy: reviewData.override_limit_jpy || undefined,
      override_cycle: reviewData.override_cycle || undefined,
    });
    setReviewing(null);
    setReviewData({ admin_note: "", override_limit_jpy: "", override_cycle: "" });
    await load();
  };

  const pending = applications.filter(a => a.status === 'pending');
  const reviewed = applications.filter(a => a.status !== 'pending');

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800 bg-amber-50"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          记账申请审核
          {pendingCount > 0 && (
            <Badge className="text-xs bg-red-500 text-white">{pendingCount} 待审核</Badge>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t border-amber-200 bg-white">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">加载中...</p>
          ) : pending.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">暂无待审核申请</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pending.map(app => (
                <div key={app.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{app.user_name || app.user_email}</span>
                        <Badge className={`text-xs ${STATUS_LABELS[app.status]?.color}`}>{STATUS_LABELS[app.status]?.label}</Badge>
                        <Badge className="text-xs bg-blue-100 text-blue-700">
                          {app.application_type === 'apply' ? '首次申请记账' : '申请调整额度'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{app.user_email}</p>
                      <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                        <p>申请周期：<span className="font-medium">{CYCLE_LABELS[app.requested_cycle] || app.requested_cycle}</span></p>
                        <p>申请额度：<span className="font-medium">¥{(app.requested_limit_jpy || 0).toLocaleString()} JPY</span></p>
                        {app.reason && <p>申请理由：{app.reason}</p>}
                        <p className="text-gray-400">{new Date(app.created_date).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Review panel */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
                    <p className="text-xs font-medium text-gray-600">审核设置（可覆盖申请值）</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500">实际批准额度（JPY）</Label>
                        <Input type="number" className="mt-1 h-7 text-xs" placeholder={app.requested_limit_jpy}
                          value={reviewData.override_limit_jpy} onChange={e => setReviewData(d => ({ ...d, override_limit_jpy: e.target.value }))} />
                        <p className="text-xs text-gray-400 mt-0.5">留空=使用申请值</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">实际批准周期</Label>
                        <Select value={reviewData.override_cycle || "__same__"} onValueChange={v => setReviewData(d => ({ ...d, override_cycle: v === "__same__" ? "" : v }))}>
                          <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__same__">同申请（{CYCLE_LABELS[app.requested_cycle]}）</SelectItem>
                            <SelectItem value="weekly">周结</SelectItem>
                            <SelectItem value="monthly">月结</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">审核备注（可选）</Label>
                      <Textarea rows={1} className="mt-1 text-xs" placeholder="备注原因..."
                        value={reviewData.admin_note} onChange={e => setReviewData(d => ({ ...d, admin_note: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-xs flex-1"
                        disabled={!!reviewing} onClick={() => handleReview(app, 'approved')}>
                        <Check className="w-3 h-3 mr-1" />
                        {reviewing === app.id + '_approved' ? "处理中..." : "批准"}
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-7 text-xs flex-1"
                        disabled={!!reviewing} onClick={() => handleReview(app, 'rejected')}>
                        <X className="w-3 h-3 mr-1" />
                        {reviewing === app.id + '_rejected' ? "处理中..." : "拒绝"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent reviewed */}
          {!compact && reviewed.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-2">最近已处理（{reviewed.length}）</p>
              <div className="space-y-1.5">
                {reviewed.slice(0, 5).map(app => (
                  <div key={app.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <Badge className={`text-[10px] ${STATUS_LABELS[app.status]?.color}`}>{STATUS_LABELS[app.status]?.label}</Badge>
                    <span>{app.user_name || app.user_email}</span>
                    <span className="text-gray-300">·</span>
                    <span>{app.application_type === 'apply' ? '首次申请' : '调整申请'}</span>
                    <span className="text-gray-300">·</span>
                    <span>{CYCLE_LABELS[app.requested_cycle]}</span>
                    <span className="text-gray-300">·</span>
                    <span>¥{(app.requested_limit_jpy || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}