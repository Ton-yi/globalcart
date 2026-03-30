/**
 * AddressBlock
 * Reusable address input block for UserNotifyShipmentModal.
 * Shows saved-address dropdown if available, plus "输入新地址" option.
 * When no saved addresses or user selects "输入新地址", shows inline text input.
 * Optionally lets user save the new address to their address book.
 */
import { MapPin, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function AddressBlock({
  slot,
  label,
  savedAddresses,
  selectedId,
  isNewMode,
  newAddress,
  saveNewAddress,
  onSelect,
  onNewAddressChange,
  onSaveToggle,
}) {
  const hasSaved = savedAddresses.length > 0;
  const selectedAddr = hasSaved && !isNewMode ? savedAddresses.find(a => a.id === selectedId) : null;

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" />{label}
      </label>

      {hasSaved && (
        <Select
          value={isNewMode ? "__new__" : (selectedId || "")}
          onValueChange={onSelect}
        >
          <SelectTrigger className="mt-0.5">
            <SelectValue placeholder="选择地址簿中的地址" />
          </SelectTrigger>
          <SelectContent>
            {savedAddresses.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-1.5 text-blue-600">
                <PlusCircle className="w-3.5 h-3.5" />输入新地址
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Show existing address detail */}
      {!isNewMode && selectedAddr && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap">
          {selectedAddr.full_text}
        </div>
      )}

      {/* New address input form */}
      {(isNewMode || !hasSaved) && (
        <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/40 space-y-2">
          {!hasSaved && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <PlusCircle className="w-3.5 h-3.5" />填写收货地址
            </p>
          )}
          <Input
            placeholder="地址标签（如：家、公司）"
            className="h-8 text-sm bg-white"
            value={newAddress.label}
            onChange={e => onNewAddressChange(prev => ({ ...prev, label: e.target.value }))}
          />
          <Textarea
            placeholder={"收件人姓名\n手机号\n详细地址（省/市/区/街道/门牌号）\n邮编"}
            rows={4}
            className="text-sm bg-white resize-none"
            value={newAddress.full_text}
            onChange={e => onNewAddressChange(prev => ({ ...prev, full_text: e.target.value }))}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={saveNewAddress}
              onCheckedChange={v => onSaveToggle(!!v)}
            />
            <span className="text-xs text-gray-600">保存到地址簿</span>
          </label>
        </div>
      )}
    </div>
  );
}