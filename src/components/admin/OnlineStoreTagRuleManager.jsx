/**
 * OnlineStoreTagRuleManager
 * Master-detail layout for managing online store tag recognition rules.
 * Left: Detail editing panel
 * Right: List panel with sorting and quick actions
 */
import OnlineStoreTagRuleDetail from "./OnlineStoreTagRuleDetail";
import OnlineStoreTagRuleList from "./OnlineStoreTagRuleList";
import { useOnlineStoreTagRules } from "@/hooks/useOnlineStoreTagRules";

export default function OnlineStoreTagRuleManager() {
  const state = useOnlineStoreTagRules();

  if (state.loading) {
    return <div className="py-8 text-center text-xs text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-700">商城标签识别规则</p>
        <p className="text-xs text-gray-400 mt-0.5">配置 URL 关键字匹配规则，自动识别商品所属商城标签</p>
      </div>
      
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0">
          <OnlineStoreTagRuleDetail state={state} />
        </div>
        <div className="flex-1 min-w-0">
          <OnlineStoreTagRuleList state={state} />
        </div>
      </div>
    </div>
  );
}