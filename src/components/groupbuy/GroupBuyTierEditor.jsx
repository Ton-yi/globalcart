/**
 * GroupBuyTierEditor - 运费区间阶梯编辑器
 * Similar to shipping method detailed rate editor
 */
import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function GroupBuyTierEditor({ tiers = [], onChange }) {
  const addTier = () => {
    const id = Date.now().toString();
    onChange([...tiers, {
      id, name: '', min_amount_jpy: 0, max_amount_jpy: 0, shipping_fee_jpy: 0, is_default: tiers.length === 0
    }]);
  };

  const updateTier = (id, key, value) => {
    onChange(tiers.map(t => t.id === id ? { ...t, [key]: value } : t));
  };

  const deleteTier = (id) => {
    const remaining = tiers.filter(t => t.id !== id);
    // If deleted the default, set first as default
    if (remaining.length > 0 && !remaining.some(t => t.is_default)) {
      remaining[0].is_default = true;
    }
    onChange(remaining);
  };

  const setDefault = (id) => {
    onChange(tiers.map(t => ({ ...t, is_default: t.id === id })));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">运费区间阶梯</Label>
        <Button type="button" size="sm" variant="outline" onClick={addTier} className="h-7 text-xs gap-1">
          <Plus className="w-3 h-3" />添加阶梯
        </Button>
      </div>
      {tiers.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg">暂无阶梯，点击上方添加</p>
      )}
      <div className="space-y-2">
        {tiers.map((tier) => (
          <div key={tier.id} className={`bg-white border rounded-lg p-2.5 space-y-2 ${tier.is_default ? 'border-indigo-300' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Input className="h-7 text-xs flex-1" placeholder="阶梯名称（如：满3000免运费）"
                value={tier.name} onChange={e => updateTier(tier.id, 'name', e.target.value)} />
              <button type="button" title="设为默认" onClick={() => setDefault(tier.id)}
                className={`p-1 rounded ${tier.is_default ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                <Star className={`w-3.5 h-3.5 ${tier.is_default ? 'fill-current' : ''}`} />
              </button>
              <button type="button" onClick={() => deleteTier(tier.id)}
                className="p-1 rounded text-gray-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">最低金额 (JPY)</p>
                <Input className="h-7 text-xs" type="number" min={0} placeholder="0"
                  value={tier.min_amount_jpy || ''} onChange={e => updateTier(tier.id, 'min_amount_jpy', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">最高金额 (JPY，0=无上限)</p>
                <Input className="h-7 text-xs" type="number" min={0} placeholder="0"
                  value={tier.max_amount_jpy || ''} onChange={e => updateTier(tier.id, 'max_amount_jpy', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">运费 (JPY，0=免运费)</p>
                <Input className="h-7 text-xs" type="number" min={0} placeholder="0"
                  value={tier.shipping_fee_jpy || ''} onChange={e => updateTier(tier.id, 'shipping_fee_jpy', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            {tier.is_default && (
              <p className="text-[10px] text-indigo-500 flex items-center gap-1"><Star className="w-2.5 h-2.5 fill-current" />默认选项</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}