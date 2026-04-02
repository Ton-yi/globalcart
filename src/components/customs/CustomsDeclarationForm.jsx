/**
 * CustomsDeclarationForm
 *
 * Used by users when customs_declaration_mode = 'user_fill'.
 * Embedded in the ShipmentRequest creation/submission flow.
 *
 * Props:
 *   value: { items, dangerous_goods_confirmed, undeliverable_instruction, return_method }
 *   onChange: (value) => void
 *   dangerousGoodsText: string (markdown from settings)
 *   readOnly?: boolean
 */
import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactMarkdown from "react-markdown";

const CURRENCIES = ["JPY", "USD", "CNY", "EUR", "TWD", "HKD", "SGD", "GBP"];
const ITEM_TYPES = [
  { v: "gift", l: "Gift" },
  { v: "merchandise", l: "Merchandise" },
  { v: "sample", l: "Sample" },
  { v: "documents", l: "Documents" },
  { v: "other", l: "Other" },
];

const UNDELIVERABLE_OPTIONS = [
  { v: "return_to_sender", l: "退回发件方 (Return to Sender)" },
  { v: "abandon", l: "放弃（就地销毁）(Abandon)" },
  { v: "forward_to_other_address", l: "转寄到其他地址 (Forward to Other Address)" },
];

const RETURN_METHODS = [
  { v: "air", l: "空运 (Air)" },
  { v: "most_economical_route", l: "最经济路线 (Most Economical Route)" },
];

const ENGLISH_ONLY_RE = /^[A-Za-z0-9\s\-\/&,.()'"]*$/;

function emptyItem() {
  return { item_name_en: "", unit_price: "", currency: "JPY", quantity: 1, weight_g: "", item_type: "gift", total_value: "" };
}

export default function CustomsDeclarationForm({ value, onChange, dangerousGoodsText, readOnly = false }) {
  const items = value?.items || [emptyItem()];
  const dangerousConfirmed = value?.dangerous_goods_confirmed || false;
  const undeliverable = value?.undeliverable_instruction || "";
  const returnMethod = value?.return_method || "";

  const update = (patch) => onChange({ ...value, ...patch });

  const updateItem = (idx, patch) => {
    const next = items.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      // Auto-calculate total
      const up = parseFloat(merged.unit_price) || 0;
      const q = parseFloat(merged.quantity) || 0;
      merged.total_value = up > 0 && q > 0 ? Math.round(up * q * 100) / 100 : "";
      return merged;
    });
    update({ items: next });
  };

  const addItem = () => update({ items: [...items, emptyItem()] });

  const removeItem = (idx) => {
    if (items.length === 1) return;
    update({ items: items.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      {/* Items table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-700">申报物品清单 (Customs Items)</Label>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}>
              <Plus className="w-3 h-3 mr-1" />添加物品
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const nameError = item.item_name_en && !ENGLISH_ONLY_RE.test(item.item_name_en);
            return (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">物品 #{idx + 1}</span>
                  {!readOnly && items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500">英文物品名称 (Item Name in English) *</Label>
                    <Input
                      className={`mt-0.5 h-8 text-sm ${nameError ? "border-red-400" : ""}`}
                      placeholder="e.g. Plush Toy, T-Shirt, Book"
                      value={item.item_name_en}
                      disabled={readOnly}
                      onChange={e => updateItem(idx, { item_name_en: e.target.value })}
                    />
                    {nameError && (
                      <p className="text-xs text-red-500 mt-0.5">请只填写英文字符</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">物品类型 (Item Type)</Label>
                    <Select value={item.item_type} disabled={readOnly} onValueChange={v => updateItem(idx, { item_type: v })}>
                      <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">货币</Label>
                    <Select value={item.currency} disabled={readOnly} onValueChange={v => updateItem(idx, { currency: v })}>
                      <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">单价 (Unit Price) *</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      className="mt-0.5 h-8 text-sm"
                      placeholder="0"
                      value={item.unit_price}
                      disabled={readOnly}
                      onChange={e => updateItem(idx, { unit_price: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">数量 (Quantity) *</Label>
                    <Input
                      type="number" min="1" step="1"
                      className="mt-0.5 h-8 text-sm"
                      placeholder="1"
                      value={item.quantity}
                      disabled={readOnly}
                      onChange={e => updateItem(idx, { quantity: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">重量 (Weight g) *</Label>
                    <Input
                      type="number" min="0" step="1"
                      className="mt-0.5 h-8 text-sm"
                      placeholder="0"
                      value={item.weight_g}
                      disabled={readOnly}
                      onChange={e => updateItem(idx, { weight_g: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">申报总价值 (Total Value)</Label>
                    <Input
                      className="mt-0.5 h-8 text-sm bg-gray-100"
                      placeholder="自动计算"
                      value={item.total_value !== "" ? `${item.currency || "JPY"} ${item.total_value}` : ""}
                      disabled
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dangerous goods confirmation */}
      <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-orange-800 prose prose-sm max-w-none [&_p]:mb-0">
              <ReactMarkdown>{dangerousGoodsText || "I confirm that the shipment does not contain any prohibited or dangerous goods."}</ReactMarkdown>
            </div>
            {!readOnly && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-orange-600 w-4 h-4"
                  checked={dangerousConfirmed}
                  onChange={e => update({ dangerous_goods_confirmed: e.target.checked })}
                />
                <span className="text-sm font-medium text-orange-900">我已阅读并确认 (I confirm)</span>
              </label>
            )}
            {readOnly && (
              <p className={`text-xs mt-2 font-medium ${dangerousConfirmed ? "text-green-700" : "text-red-600"}`}>
                {dangerousConfirmed ? "✓ 已确认" : "✗ 未确认"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Undeliverable instructions */}
      <div>
        <Label className="text-sm font-medium text-gray-700">
          无法投递时的处理方式 (If undeliverable, I prefer:) *
        </Label>
        {readOnly ? (
          <p className="text-sm text-gray-700 mt-1">
            {UNDELIVERABLE_OPTIONS.find(o => o.v === undeliverable)?.l || undeliverable || "未选择"}
            {undeliverable === "return_to_sender" && returnMethod && (
              <span className="text-xs text-gray-500 ml-2">
                · 退回方式：{RETURN_METHODS.find(r => r.v === returnMethod)?.l || returnMethod}
              </span>
            )}
          </p>
        ) : (
          <div className="mt-1.5 space-y-2">
            {UNDELIVERABLE_OPTIONS.map(opt => (
              <label key={opt.v} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${undeliverable === opt.v ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                <input
                  type="radio"
                  className="accent-red-600"
                  checked={undeliverable === opt.v}
                  onChange={() => update({ undeliverable_instruction: opt.v, return_method: "" })}
                />
                {opt.l}
              </label>
            ))}
          </div>
        )}

        {!readOnly && undeliverable === "return_to_sender" && (
          <div className="mt-3 ml-2 pl-3 border-l-2 border-red-200">
            <Label className="text-xs text-gray-500">退回运输方式 (Return Method)</Label>
            <div className="mt-1.5 flex gap-3 flex-wrap">
              {RETURN_METHODS.map(rm => (
                <label key={rm.v} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${returnMethod === rm.v ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"}`}>
                  <input type="radio" className="accent-blue-600" checked={returnMethod === rm.v} onChange={() => update({ return_method: rm.v })} />
                  {rm.l}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}