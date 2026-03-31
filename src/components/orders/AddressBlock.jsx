/**
 * AddressBlock
 * Reusable address input block for UserNotifyShipmentModal.
 * Shows saved-address dropdown if available, plus "输入新地址" option.
 * When no saved addresses or user selects "输入新地址", shows structured AddressForm.
 * Optionally lets user save the new address to their address book.
 *
 * newAddress shape: { label, recipient_name, country, addr1, addr2, addr3, state, phone }
 */
import { MapPin, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import AddressForm, { EMPTY_ADDRESS_FORM } from "@/components/common/AddressForm";

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

  // Ensure newAddress has all structured fields
  const addrValue = { ...EMPTY_ADDRESS_FORM, ...newAddress };

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
          {selectedAddr.full_text || formatAddressPreview(selectedAddr)}
        </div>
      )}

      {/* New address structured input */}
      {(isNewMode || !hasSaved) && (
        <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/40 space-y-2">
          {!hasSaved && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <PlusCircle className="w-3.5 h-3.5" />填写收货地址
            </p>
          )}
          {/* Address label */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">地址标签</label>
            <Input
              placeholder="如：家、公司"
              className="h-8 text-sm bg-white"
              value={addrValue.label || ""}
              onChange={e => onNewAddressChange(prev => ({ ...prev, label: e.target.value }))}
            />
          </div>
          <AddressForm
            value={addrValue}
            onChange={v => onNewAddressChange(prev => ({ ...prev, ...v }))}
          />
          <label className="flex items-center gap-2 cursor-pointer pt-1">
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

function formatAddressPreview(addr) {
  return [addr.recipient_name, addr.phone, addr.country, addr.state, addr.addr3, addr.addr2, addr.addr1].filter(Boolean).join("\n");
}