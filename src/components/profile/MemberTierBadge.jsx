/**
 * MemberTierBadge — 用户端会员阶级展示徽章
 * 按阶级配置渲染颜色 + 图标 + 不再降级标识，可附带「升级阶级」入口。
 */
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import {
  Crown, Star, Gem, Medal, Award, Trophy, Sparkles, Zap, Heart,
  ShieldCheck, ArrowUpCircle,
} from "lucide-react";

const TIER_ICONS = { Crown, Star, Gem, Medal, Award, Trophy, Sparkles, Zap, Heart };

export default function MemberTierBadge({ tier, showUpgradeLink = false }) {
  if (!tier?.name) return null;
  const Icon = TIER_ICONS[tier.icon] || Crown;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <Badge className={`${tier.color || "bg-blue-100 text-blue-700"} text-xs border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {tier.name}
        {tier.is_permanent && <ShieldCheck className="w-3 h-3 ml-1" title="不再降级" />}
      </Badge>
      {showUpgradeLink && (
        <Link
          to={createPageUrl("MemberTiers")}
          className="inline-flex items-center gap-0.5 text-xs text-amber-600 hover:text-amber-700 hover:underline"
        >
          <ArrowUpCircle className="w-3 h-3" />
          升级阶级
        </Link>
      )}
    </span>
  );
}