/**
 * OnlineStoreTagRuleList
 * Right-side list panel for store tag rules with sorting and operations.
 */
import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Eye, EyeOff, Edit2, Plus, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OnlineStoreTagRuleList({ state }) {
  const {
    rules, activeRule, saving,
    handleSelectRule, handleAddRule,
    handleRulesChange,
  } = state;

  const [localRules, setLocalRules] = useState(rules);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalRules([...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0)));
  }, [rules]);

  const moveRule = (index, direction) => {
    const newRules = [...localRules];
    const targetIndex = direction === -1 ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRules.length) return;
    
    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;
    
    // Re-assign priorities based on new order (higher index = lower priority)
    newRules.forEach((rule, idx) => {
      rule.priority = newRules.length - idx;
    });
    
    setLocalRules(newRules);
    setDirty(true);
  };

  const toggleVisibility = (rule) => {
    const newRules = localRules.map(r =>
      r.id === rule.id ? { ...r, is_active: r.is_active !== false ? false : true } : r
    );
    setLocalRules(newRules);
    setDirty(true);
  };

  const handleSave = async () => {
    await handleRulesChange(localRules);
    setDirty(false);
  };

  const canMoveUp = (index) => index > 0;
  const canMoveDown = (index) => index < localRules.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">商城标签识别规则</p>
        <div className="flex gap-2">
          {dirty && (
            <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              保存排序
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAddRule}>
            <Plus className="w-3 h-3 mr-1" />新增规则
          </Button>
        </div>
      </div>

      {localRules.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-6 border border-dashed border-gray-200 rounded-xl">
          暂无规则，点击上方「新增规则」
        </p>
      )}

      <div className="space-y-1">
        {localRules.map((rule, idx) => {
          const isActive = rule.is_active !== false;
          const isSelected = rule.id === activeRule?.id;

          return (
            <div
              key={rule.id}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-colors
                ${isSelected ? "border-orange-300 bg-orange-50" : isActive ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}
                cursor-pointer hover:border-orange-200 hover:bg-orange-50/50
              `}
              onClick={() => handleSelectRule(rule)}
            >
              <Badge className={rule.tag_color || "bg-gray-100 text-gray-700"}>
                {rule.tag_label || "未命名"}
              </Badge>

              <span className="flex-1 text-xs text-gray-500 font-mono truncate">
                {rule.keyword || <span className="text-gray-400 italic">无关键字</span>}
              </span>

              <span className="text-xs text-gray-400">优先级：{rule.priority || 0}</span>

              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  onClick={() => toggleVisibility(rule)} title={isActive ? "禁用" : "启用"}>
                  {isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canMoveUp(idx)} onClick={() => moveRule(idx, -1)} title="上移">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  disabled={!canMoveDown(idx)} onClick={() => moveRule(idx, 1)} title="下移">
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}