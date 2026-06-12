import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Star, Gem, Medal, Award, Trophy, Sparkles, Zap, Heart,
  Loader2, CheckCircle2, Clock, ShieldCheck, ArrowUpCircle,
} from "lucide-react";

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
    setPayingId(tier.id);
    setMessage(null);
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
      } else if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
        return;
      }
    } catch (e) {
      setMessage({ type: "error", text: e.response?.data?.error || e.message });
    }
    setPayingId(null);
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
          。购买更高阶级时只需支付与当前阶级的差价。
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
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${tier.color || "bg-gray-100 text-gray-700"}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="font-semibold text-gray-900" style={tier.name_font_color ? { color: tier.name_font_color } : undefined}>
                      {tier.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {tier.price_jpy > 0 ? `标价 ¥${tier.price_jpy.toLocaleString()} JPY` : "免费"}
                      {tier.is_permanent && <span className="ml-1.5 inline-flex items-center gap-0.5"><ShieldCheck className="w-3 h-3" />不再降级</span>}
                    </div>
                  </div>
                </div>
                {tier.description && (
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{tier.description}</p>
                )}
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
                      {tier.purchasable ? "低于当前阶级" : "不开放购买"}
                    </Button>
                  )}
                </div>
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
                const st = STATUS_LABEL[p.status] || STATUS_LABEL.pending;
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
    </div>
  );
}