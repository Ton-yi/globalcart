import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, RefreshCw, Scale, Calendar, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TIMEOUT_LABELS = {
  ship_individually: "超时单独发货",
  next_consolidation: "加入下次拼邮",
  return_to_storage: "退回暂存",
};

const METHOD_LABELS = {
  EMS: "EMS",
  surface: "海运",
  small_packet_air: "小型包装物空运",
};

export default function ConsolidationPool() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async (u) => {
    setLoading(true);
    const data = await base44.entities.Order.filter(
      { user_email: u.email, consolidation_requested: true },
      "-updated_date",
      100
    );
    // Only show orders that are in notified_shipment or later (active consolidation)
    setOrders(data.filter(o => o.order_status === "notified_shipment"));
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchData(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  // Group by shipping method for display
  const groups = orders.reduce((acc, o) => {
    const key = o.shipping_method || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const totalWeight = orders.reduce((sum, o) => sum + (o.weight_g || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">拼邮池</h1>
          <p className="text-sm text-gray-400 mt-0.5">正在等待凑单的拼邮订单</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(user)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
        </Button>
      </div>

      {/* Summary */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{orders.length}</div>
            <div className="text-xs text-blue-500 mt-0.5">等待拼邮的包裹</div>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-teal-700">{totalWeight}g</div>
            <div className="text-xs text-teal-500 mt-0.5">当前总重量</div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <div className="text-2xl font-bold text-purple-700">{Object.keys(groups).length}</div>
            <div className="text-xs text-purple-500 mt-0.5">发货方式分组</div>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>拼邮池功能正在建设中，更多拼邮管理功能即将上线。目前您可以查看所有待凑单的包裹状态。</p>
      </div>

      {/* Order groups */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <Package className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">暂无等待拼邮的包裹</p>
          <p className="text-xs mt-1">通知发货时选择"申请拼邮"即可加入拼邮池</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([method, groupOrders]) => {
            const groupWeight = groupOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
            const minWeight = Math.max(...groupOrders.map(o => o.consolidation_min_weight_g || 0).filter(Boolean));
            const deadline = groupOrders.map(o => o.consolidation_deadline).filter(Boolean).sort()[0];

            return (
              <div key={method} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-800 text-sm">{METHOD_LABELS[method] || method}</span>
                    <Badge variant="outline" className="text-xs">{groupOrders.length} 件</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Scale className="w-3 h-3" />{groupWeight}g
                      {minWeight > 0 && <span className="text-gray-400">/ 目标 {minWeight}g</span>}
                    </span>
                    {deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{deadline}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {minWeight > 0 && (
                  <div className="px-4 py-2 bg-white border-b">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>凑单进度</span>
                      <span>{groupWeight}g / {minWeight}g</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (groupWeight / minWeight) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-50">
                  {groupOrders.map(o => (
                    <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{o.product_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{o.order_number} · {o.weight_g || 100}g</p>
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right">
                        {o.consolidation_timeout_action && (
                          <span className="text-xs text-gray-400">{TIMEOUT_LABELS[o.consolidation_timeout_action]}</span>
                        )}
                        {o.consolidation_deadline && (
                          <p className="text-xs text-orange-500 mt-0.5">截止 {o.consolidation_deadline}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}