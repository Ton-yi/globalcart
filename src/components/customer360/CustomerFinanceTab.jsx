/**
 * CustomerFinanceTab - 客户财务账目 Tab
 * 应收/实收/未收/退款/货款/服务费/运费/增值服务费/仓储费 + 流水明细 + 记账状态
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tenantEntity } from "@/lib/tenantApi";
import CreditPanel from "@/components/user/CreditPanel";

const LEDGER_TYPE_LABELS = {
  order_payment: { label: "订单收款", color: "bg-green-100 text-green-700" },
  shipping_payment: { label: "发货收款", color: "bg-blue-100 text-blue-700" },
  refund: { label: "退款", color: "bg-red-100 text-red-700" },
};

// 支付方式标签（用于偏好统计显示）
const PAYMENT_MODE_LABELS = {
  fullpay_once: "一次付款",
  credit: "记账",
  deferred: "后付款",
  prepay: "预付款",
};

export default function CustomerFinanceTab({ finance, userProfile, metrics, formatCurrency, formatDate, isOwnProfile = false }) {
  const f = finance || {};
  const [creditAppEnabled, setCreditAppEnabled] = useState(false);

  useEffect(() => {
    if (!isOwnProfile) return;
    tenantEntity.list('SiteSettings', { key: 'credit_application_enabled' })
      .then(rows => setCreditAppEnabled(rows?.[0]?.value === 'true'))
      .catch(() => {});
  }, [isOwnProfile]);
  const items = [
    { label: "应收金额", value: f.receivableJpy || 0, cls: "bg-blue-50 border-blue-200 text-blue-800" },
    { label: "实收金额", value: f.receivedJpy || 0, cls: "bg-green-50 border-green-200 text-green-800" },
    { label: "记账挂账（未还）", value: f.creditOutstandingJpy || 0, cls: "bg-indigo-50 border-indigo-200 text-indigo-800" },
    { label: "未收金额", value: f.outstandingJpy || 0, cls: "bg-red-50 border-red-200 text-red-800" },
    { label: "退款金额", value: f.totalRefundJpy || 0, cls: "bg-red-50 border-red-200 text-red-800" },
    { label: "商品货款", value: f.totalGoodsJpy || 0, cls: "bg-gray-50 border-gray-200 text-gray-800" },
    { label: "服务费", value: f.totalServiceFeeJpy || 0, cls: "bg-purple-50 border-purple-200 text-purple-800" },
    { label: "运费（发货阶段费用）", value: f.shippingStageReceivableJpy || 0, cls: "bg-orange-50 border-orange-200 text-orange-800" },
    { label: "增值服务费", value: f.addonFeeJpy || 0, cls: "bg-purple-50 border-purple-200 text-purple-800" },
    { label: "仓储费", value: f.storageFeeJpy || 0, cls: "bg-orange-50 border-orange-200 text-orange-800" },
  ];

  // 付款时间格式化
  const fmtHours = (h) => {
    if (h === null || h === undefined) return "—";
    if (h < 1) return `${Math.round(h * 60)} 分钟`;
    if (h < 24) return `${h.toFixed(1)} 小时`;
    return `${(h / 24).toFixed(1)} 天`;
  };

  return (
    <div className="space-y-4">
      {/* 付款时间统计 */}
      {(metrics?.avgGoodsPayHours !== null || metrics?.avgShippingPayHours !== null || metrics?.timeoutCancelledCount > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">付款行为分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                <p className="text-xs text-blue-600 font-medium">平均付货款时间</p>
                <p className="text-xl font-bold text-blue-800 mt-1">{fmtHours(metrics?.avgGoodsPayHours)}</p>
                <p className="text-xs text-blue-500 mt-0.5">从下单到完成付货款</p>
              </div>
              <div className="p-3 border rounded-lg bg-purple-50 border-purple-200">
                <p className="text-xs text-purple-600 font-medium">平均付运费时间</p>
                <p className="text-xl font-bold text-purple-800 mt-1">{fmtHours(metrics?.avgShippingPayHours)}</p>
                <p className="text-xs text-purple-500 mt-0.5">从创建发货申请到付运费</p>
              </div>
              <div className={`p-3 border rounded-lg ${(metrics?.timeoutCancelledCount || 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs font-medium ${(metrics?.timeoutCancelledCount || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>超时取消订单数</p>
                <p className={`text-xl font-bold mt-1 ${(metrics?.timeoutCancelledCount || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>{metrics?.timeoutCancelledCount ?? 0}</p>
                <p className="text-xs text-gray-400 mt-0.5">因付款超时被自动取消</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* 记账状态 / 记账结算 */}
      {isOwnProfile ? (
        // 本人查看：完整记账结算面板（申请开通记账、申请提升额度/调整、还款等）
        <CreditPanel creditApplicationEnabled={creditAppEnabled} />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">记账状态</CardTitle>
          </CardHeader>
          <CardContent>
            {userProfile?.credit_enabled ? (() => {
              const limit = userProfile.credit_limit_jpy || 0;
              const balance = userProfile.credit_balance_jpy || 0;
              const usagePct = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;
              return (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">当前欠款余额</p>
                      <p className="text-2xl font-bold text-blue-800 mt-0.5">{formatCurrency(balance)} <span className="text-sm font-normal">JPY</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-500">欠款上限</p>
                      <p className="text-sm font-semibold text-blue-700">{formatCurrency(limit)}</p>
                    </div>
                  </div>
                  {limit > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-blue-500 mb-1">
                        <span>已用 {usagePct.toFixed(0)}%</span>
                        <span>剩余额度 {formatCurrency(Math.max(0, limit - balance))}</span>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-orange-400' : 'bg-blue-500'}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {userProfile.credit_cycle && (
                    <div className="pt-2 border-t border-blue-100 text-xs">
                      <span className="text-blue-500">结帐周期：</span>
                      <span className="font-medium text-blue-800">{userProfile.credit_cycle === 'weekly' ? '周结' : '月结'}</span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <p className="text-sm text-gray-400">未开启记账功能</p>
            )}
          </CardContent>
        </Card>
      )}

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