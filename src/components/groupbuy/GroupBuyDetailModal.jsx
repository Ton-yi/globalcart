/**
 * GroupBuyDetailModal - 拼下单申请详情弹窗
 * Users: view details, join if not joined, cancel own entry
 * Admins: complete (convert to orders) or cancel the whole request
 */
import { useState, useRef } from "react";
import { X, Users, Calendar, ShoppingBag, CheckCircle2, XCircle, Loader2, Trash2, DollarSign, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import GroupBuyJoinForm from "./GroupBuyJoinForm";

const STATUS_CONFIG = {
  open:      { label: "招募中", color: "bg-green-100 text-green-700" },
  completed: { label: "已完成", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-600" },
  expired:   { label: "已过期", color: "bg-gray-100 text-gray-500" },
};

export default function GroupBuyDetailModal({ request, entries = [], currentUser, isAdmin, onClose, onRefresh, templates = [] }) {
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [actualShippingFee, setActualShippingFee] = useState('');
  const [feeOverrides, setFeeOverrides] = useState({});
  const [adminNote, setAdminNote] = useState('');
  const modalRef = useRef(null);
  const contentRef = useRef(null);

  const activeEntries = entries.filter(e => e.status === 'active');
  const myEntry = entries.find(e => e.user_email === currentUser?.email && e.status === 'active');
  const myCompletedEntry = entries.find(e => e.user_email === currentUser?.email && e.status === 'completed');

  const target = request.condition_min_amount_jpy || 0;
  const current = request.total_amount_jpy || 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 100;
  const isReached = target > 0 ? current >= target : false;

  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.open;

  // Calculate auto-split fee
  const shippingFeeNum = parseFloat(actualShippingFee) || 0;
  const defaultShare = activeEntries.length > 0 ? Math.round(shippingFeeNum / activeEntries.length) : 0;

  const handleCancelEntry = async () => {
    if (!myEntry || !confirm('确定退出此拼单？')) return;
    await base44.functions.invoke('manageGroupBuy', { action: 'cancel_entry', entry_id: myEntry.id });
    onRefresh?.();
  };

  const handleComplete = async () => {
    if (!actualShippingFee && actualShippingFee !== '0') return;
    setCompleting(true);
    const overrides = Object.entries(feeOverrides)
      .filter(([, v]) => v !== '')
      .map(([entry_id, allocated_fee_jpy]) => ({ entry_id, allocated_fee_jpy: parseFloat(allocated_fee_jpy) || 0 }));
    await base44.functions.invoke('manageGroupBuy', {
      action: 'complete_request', request_id: request.id,
      actual_shipping_fee_jpy: parseFloat(actualShippingFee) || 0,
      fee_overrides: overrides, admin_note: adminNote,
    });
    setCompleting(false);
    onRefresh?.();
    onClose?.();
  };

  const handleCancelRequest = async () => {
    if (!confirm('确定取消此拼单申请？所有参团用户的条目将一并取消。')) return;
    setCancelling(true);
    await base44.functions.invoke('manageGroupBuy', { action: 'cancel_request', request_id: request.id });
    setCancelling(false);
    onRefresh?.();
    onClose?.();
  };

  const handleBackdropMouseDown = (e) => {
    // Close only if mousedown started outside the content box
    if (e.target === modalRef.current) {
      onClose?.();
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={contentRef}
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              <span className="text-xs px-2 py-0.5 rounded-full text-white text-[11px] font-medium"
                style={{ backgroundColor: request.template_color || '#6366f1' }}>
                {request.template_name}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 truncate">{request.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              创建者：{request.creator_name || request.creator_email} · 截止：{request.deadline}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Condition summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <p className="text-sm text-indigo-800 font-medium">
              在 <strong>{request.deadline}</strong> 之前，
              {target > 0 ? (
                <>满 <strong>¥{Math.round(target).toLocaleString()}</strong> 时下单（运费约 <strong>¥{request.condition_shipping_fee_jpy || 0}</strong>）</>
              ) : '达到拼单条件时下单'}，
              未下单则
              <strong>{request.on_deadline_action === 'cancel' ? '取消订单' : '继续单独下单'}</strong>
            </p>
          </div>

          {/* Progress */}
          {target > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 font-medium">拼单进度</span>
                <span className={isReached ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                  ¥{Math.round(current).toLocaleString()} / ¥{Math.round(target).toLocaleString()}
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isReached ? "bg-green-500" : "bg-indigo-400"}`}
                  style={{ width: `${pct}%`, background: isReached ? '#22c55e' : (request.template_color || '#6366f1') }} />
              </div>
              {isReached
                ? <p className="text-sm text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />已达成拼单条件！</p>
                : <p className="text-sm text-gray-400">还差 ¥{Math.round(target - current).toLocaleString()} 达成</p>
              }
            </div>
          )}

          {/* My entry status */}
          {myEntry && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-purple-800">我的参团条目</p>
                <p className="text-sm text-purple-700 mt-0.5">{myEntry.product_name} · ¥{Math.round(myEntry.estimated_jpy).toLocaleString()}</p>
                {myEntry.product_description && <p className="text-xs text-purple-500 mt-0.5">{myEntry.product_description}</p>}
              </div>
              {request.status === 'open' && (
                <Button size="sm" variant="outline" onClick={handleCancelEntry}
                  className="text-xs border-red-200 text-red-500 hover:bg-red-50 h-7">
                  退出拼单
                </Button>
              )}
            </div>
          )}
          {myCompletedEntry && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />已成功参团下单</p>
              <p className="text-xs text-blue-600 mt-0.5">订单号：{myCompletedEntry.order_number} · 分配运费：¥{myCompletedEntry.allocated_shipping_fee_jpy || 0}</p>
            </div>
          )}

          {/* Join button */}
          {request.status === 'open' && !myEntry && !myCompletedEntry && (
            <div>
              {showJoinForm ? (
                <GroupBuyJoinForm
                  request={request}
                  currentUser={currentUser}
                  onSuccess={() => { setShowJoinForm(false); onRefresh?.(); }}
                  onCancel={() => setShowJoinForm(false)}
                  templates={templates}
                  currentTemplateId={request.template_id}
                />
              ) : (
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowJoinForm(true)}>
                  <ShoppingBag className="w-4 h-4 mr-2" />加入此拼单
                </Button>
              )}
            </div>
          )}

          {/* Participants */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />参团条目（{activeEntries.length} 人）
            </h3>
            {activeEntries.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">暂无参团</p>
            ) : (
              <div className="space-y-2">
                {activeEntries.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800 truncate">{entry.user_name || entry.user_email}</span>
                        {entry.user_email === currentUser?.email && <Badge className="text-[10px] bg-purple-100 text-purple-600">我</Badge>}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{entry.product_name}</p>
                      {entry.product_description && <p className="text-xs text-gray-400 truncate">{entry.product_description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-800">¥{Math.round(entry.estimated_jpy).toLocaleString()}</p>
                      {/* Admin: override fee input */}
                      {isAdmin && showCompleteForm && (
                        <Input className="mt-1 h-6 text-xs w-20 text-right"
                          placeholder={String(defaultShare)}
                          value={feeOverrides[entry.id] ?? ''}
                          onChange={e => setFeeOverrides(o => ({ ...o, [entry.id]: e.target.value }))} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin: complete form */}
          {isAdmin && request.status === 'open' && activeEntries.length > 0 && (
            <div className="border border-orange-200 rounded-xl p-3 bg-orange-50/40 space-y-3">
              <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />完成拼单
              </h4>
              {showCompleteForm ? (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">实际运费总计（JPY）*</Label>
                    <Input className="mt-1 h-8 text-sm" type="number" min={0}
                      placeholder="0（免运费也请填0）"
                      value={actualShippingFee} onChange={e => setActualShippingFee(e.target.value)} />
                    {shippingFeeNum > 0 && activeEntries.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">默认平分：每人 ¥{defaultShare}（可在上方条目处单独修改）</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">管理员备注</Label>
                    <Textarea className="mt-1 text-sm" rows={2} value={adminNote}
                      onChange={e => setAdminNote(e.target.value)} placeholder="可选..." />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleComplete}
                      disabled={completing || (actualShippingFee === '' && actualShippingFee !== '0')}
                      className="bg-orange-600 hover:bg-orange-700 text-xs h-8">
                      {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      确认完成 · 为 {activeEntries.length} 位用户生成订单
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCompleteForm(false)} className="text-xs h-8">取消</Button>
                  </div>
                </>
              ) : (
                <Button size="sm" onClick={() => setShowCompleteForm(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-xs h-8">
                  一键完成拼单下单
                </Button>
              )}
            </div>
          )}

          {/* Admin: cancel button */}
          {isAdmin && request.status === 'open' && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline"
                onClick={handleCancelRequest} disabled={cancelling}
                className="text-xs text-red-500 border-red-200 hover:bg-red-50 h-7">
                {cancelling ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                取消拼单申请
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}