/**
 * 下单阶段阶梯费率编辑器（追加客户等级选择器和商城标签选择器）
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import CustomerLevelSelector from "./CustomerLevelSelector";
import StoreTagSelector from "./StoreTagSelector";

export default function TieredRuleEditor({
  tiers, onChange,
  customerLevelFilter = [], onCustomerLevelFilterChange,
  storeFilter = [], onStoreFilterChange,
}) {
  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const newFrom = last ? (parseFloat(last.to) || 0) : 0;
    onChange([...tiers, { from: newFrom, to: null, rate: 8, fixed_fee: 0 }]);
  };

  const updateTier = (i, key, val) => {
    onChange(tiers.map((t, idx) => idx === i ? { ...t, [key]: val === '' || val === null ? null : parseFloat(val) || 0 } : t));
  };

  const removeTier = (i) => onChange(tiers.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {/* Customer level filter */}
      <div className="pb-3 border-b border-gray-200">
        <CustomerLevelSelector
          value={customerLevelFilter}
          onChange={onCustomerLevelFilterChange}
          showRateFields={false}
        />
      </div>

      {/* Store tag filter */}
      <div className="pb-3 border-b border-gray-200">
        <label className="text-xs text-gray-500 block mb-1.5">下单网站过滤</label>
        <StoreTagSelector value={storeFilter} onChange={onStoreFilterChange} />
      </div>

      {/* Tiers table */}
      <div className="space-y-3">
        <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 font-medium px-1">
          <span className="col-span-1">下限 ¥</span>
          <span className="col-span-1">上限 ¥</span>
          <span className="col-span-1">费率 %</span>
          <span className="col-span-1">固定费 ¥</span>
          <span></span>
        </div>
        {tiers.map((tier, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-center">
            <Input className="h-8 text-sm" type="number" value={tier.from ?? ''} onChange={e => updateTier(i, 'from', e.target.value)} placeholder="0" />
            <Input className="h-8 text-sm" type="number" value={tier.to ?? ''} onChange={e => updateTier(i, 'to', e.target.value || null)} placeholder="不限" />
            <Input className="h-8 text-sm" type="number" step="0.1" value={tier.rate ?? ''} onChange={e => updateTier(i, 'rate', e.target.value)} placeholder="8" />
            <Input className="h-8 text-sm" type="number" value={tier.fixed_fee ?? ''} onChange={e => updateTier(i, 'fixed_fee', e.target.value)} placeholder="0" />
            <button type="button" onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {tiers.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-3 border border-dashed rounded-lg">尚未添加阶梯，点击下方按钮添加</div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" />添加阶梯
        </Button>
        <p className="text-xs text-gray-400">每个阶梯：上限为空=不设上限。费率和固定费叠加计算。</p>
      </div>
    </div>
  );
}