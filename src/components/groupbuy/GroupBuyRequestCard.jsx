import { Calendar, Users, ShoppingBag, ChevronRight, CheckCircle2, XCircle, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  open:      { label: "招募中",  color: "bg-green-100 text-green-700" },
  completed: { label: "已完成",  color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "已取消",  color: "bg-red-100 text-red-600" },
  expired:   { label: "已过期",  color: "bg-gray-100 text-gray-500" },
};

const ACTION_LABELS = {
  cancel:  "取消订单",
  proceed: "继续单独下单",
};

export default function GroupBuyRequestCard({ request, onClick, myEntryStatus }) {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.open;
  const target = request.condition_min_amount_jpy || 0;
  const current = request.total_amount_jpy || 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 100;
  const isReached = target > 0 ? current >= target : false;
  const daysLeft = Math.ceil((new Date(request.deadline) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div
      onClick={() => onClick?.(request)}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 cursor-pointer transition-all"
    >
      {/* Colored top bar */}
      <div className="h-1.5 w-full" style={{ background: request.template_color || '#6366f1' }} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              {myEntryStatus === 'active' && (
                <Badge className="text-xs bg-purple-100 text-purple-700">已参团</Badge>
              )}
              {myEntryStatus === 'completed' && (
                <Badge className="text-xs bg-blue-100 text-blue-700">已下单</Badge>
              )}
              <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100"
                style={{ color: request.template_color || '#6366f1' }}>
                {request.template_name || '未知店铺'}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">{request.title}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        </div>

        {/* Progress bar */}
        {target > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">拼单进度</span>
              <span className={isReached ? "text-green-600 font-medium" : "text-gray-600"}>
                ¥{Math.round(current).toLocaleString()} / ¥{Math.round(target).toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isReached ? "bg-green-500" : "bg-indigo-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {isReached
              ? <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />已达成！运费 ¥{request.condition_shipping_fee_jpy || 0}</p>
              : <p className="text-xs text-gray-400">还差 ¥{Math.round(target - current).toLocaleString()} 达成</p>
            }
          </div>
        )}

        {/* Info row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />{request.entry_count || 0} 人参团
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {request.deadline}
            {request.status === 'open' && daysLeft >= 0 && (
              <span className={`ml-1 ${daysLeft <= 1 ? "text-red-500 font-medium" : daysLeft <= 3 ? "text-orange-500" : "text-gray-400"}`}>
                （{daysLeft === 0 ? "今天截止" : `还剩${daysLeft}天`}）
              </span>
            )}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <span>by {request.creator_name || request.creator_email}</span>
            {request.transit_location_id && (
              <span className="flex items-center gap-0.5 text-indigo-500">
                <MapPin className="w-3 h-3" />
                {request.transit_location_name}
              </span>
            )}
          </div>
          <span>到期：{ACTION_LABELS[request.on_deadline_action] || request.on_deadline_action}</span>
        </div>
      </div>
    </div>
  );
}