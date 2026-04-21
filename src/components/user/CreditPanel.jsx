/**
 * CreditPanel - User-facing panel showing credit status, next due date, 
 * and options to apply/adjust credit, or make a payment.
 * Shown in UserPreferences page.
 */
import { useState, useEffect } from "react";
import { CreditCard, Calendar, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CYCLE_LABELS = { weekly: "周结（每周一结算）", monthly: "月结（每月1日结算）" };

export default function CreditPanel({ creditApplicationEnabled }) {
  const [credit, setCredit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyForm, setApplyForm] = useState({
    application_type: "apply",
    requested_cycle: "monthly",
    requested_limit_jpy: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("alipay");
  const [payingCredit, setPayingCredit] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await base44.functions.invoke('manageCreditApplication', { action: 'get_user_credit' });
    setCredit(r.data || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const af = (k, v) => setApplyForm(p => ({ ...p, [k]: v }));

  const handleSubmitApply = async () => {
    if (!applyForm.requested_cycle || !applyForm.requested_limit_jpy) return;
    setSubmitting(true);
    setSubmitMsg(null);
    const r = await base44.functions.invoke('manageCreditApplication', {
      action: 'apply',
      ...applyForm,
      requested_limit_jpy: parseFloat(applyForm.requested_limit_jpy) || 0,
    });
    if (r.data?.error) {
      setSubmitMsg({ type: 'error', text: r.data.error });
    } else {
      setSubmitMsg({ type: 'success', text: '申请已提交，请等待管理员审核。' });
      setShowApplyForm(false);
      await load();
    }
    setSubmitting(false);
  };

  const handlePayCredit = async () => {
    setPayingCredit(true);
    // Generate alipay link for credit balance payment
    const r = await base44.functions.invoke('generateAlipayShippingPoolPayment', {
      creditPayment: true,
      amount_jpy: credit?.credit_balance_jpy || 0,
    });
    const url = r.data?.paymentUrl;
    if (url) window.open(url, '_blank');
    setPayingCredit(false);
  };

  if (loading) {
    return (
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />记账结算
          </CardTitle>
        </CardHeader>
        <CardContent><p className="text-xs text-gray-400">加载中...</p></CardContent>
      </Card>
    );
  }

  const isEnabled = credit?.credit_enabled;
  const hasPending = !!credit?.pending_application;
  const balance = credit?.credit_balance_jpy || 0;
  const limit = credit?.credit_limit_jpy || 0;
  const usagePct = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <CreditCard className="w-4 h-4" />记账结算
          {isEnabled && <Badge className="text-xs bg-green-100 text-green-700">已开启</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credit status display (enabled users) */}
        {isEnabled && (
          <div className="space-y-3">
            {/* Balance overview */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">当前欠款余额</p>
                  <p className="text-2xl font-bold text-blue-800 mt-0.5">
                    ¥{balance.toLocaleString()} <span className="text-sm font-normal">JPY</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-500">欠款上限</p>
                  <p className="text-sm font-semibold text-blue-700">¥{limit.toLocaleString()}</p>
                </div>
              </div>

              {/* Usage bar */}
              {limit > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-blue-500 mb-1">
                    <span>已用 {usagePct.toFixed(0)}%</span>
                    <span>剩余额度 ¥{Math.max(0, limit - balance).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-orange-400' : 'bg-blue-500'}`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-blue-100 text-xs">
                <div>
                  <p className="text-blue-500">结帐周期</p>
                  <p className="font-medium text-blue-800 mt-0.5">
                    {credit.credit_cycle === 'weekly' ? '周结' : '月结'}
                  </p>
                </div>
                {credit.credit_next_due_date && (
                  <div>
                    <p className="text-blue-500 flex items-center gap-1"><Calendar className="w-3 h-3" />下次结帐日</p>
                    <p className="font-medium text-blue-800 mt-0.5">{credit.credit_next_due_date}</p>
                  </div>
                )}
                {credit.credit_start_date && (
                  <div>
                    <p className="text-blue-500">记账开始日</p>
                    <p className="font-medium text-blue-800 mt-0.5">{credit.credit_start_date}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment section */}
            {balance > 0 && (
              <div>
                {!showPayment ? (
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setShowPayment(true)}>
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />立即还款 ¥{balance.toLocaleString()} JPY
                  </Button>
                ) : (
                  <div className="border border-blue-200 rounded-lg p-3 space-y-3 bg-blue-50/30">
                    <p className="text-xs font-medium text-gray-700">选择还款方式</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ value: "alipay", label: "支付宝" }, { value: "other", label: "其他" }].map(m => (
                        <button key={m.value} type="button"
                          onClick={() => setPaymentMethod(m.value)}
                          className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${paymentMethod === m.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {paymentMethod === 'alipay' && (
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={handlePayCredit} disabled={payingCredit}>
                        {payingCredit ? "生成中..." : "生成支付宝还款链接"}
                      </Button>
                    )}
                    {paymentMethod === 'other' && (
                      <p className="text-xs text-gray-500 text-center">请联系客服获取还款账号，完成后告知管理员确认</p>
                    )}
                    <button className="text-xs text-gray-400 hover:text-gray-600 w-full text-center" onClick={() => setShowPayment(false)}>取消</button>
                  </div>
                )}
              </div>
            )}

            {balance === 0 && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-700">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                账单已结清，无欠款
              </div>
            )}

            {/* Adjust button */}
            <Button size="sm" variant="outline" className="w-full text-xs"
              onClick={() => { setApplyForm(p => ({ ...p, application_type: 'adjust' })); setShowApplyForm(true); }}>
              申请调整记账额度/周期
            </Button>
          </div>
        )}

        {/* Not enabled */}
        {!isEnabled && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
              <span>记账功能未开启。开启后可在提交购买需求时选择"记账周结"或"记账月结"付款方式。</span>
            </div>

            {hasPending && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                您的申请正在审核中，请等待管理员处理。
              </div>
            )}

            {!hasPending && creditApplicationEnabled && (
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => { setApplyForm(p => ({ ...p, application_type: 'apply' })); setShowApplyForm(true); }}>
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />申请开启记账功能
              </Button>
            )}

            {!creditApplicationEnabled && (
              <p className="text-xs text-gray-400 text-center">如需开启记账功能，请联系管理员</p>
            )}
          </div>
        )}

        {/* Application form */}
        {showApplyForm && (
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                {applyForm.application_type === 'apply' ? '申请开启记账' : '申请调整记账'}
              </h4>
              <button onClick={() => { setShowApplyForm(false); setSubmitMsg(null); }}>
                <span className="text-gray-400 text-xs">取消</span>
              </button>
            </div>

            <div>
              <Label className="text-xs text-gray-500">申请结帐周期 *</Label>
              <Select value={applyForm.requested_cycle} onValueChange={v => af("requested_cycle", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">周结（每周一结算）</SelectItem>
                  <SelectItem value="monthly">月结（每月1日结算）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-500">申请欠款上限（JPY）*</Label>
              <Input type="number" className="mt-1 h-8 text-sm" placeholder="如：50000"
                value={applyForm.requested_limit_jpy} onChange={e => af("requested_limit_jpy", e.target.value)} />
            </div>

            <div>
              <Label className="text-xs text-gray-500">申请理由</Label>
              <Textarea rows={2} className="mt-1 text-sm" placeholder="简述申请原因（可选）..."
                value={applyForm.reason} onChange={e => af("reason", e.target.value)} />
            </div>

            {submitMsg && (
              <p className={`text-xs px-3 py-2 rounded border ${submitMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {submitMsg.text}
              </p>
            )}

            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmitApply}
              disabled={submitting || !applyForm.requested_cycle || !applyForm.requested_limit_jpy}>
              {submitting ? "提交中..." : "提交申请"}
            </Button>
          </div>
        )}

        {/* Recent application status */}
        {!showApplyForm && credit?.recent_applications?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">申请记录</p>
            {credit.recent_applications.slice(0, 3).map(app => (
              <div key={app.id} className="flex items-center gap-2 text-xs text-gray-500">
                <Badge className={`text-[10px] ${
                  app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  app.status === 'approved' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-600'
                }`}>
                  {app.status === 'pending' ? '审核中' : app.status === 'approved' ? '已通过' : '已拒绝'}
                </Badge>
                <span>{app.application_type === 'apply' ? '开通申请' : '调整申请'}</span>
                <span className="text-gray-300">·</span>
                <span>{app.requested_cycle === 'weekly' ? '周结' : '月结'} ¥{(app.requested_limit_jpy || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}