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

  return null;




























































}

function formatAddressPreview(addr) {
  return [addr.recipient_name, addr.phone, addr.country, addr.state, addr.addr3, addr.addr2, addr.addr1].filter(Boolean).join("\n");
}