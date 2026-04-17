/**
 * AddonManager
 * Manages order and shipping addon options for a tenant.
 * Extracted from AdminSettings for maintainability.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

const CURRENCIES = ["JPY", "CNY", "USD", "TWD", "HKD", "EUR", "SGD"];

function AddonRow({ a, editingId, editFields, onEdit, onCancel, onSave, onToggle, onDelete, setEditFields }) {
  const isEditing = editingId === a.id;
  return (
    <div className={`rounded-lg border mb-1.5 ${a.is_active ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
      <div className="flex items-center gap-3 p-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{a.name}</span>
            <span className="text-sm text-red-600">+{a.fee_currency || "JPY"} {Number(parseFloat(a.fee) || 0).toFixed(0)}</span>
            {!a.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已禁用</Badge>}
          </div>
          {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-500 flex-shrink-0"
          onClick={() => isEditing ? onCancel() : onEdit(a)}>
          {isEditing ? "收起" : "编辑"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs flex-shrink-0"
          onClick={() => onToggle(a)}>
          {a.is_active ? "禁用" : "启用"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 flex-shrink-0"
          onClick={() => onDelete(a.id)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      {isEditing && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">名称</Label>
              <Input className="mt-0.5 h-7 text-sm" value={editFields.name}
                onChange={e => setEditFields(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">说明</Label>
              <Input className="mt-0.5 h-7 text-sm" value={editFields.description}
                onChange={e => setEditFields(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">费用</Label>
              <Input type="number" className="mt-0.5 h-7 text-sm" value={editFields.fee}
                onChange={e => setEditFields(p => ({ ...p, fee: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">货币</Label>
              <Select value={editFields.fee_currency} onValueChange={v => setEditFields(p => ({ ...p, fee_currency: v }))}>
                <SelectTrigger className="mt-0.5 h-7 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">增值类型</Label>
              <div className="flex gap-3 mt-1">
                {[{ v: "order", l: "下单增值选项" }, { v: "shipping", l: "发货增值选项" }].map(opt => (
                  <label key={opt.v} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${editFields.addon_type === opt.v ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}>
                    <input type="radio" className="hidden" checked={editFields.addon_type === opt.v}
                      onChange={() => setEditFields(p => ({ ...p, addon_type: opt.v }))} />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => onSave(a.id)}>保存</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={onCancel}>取消</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddonManager({ addons, editingAddon, editAddonFields, newAddon,
  setEditAddonFields, setNewAddon,
  onEdit, onCancelEdit, onSave, onToggle, onDelete, onAdd }) {

  const orderAddons = addons.filter(a => !a.addon_type || a.addon_type === "order");
  const shippingAddons = addons.filter(a => a.addon_type === "shipping");

  return (
    <div className="space-y-4">
      {/* Order addons */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
          <Badge className="text-xs bg-blue-100 text-blue-700">下单增值选项</Badge>
          <span className="text-gray-400 font-normal">提交订单时展示，费用计入订单付款金额</span>
        </p>
        {orderAddons.length === 0 && <p className="text-xs text-gray-400 py-1">暂无，在下方添加</p>}
        {orderAddons.map(a => (
          <AddonRow key={a.id} a={a}
            editingId={editingAddon}
            editFields={editAddonFields}
            setEditFields={setEditAddonFields}
            onEdit={onEdit}
            onCancel={onCancelEdit}
            onSave={onSave}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Shipping addons */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
          <Badge className="text-xs bg-orange-100 text-orange-700">发货增值选项</Badge>
          <span className="text-gray-400 font-normal">提交发货申请时展示，费用计入发货运费</span>
        </p>
        {shippingAddons.length === 0 && <p className="text-xs text-gray-400 py-1">暂无，在下方添加</p>}
        {shippingAddons.map(a => (
          <AddonRow key={a.id} a={a}
            editingId={editingAddon}
            editFields={editAddonFields}
            setEditFields={setEditAddonFields}
            onEdit={onEdit}
            onCancel={onCancelEdit}
            onSave={onSave}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Add new */}
      <div className="pt-2 border-t border-dashed border-gray-200 space-y-2">
        <p className="text-xs text-gray-500 font-medium">新增增值选项</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400">名称 *</Label>
            <Input className="mt-0.5 h-8 text-sm" placeholder="例：质检拍照"
              value={newAddon.name} onChange={e => setNewAddon(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400">说明</Label>
            <Input className="mt-0.5 h-8 text-sm" placeholder="可选"
              value={newAddon.description} onChange={e => setNewAddon(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400">费用 *</Label>
            <Input type="number" step="1" className="mt-0.5 h-8 text-sm" placeholder="500"
              value={newAddon.fee} onChange={e => setNewAddon(p => ({ ...p, fee: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400">费用货币</Label>
            <Select value={newAddon.fee_currency} onValueChange={v => setNewAddon(p => ({ ...p, fee_currency: v }))}>
              <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-gray-400">增值类型</Label>
            <div className="flex gap-3 mt-1">
              {[{ v: "order", l: "下单增值选项" }, { v: "shipping", l: "发货增值选项" }].map(opt => (
                <label key={opt.v} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${newAddon.addon_type === opt.v ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}>
                  <input type="radio" className="hidden" checked={newAddon.addon_type === opt.v}
                    onChange={() => setNewAddon(p => ({ ...p, addon_type: opt.v }))} />
                  {opt.l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd} disabled={!newAddon.name || newAddon.fee === ""}>
          <Plus className="w-3.5 h-3.5 mr-1" />添加
        </Button>
      </div>
    </div>
  );
}