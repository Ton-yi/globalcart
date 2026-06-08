import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";

const CYCLE_LABELS = { weekly: "周结（7天）", monthly: "月结（月初）" };
const STATUS_LABELS = {
  pending: { label: "待审核", color: "bg-amber-100 text-amber-700" },
  approved: { label: "已通过", color: "bg-green-100 text-green-700" },
  rejected: { label: "已拒绝", color: "bg-red-100 text-red-600" },
};

export default function CreditApplicationModal({ user, onClose }) {
  const [applications, setApplications] = useState([]);
  const [memberTiers, setMemberTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [reviewData, setReviewData] = useState({ admin_note: "", override_limit_jpy: "", override_cycle: "", member_tier_id: "" });

  useEffect(() => {
    loadData();
  }, [user.email]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsRes, settingsRes] = await Promise.all([
        base44.functions.invoke('manageCreditApplication', { action: 'list' }),
        base44.functions.invoke('getAdminSettingsPageData', {}).catch(() => ({ data: { memberTiers: [] } })),
      ]);
      const userApps = (appsRes.data?.applications || []).filter(a => a.user_email === user.email);
      setApplications(userApps);
      setMemberTiers(settingsRes.data?.memberTiers || []);
    } catch (err) {
      console.error('Load credit data error:', err);
    }
    setLoading(false);
  };

  const handleReview = async (app, decision) => {
    setReviewing(app.id + '_' + decision);
    try {
      await base44.functions.invoke('manageCreditApplication', {
        action: 'review',
        application_id: app.id,
        decision,
        admin_note: reviewData.admin_note,
        override_limit_jpy: reviewData.override_limit_jpy || undefined,
        override_cycle: reviewData.override_cycle || undefined,
      });
      if (decision === 'approved' && reviewData.member_tier_id) {
        const tier = memberTiers.find(t => t.id === reviewData.member_tier_id);
        await base44.functions.invoke('manageCreditApplication', {
          action: 'admin_update_user_credit',
          target_user_email: app.user_email,
          member_tier_id: reviewData.member_tier_id,
          member_tier_name: tier?.name || "",
        });
      }
      setReviewData({ admin_note: "", override_limit_jpy: "", override_cycle: "", member_tier_id: "" });
      await loadData();
    } catch (err) {
      console.error('Review error:', err);
    }
    setReviewing(null);
  };

  const pendingApps = applications.filter(a => a.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b flex items-center justify-between p-4">
          <h3 className="font-semibold text-gray-900">记账申请记录</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8 text-gray-400">暂无申请记录</div>
          ) : (
            <div className="space-y-3">
              {applications.map(app => (
                <div key={app.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {app.application_type === 'apply' ? '首次申请' : app.application_type === 'adjust' ? '调整申请' : '关闭申请'}
                      </span>
                      <Badge className={`text-xs ${STATUS_LABELS[app.status]?.color}`}>{STATUS_LABELS[app.status]?.label}</Badge>
                    </div>
                    {app.reviewed_at && <span className="text-xs text-gray-400">{new Date(app.reviewed_at).toLocaleDateString('zh-CN')}</span>}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1 mb-3">
                    <p>周期：{CYCLE_LABELS[app.requested_cycle]}</p>
                    <p>额度：¥{(app.requested_limit_jpy || 0).toLocaleString()} JPY</p>
                    {app.reason && <p>理由：{app.reason}</p>}
                    {app.admin_note && <p className="text-xs bg-blue-50 p-1.5 rounded text-blue-700">备注：{app.admin_note}</p>}
                  </div>

                  {app.status === 'pending' && (
                    <div className="bg-amber-50 border border-amber-100 rounded p-2.5 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-xs text-gray-600 block mb-1">覆盖额度（可选）</Label>
                          <Input type="number" placeholder="¥" className="h-7 text-xs"
                            value={reviewData.override_limit_jpy} onChange={e => setReviewData(d => ({ ...d, override_limit_jpy: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 block mb-1">覆盖周期（可选）</Label>
                          <Select value={reviewData.override_cycle || "__same__"} onValueChange={v => setReviewData(d => ({ ...d, override_cycle: v === "__same__" ? "" : v }))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="保持申请" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__same__">保持申请</SelectItem>
                              <SelectItem value="weekly">周结</SelectItem>
                              <SelectItem value="monthly">月结</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 block mb-1">分配会员层级（批准时）</Label>
                        <Select value={reviewData.member_tier_id || ""} onValueChange={v => setReviewData(d => ({ ...d, member_tier_id: v }))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="可选" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>不分配</SelectItem>
                            {memberTiers.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700"
                          disabled={!!reviewing} onClick={() => handleReview(app, 'approved')}>
                          <Check className="w-3 h-3 mr-0.5" />批准
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={!!reviewing} onClick={() => handleReview(app, 'rejected')}>
                          <X className="w-3 h-3 mr-0.5" />拒绝
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}