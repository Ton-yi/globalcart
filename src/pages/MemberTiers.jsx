import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Star, Gem, Medal, Award, Trophy, Sparkles, Zap, Heart,
  Loader2, CheckCircle2, Clock, ShieldCheck, ArrowUpCircle, Wallet, Tags,
} from "lucide-react";

import TierPaymentModal from "@/components/membertiers/TierPaymentModal";

const TIER_ICONS = { Crown, Star, Gem, Medal, Award, Trophy, Sparkles, Zap, Heart };

const STATUS_LABEL = {
  pending: { text: "待支付", cls: "bg-yellow-100 text-yellow-700" },
  paid: { text: "已完成", cls: "bg-green-100 text-green-700" },
  cancelled: { text: "已作废", cls: "bg-gray-100 text-gray-500" },
};

export default function MemberTiers() {
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState([]);
  const [currentTier, setCurrentTier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [payingId, setPayingId] = useState(null);
  const [payTier, setPayTier] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    const res = await base44.functions.invoke("purchaseMemberTier", { action: "list" });
    if (res.data?.error) { setMessage({ type: "error", text: res.data.error }); return; }
    setTiers(res.data?.tiers || []);
    setCurrentTier(res.data?.current_tier || null);
    setPurchases(res.data?.purchases || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleBuy = async (tier) => {
    setMessage(null);
    // 有差价 → 打开支付方式选择弹窗；免费升级 → 直接升级
    if ((tier.payable_jpy || 0) > 0) {
      setPayTier(tier);
      return;
    }
    setPayingId(tier.id);
    try {
      const res = await base44.functions.invoke("purchaseMemberTier", {
        action: "create_payment",
        tier_id: tier.id,
      });
      if (res.data?.error) {
        setMessage({ type: "error", text: res.data.error });
      } else if (res.data?.upgraded) {
        setMessage({ type: "success", text: `升级成功！您已成为「${res.data.tier_name}」会员。` });
        await load();
      }
    } catch (e) {
      setMessage({ type: "error", text: e.response?.data?.error || e.message });
    }
    setPayingId(null);
  };

  const handleManualSubmitted = async () => {
    setPayTier(null);
    setMessage({ type: "success", text: "购买申请已提交，管理员确认收款后将为您升级阶级。" });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />会员阶级
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          当前阶级：
          {currentTier ? <span className="font-medium text-gray-800">{currentTier.name}</span> : "普通用户（无阶级）"}
          。以下为各会员阶级的介绍与权益说明。
        </p>
      </div>

      {message && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${
          message.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const Icon = TIER_ICONS[tier.icon] || Crown;
          return (
            <Card key={tier.id} className={`relative ${tier.is_current ? "ring-2 ring-amber-400" : ""}`}>
              {tier.is_current && (
                <Badge className="absolute -top-2 right-3 bg-amber-500 text-white border-0 text-xs">当前阶级</Badge>
              )}
              <CardContent className="pt-5 space-y-3 flex flex-col h-full">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${tier.color || "bg-gray-100 text-gray-700"}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="font-semibold text-gray-900" style={tier.name_font_color ? { color: tier.name_font_color } : undefined}>
                      {tier.name}
                    </div>
                    {tier.purchasable && (
                      <div className="text-xs text-gray-400">
                        {tier.price_jpy > 0 ? `标价 ¥${tier.price_jpy.toLocaleString()} JPY` : "免费"}
                      </div>
                    )}
                  </div>
                </div>

                {tier.description && (
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{tier.description}</p>
                )}

                <ul className="space-y-1.5 flex-1">
                  {tier.is_permanent && (
                    <li className="flex items-start gap-1.5 text-xs text-gray-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      达到后永久保留，不会被自动降级
                    </li>
                  )}
                  {tier.credit_enabled && (
                    <li className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Wallet className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>
                        支持记账消费
                        {tier.credit_limit_jpy > 0 && `，额度 ¥${tier.credit_limit_jpy.toLocaleString()} JPY`}
                        {tier.credit_cycle && `（${tier.credit_cycle === "weekly" ? "周结" : "月结"}）`}
                      </span>
                    </li>
                  )}
                  {(tier.role_names || []).length > 0 && (
                    <li className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Tags className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                      <span className="flex flex-wrap gap-1">
                        专属标签：
                        {tier.role_names.map((n) => (
                          <Badge key={n} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{n}</Badge>
                        ))}
                      </span>
                    </li>
                  )}
                  {!tier.is_permanent && !tier.credit_enabled && (tier.role_names || []).length === 0 && !tier.description && (
                    <li className="text-xs text-gray-400">暂无权益说明</li>
                  )}
                </ul>

                {tier.purchasable && (
                  <div className="pt-1">
                    {tier.is_current ? (
                      <Button size="sm" variant="outline" disabled className="w-full">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />已拥有
                      </Button>
                    ) : tier.can_buy ? (
                      <Button size="sm" className="w-full" disabled={payingId === tier.id} onClick={() => handleBuy(tier)}>
                        {payingId === tier.id
                          ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          : <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />}
                        {tier.payable_jpy > 0 ? `补差价升级 ¥${tier.payable_jpy.toLocaleString()} JPY` : "免费升级"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="w-full text-gray-400">
                        低于当前阶级
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {tiers.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full text-center py-10">暂无会员阶级</p>
        )}
      </div>

      {purchases.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />我的购买记录
            </h2>
            <div className="divide-y divide-gray-100">
              {purchases.map((p) => {
                const isManualPending = p.status === "pending" && p.payment_method && p.payment_method !== "alipay";
                const st = isManualPending
                  ? { text: "待管理员确认", cls: "bg-blue-100 text-blue-700" }
                  : (STATUS_LABEL[p.status] || STATUS_LABEL.pending);
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="text-gray-800">{p.to_tier_name}</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(p.created_date).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">¥{(p.payable_jpy || 0).toLocaleString()} JPY</span>
                      <Badge className={`${st.cls} border-0 text-xs`}>{st.text}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {payTier && (
        <TierPaymentModal
          tier={payTier}
          onClose={() => setPayTier(null)}
          onSuccess={handleManualSubmitted}
        />
      )}
    </div>
  );
}