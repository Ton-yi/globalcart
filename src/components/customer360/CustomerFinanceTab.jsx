/**
 * CustomerFinanceTab - 客户财务账目 Tab
 * 应收/实收/未收/退款/货款/服务费/运费/增值服务费/仓储费 + 流水明细 + 记账状态
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LEDGER_TYPE_LABELS = {
  order_payment: { label: "订单收款", color: "bg-green-100 text-green-700" },
  shipping_payment: { label: "发货收款", color: "bg-blue-100 text-blue-700" },
  refund: { label: "退款", color: "bg-red-100 text-red-700" },
};

export default function CustomerFinanceTab({ finance, userProfile, formatCurrency, formatDate }) {
  const f = finance || {};
  const items = [
    { label: "应收金额", value: f.receivableJpy || 0, cls: "bg-blue-50 border-blue-200 text-blue-800" },
    { label: "实收金额", value: f.receivedJpy || 0, cls: "bg-green-50 border-green-200 text-green-800" },
    { label: "未收金额", value: f.outstandingJpy || 0, cls: "bg-red-50 border-red-200 text-red-800" },
    { label: "退款金额", value: f.totalRefundJpy || 0, cls: "bg-red-50 border-red-200 text-red-800" },
    { label: "商品货款", value: f.totalGoodsJpy || 0, cls: "bg-gray-50 border-gray-200 text-gray-800" },
    { label: "服务费", value: f.totalServiceFeeJpy || 0, cls: "bg-purple-50 border-purple-200 text-purple-800" },
    { label: "运费（发货阶段费用）", value: f.shippingStageReceivableJpy || 0, cls: "bg-orange-50 border-orange-200 text-orange-800" },
    { label: "增值服务费", value: f.addonFeeJpy || 0, cls: "bg-purple-50 border-purple-200 text-purple-800" },
    { label: "仓储费", value: f.storageFeeJpy || 0, cls: "bg-orange-50 border-orange-200 text-orange-800" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">财务汇总（JPY）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {items.map(item => (
              <div key={item.label} className={`p-4 border rounded-lg ${item.cls}`}>
                <p className="text-xs font-medium opacity-80">{item.label}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 记账状态 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">记账状态</CardTitle>
        </CardHeader>
        <CardContent>
          {userProfile?.credit_enabled ? (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-indigo-700">记账额度</span>
                <span className="text-sm font-medium text-indigo-900">{formatCurrency(userProfile.credit_limit_jpy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-indigo-700">已用额度</span>
                <span className="text-sm font-medium text-indigo-900">{formatCurrency(userProfile.credit_balance_jpy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-indigo-700">剩余额度</span>
                <span className="text-sm font-medium text-indigo-900">{formatCurrency(Math.max(0, userProfile.credit_limit_jpy - userProfile.credit_balance_jpy))}</span>
              </div>
              {userProfile.credit_cycle && (
                <div className="flex justify-between pt-2 border-t border-indigo-200">
                  <span className="text-sm text-indigo-700">结帐周期</span>
                  <span className="text-sm font-medium text-indigo-900">{userProfile.credit_cycle === 'weekly' ? '周结' : '月结'}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">未开启记账功能</p>
          )}
        </CardContent>
      </Card>

      {/* 流水明细 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">流水明细</CardTitle>
        </CardHeader>
        <CardContent>
          {f.ledger && f.ledger.length > 0 ? (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {f.ledger.map((entry, idx) => {
                const cfg = LEDGER_TYPE_LABELS[entry.type] || { label: entry.type, color: "bg-gray-100 text-gray-700" };
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      <span className="text-sm text-gray-700">{entry.title}</span>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${entry.amount_jpy < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {entry.amount_jpy < 0 ? '-' : '+'}{formatCurrency(Math.abs(entry.amount_jpy))}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">暂无流水记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}