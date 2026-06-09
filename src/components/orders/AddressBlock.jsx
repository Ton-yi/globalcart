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
  onSaveToggle
}) {
  const hasSaved = savedAddresses.length > 0;
  const selectedAddr = hasSaved && !isNewMode ? savedAddresses.find((a) => a.id === selectedId) : null;

  // Ensure newAddress has all structured fields (label is kept separately in AddressBlock)
  const addrValue = { ...EMPTY_ADDRESS_FORM, ...newAddress };

  // When no saved addresses, auto-treat as new mode for submit validation purposes
  const effectiveNewMode = isNewMode || !hasSaved;

  // Handle AddressForm field changes — always preserve the label field
  const handleAddressFormChange = (updatedFields) => {
    onNewAddressChange((prev) => ({ ...prev, ...updatedFields }));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</label>
      {!hasSaved || effectiveNewMode ? (
        // Show structured address form
        <div className="space-y-2">
          {hasSaved && (
            <Select value="__new__" disabled>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="已选择：输入新地址" />
              </SelectTrigger>
            </Select>
          )}
          <AddressForm
            value={addrValue}
            onChange={handleAddressFormChange}
            showLabel={false}
          />
          {hasSaved && saveNewAddress !== undefined && (
            <label className="flex items-center gap-2 mt-2">
              <Checkbox checked={saveNewAddress} onCheckedChange={onSaveToggle} />
              <span className="text-xs text-gray-500">保存到我的地址簿</span>
            </label>
          )}
        </div>
      ) : (
        // Show saved address dropdown
        <div className="space-y-2">
          <Select value={selectedId || ""} onValueChange={onSelect}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="请选择收货地址" />
            </SelectTrigger>
            <SelectContent>
              {savedAddresses.map((addr) => (
                <SelectItem key={addr.id} value={addr.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{addr.label || "地址"}</span>
                    <span className="text-xs text-gray-500 truncate max-w-xs">
                      {formatAddressPreview(addr)}
                    </span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__new__">
                <div className="flex items-center gap-1.5 text-blue-600">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>输入新地址</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {selectedAddr && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 space-y-0.5">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-gray-700">{selectedAddr.label}</span>
                  <span className="whitespace-pre-line">{formatAddressPreview(selectedAddr)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );




























































}

function formatAddressPreview(addr) {
  return [addr.recipient_name, addr.phone, addr.country, addr.state, addr.addr3, addr.addr2, addr.addr1].filter(Boolean).join("\n");
}