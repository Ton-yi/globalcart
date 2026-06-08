/**
 * UserNotifyShipmentModal
 * Supports single or multiple orders.
 * Includes:
 * - Natural-language combined shipping (拼邮) configuration
 * - Privacy system (不公开 + shared with specific users)
 * - Join existing shipping pool option
 */
import { useState, useEffect } from "react";
import { X, Truck, Package, MapPin, Lock, Users, Search, Star } from "lucide-react";
import CustomsDeclarationForm from "@/components/orders/CustomsDeclarationForm";
import { serializeAddressToText, isAddressFormValid, EMPTY_ADDRESS_FORM } from "@/components/common/AddressForm";
import AddressBlock from "@/components/orders/AddressBlock";
import { getCountry } from "@/lib/countries";
import { base44 } from "@/api/base44Client";
import { updateOrder, tenantEntity, shippingPoolApi, userPrefApi, fetchShippingPools } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
// Shared with CreateShippingPoolModal — edit shippingFormConstants.js to sync both
import { SHIPPING_METHODS, CONSOLIDATION_TIMEOUT_ACTIONS as TIMEOUT_ACTIONS } from "@/components/shippingpool/shippingFormConstants";

function clampYear(dateStr) {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts[0] && parts[0].length > 4) { parts[0] = parts[0].slice(0, 4); return parts.join("-"); }
  return dateStr;
}

function Token({ value, onChange, type = "text", options, placeholder, suffix }) {
  if (options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-blue-400 rounded-none bg-blue-50 text-blue-700 font-medium text-sm px-2 w-auto min-w-[80px] focus:ring-0 focus:border-blue-600">
          <SelectValue placeholder={placeholder || "选择"} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (type === "date") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <input type="date" value={value || ""} onChange={e => onChange(clampYear(e.target.value))}
          className="inline-block border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-1 rounded-none focus:outline-none focus:border-blue-600"
          style={{ width: "130px" }} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="inline-block border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-1 rounded-none focus:outline-none focus:border-blue-600 w-auto min-w-[60px]"
        style={{ width: `${Math.max((value?.length || placeholder?.length || 4) + 2, 6)}ch` }} />
      {suffix && <span className="text-gray-500 text-sm">{suffix}</span>}
    </span>
  );
}

function DeadlineToken({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  if (!editing && !value) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="inline-flex items-center gap-0.5 border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-2 h-7 rounded-none hover:bg-blue-100">
        任何时候
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input type="date" value={value || ""} onChange={e => onChange(clampYear(e.target.value))} autoFocus={editing}
        className="inline-block border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-1 rounded-none focus:outline-none focus:border-blue-600"
        style={{ width: "140px" }} />
      {value && <button type="button" onClick={() => { onChange(""); setEditing(false); }} className="text-blue-400 hover:text-blue-600 text-xs">×</button>}
    </span>
  );
}

function TransitMethodSection({ consType, selectedTransitId, transitLocations, transitMethods, selectedTransitMethodId, setSelectedTransitMethodId }) {
  if (consType !== "transit") return null;
  const selectedLoc = transitLocations.find(l => l.id === selectedTransitId);
  const disabledMethodIds = selectedLoc?.disabled_transit_method_ids || [];
  const visibleMethods = transitMethods.filter(m => !disabledMethodIds.includes(m.id));
  const allowPickup = selectedLoc?.allow_pickup;
  const allowStorage = selectedLoc?.allow_storage;
  if (visibleMethods.length === 0 && !allowPickup && !allowStorage) return null;

  const getRateSummary = (m) => {
    if (m.rate_mode === "fixed" || !m.simple_rates?.length) {
      return `+${m.fee_currency || "CNY"} ${Number(m.fee || 0).toLocaleString()}`;
    }
    const r = m.simple_rates[0];
    return `首${r.first_weight_g}g/${r.first_weight_fee}${r.currency}`;
  };

  return (
    <div>
      <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5" />中转段运输方式
      </label>
      <div className="mt-1.5 space-y-1.5">
        {allowPickup && (
          <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedTransitMethodId === "pickup" ? "border-teal-400 bg-teal-50" : "border-gray-200 hover:bg-gray-50"}`}>
            <input type="radio" checked={selectedTransitMethodId === "pickup"} onChange={() => setSelectedTransitMethodId("pickup")} className="accent-teal-600" />
            <span className="text-sm text-gray-600">自取</span>
          </label>
        )}
        {allowStorage && (
          <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedTransitMethodId === "storage" ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
            <input type="radio" checked={selectedTransitMethodId === "storage"} onChange={() => setSelectedTransitMethodId("storage")} className="accent-indigo-600" />
            <span className="text-sm text-gray-600">暂存</span>
          </label>
        )}
        {visibleMethods.map(m => (
          <label key={m.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedTransitMethodId === m.id ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:bg-gray-50"}`}>
            <div className="flex items-center gap-2">
              <input type="radio" checked={selectedTransitMethodId === m.id} onChange={() => setSelectedTransitMethodId(m.id)} className="accent-orange-500" />
              <div>
                <span className="text-sm font-medium text-gray-800">{m.name}</span>
                {m.description && <span className="text-xs text-gray-400 ml-2">{m.description}</span>}
              </div>
            </div>
            <span className="text-xs font-medium text-orange-700 flex-shrink-0">{getRateSummary(m)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TransitAddonSection({ consType, selectedTransitId, transitLocations, shippingAddons, selectedAddonIds, setSelectedAddonIds }) {
  // When consType is "transit", filter out addons disabled by the selected transit location
  const disabledAddonIds = consType === "transit"
    ? (transitLocations.find(l => l.id === selectedTransitId)?.disabled_addon_ids || [])
    : [];
  const visibleAddons = shippingAddons.filter(a => !disabledAddonIds.includes(a.id));
  // Show addons for all shipping types (not just transit)
  if (visibleAddons.length === 0) return null;

  return (
    <div>
      <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5" />增值服务（可选）
      </label>
      <div className="mt-1.5 space-y-1.5">
        {visibleAddons.map(a => (
          <label key={a.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedAddonIds.includes(a.id) ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"}`}>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAddonIds.includes(a.id)}
                onCheckedChange={v => setSelectedAddonIds(prev => v ? [...prev, a.id] : prev.filter(id => id !== a.id))}
              />
              <div>
                <span className="text-sm font-medium text-gray-800">{a.name}</span>
                {a.description && <span className="text-xs text-gray-400 ml-2">{a.description}</span>}
              </div>
            </div>
            <span className="text-xs font-medium text-yellow-700 flex-shrink-0">+{a.fee_currency || "JPY"} {Number(a.fee || 0).toLocaleString()}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function UserNotifyShipmentModal({ order, orders, initialData, onClose, onSuccess, hazmatText }) {
  const targetOrders = orders || (order ? [order] : []);
  const isMulti = targetOrders.length > 1;

  const [method, setMethod] = useState(targetOrders[0]?.shipping_method || "");
  const [consType, setConsType] = useState("");
  const [deadline, setDeadline] = useState("");
  const [minWeight, setMinWeight] = useState("2000");
  const [consMethod, setConsMethod] = useState("");
  const [consMethodFallback, setConsMethodFallback] = useState("");
  const [timeoutAction, setTimeoutAction] = useState("ship_individually");
  const [timeoutMethod, setTimeoutMethod] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Address & transit
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [userPrefId, setUserPrefId] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [transitLocations, setTransitLocations] = useState([]);
  const [selectedTransitId, setSelectedTransitId] = useState("");
  const [finalAddressId, setFinalAddressId] = useState("");

  // New address input state
  const [newAddress, setNewAddress] = useState({ label: "", ...EMPTY_ADDRESS_FORM });
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  // Which address slot is in "new input" mode: "direct" | "final" | "other"
  const [addressInputMode, setAddressInputMode] = useState({});

  // Privacy system
  const [isPrivate, setIsPrivate] = useState(false);
  const [allUsers, setAllUsers] = useState([]); // non-admin users
  const [sharedWithEmails, setSharedWithEmails] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Join existing pool (consolidation)
  const [joinExistingPool, setJoinExistingPool] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [existingPools, setExistingPools] = useState([]);
  const [poolSearchQuery, setPoolSearchQuery] = useState("");
  const [selectedPoolId, setSelectedPoolId] = useState("");
  // Join existing direct (single) pool
  const [joinDirectPool, setJoinDirectPool] = useState(false);
  const [directPoolSearchQuery, setDirectPoolSearchQuery] = useState("");
  const [selectedDirectPoolId, setSelectedDirectPoolId] = useState("");
  const [directPools, setDirectPools] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Customs declaration (single shipment only)
  const [poolTitle, setPoolTitle] = useState("");
  const [customsData, setCustomsData] = useState(null);

  // Addons & transit shipping method
  const [shippingAddons, setShippingAddons] = useState(initialData?.addons || []);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [transitMethods, setTransitMethods] = useState(initialData?.transitMethods || []);
  const [selectedTransitMethodId, setSelectedTransitMethodId] = useState(
    initialData?.userPreference?.preferred_transit_shipping_id || ""
  );
  const [shippingMethods, setShippingMethods] = useState(initialData?.shippingMethods || []);
  const [methodError, setMethodError] = useState(null);

  useEffect(() => {
    // If initialData was provided by the parent page, use it directly — skip all self-fetches
    if (initialData) {
      const pref = initialData.userPreference;
      if (pref?.saved_addresses) setSavedAddresses(pref.saved_addresses);
      if (pref?.preferred_transit_shipping_id) setSelectedTransitMethodId(pref.preferred_transit_shipping_id);
      if (pref?.id) setUserPrefId(pref.id);
      // Auto-select default address
      if (pref?.default_address_id) setFinalAddressId(pref.default_address_id);
      setTransitLocations(initialData.transitLocations || []);
      setAllUsers(initialData.nonAdminUsers || []);

      const allPools = initialData.pools || [];
      base44.auth.me().then(u => {
        setCurrentUser(u);
        const consolidationPools = allPools.filter(p =>
          p.consolidation_type && p.consolidation_type !== "" &&
          (p.status === "pending" || p.status === "processing") &&
          (!p.is_private || p.creator_email === u.email || (p.shared_with_emails || []).includes(u.email))
        );
        setExistingPools(consolidationPools);
        const directShipPools = allPools.filter(p =>
          (!p.consolidation_type || p.consolidation_type === "") &&
          (p.status === "pending" || p.status === "processing") &&
          p.creator_email === u.email
        );
        setDirectPools(directShipPools);
      }).catch(() => {});
      return;
    }

    // Fallback: self-fetch when used outside MyOrders (e.g. from OrderDetailDrawer)
    base44.auth.me().then(async u => {
      setCurrentUser(u);
      const [prefs, allLocs, usersRes, allPools, addons, tMethods, shippingMethods] = await Promise.all([
        userPrefApi.list({ user_email: u.email }),
        tenantEntity.list('TransitLocation'),
        base44.functions.invoke("listNonAdminUsers", {}).catch(() => ({ data: { users: [] } })),
        fetchShippingPools(),
        tenantEntity.list('AddonOption', { addon_type: "shipping", is_active: true }),
        tenantEntity.list('TransitShippingMethod', { is_active: true }),
        tenantEntity.list('ShippingMethod', { is_active: true }),
      ]);
      if (prefs.length > 0) {
        if (prefs[0].saved_addresses) setSavedAddresses(prefs[0].saved_addresses);
        if (prefs[0].preferred_transit_shipping_id) setSelectedTransitMethodId(prefs[0].preferred_transit_shipping_id);
        if (prefs[0].default_address_id) setFinalAddressId(prefs[0].default_address_id);
        setUserPrefId(prefs[0].id);
      }
      setTransitLocations((allLocs || []).filter(l => l.is_active !== false));
      setAllUsers(usersRes?.data?.users || []);
      setShippingMethods(shippingMethods || []);
      const consolidationPools = allPools.filter(p =>
        p.consolidation_type && p.consolidation_type !== "" &&
        (p.status === "pending" || p.status === "processing") &&
        (!p.is_private || p.creator_email === u.email || (p.shared_with_emails || []).includes(u.email))
      );
      setExistingPools(consolidationPools);
      const directShipPools = allPools.filter(p =>
        (!p.consolidation_type || p.consolidation_type === "") &&
        (p.status === "pending" || p.status === "processing") &&
        p.creator_email === u.email
      );
      setDirectPools(directShipPools);
      setShippingAddons(addons || []);
      setTransitMethods(tMethods || []);
    }).catch(() => {});
  }, []);

  const handleAddressSelect = (val, slot = "direct") => {
    if (val === "__new__") {
      setAddressInputMode(m => ({ ...m, [slot]: true }));
      if (slot === "final") setFinalAddressId("");
      else setSelectedAddress("");
    } else {
      setAddressInputMode(m => ({ ...m, [slot]: false }));
      if (slot === "final") {
        setFinalAddressId(val);
      } else {
        setSelectedAddress(val);
      }
    }
  };

  const consolidation = consType !== "";
  const hasConsolidationConditions = consolidation && (deadline || minWeight);

  // An address slot is "satisfied" when:
  //  - user picked a saved address (selectedId is set and not new mode), OR
  //  - new address form is open (isNewMode or no saved addresses) AND form is valid
  const isAddressSlotOk = (slot) => {
    const inNewMode = !!addressInputMode[slot] || savedAddresses.length === 0;
    if (inNewMode) return isAddressFormValid(newAddress) && !!(newAddress.label?.trim());
    const id = slot === "final" ? finalAddressId : selectedAddress;
    return !!id;
  };

  // Calculate total weight for all orders
  const totalWeight = targetOrders.reduce((s, o) => s + (o.weight_g || 0), 0);

  // Check if shipping method is within constraints
  const getMethodError = () => {
    if (!method) return null;
    const selectedMethod = shippingMethods.find(m => m.code === method);
    if (!selectedMethod) return null;
    
    // Check weight constraints
    if (selectedMethod.min_weight_g > 0 && totalWeight < selectedMethod.min_weight_g) {
      return `所选运输方式最小重量为 ${selectedMethod.min_weight_g}g，当前订单总重为 ${totalWeight}g，不符合条件`;
    }
    if (selectedMethod.max_weight_g > 0 && totalWeight > selectedMethod.max_weight_g) {
      return `所选运输方式最大重量为 ${selectedMethod.max_weight_g}g，当前订单总重为 ${totalWeight}g，超出限制`;
    }
    
    // Check disabled item size templates
    const disabledSizes = selectedMethod.disabled_item_size_template_ids || [];
    const hasDisabledSize = targetOrders.some(o => o.item_size_template_id && disabledSizes.includes(o.item_size_template_id));
    if (hasDisabledSize) {
      return `所选运输方式不支持当前订单所使用的物品尺寸模板`;
    }
    
    return null;
  };
  
  const selectedPool = existingPools.find(p => p.id === selectedPoolId);

  // When joining existing pool, method/minWeight/consMethod are locked
  const isJoiningPool = joinExistingPool && selectedPoolId;

  const filteredPools = existingPools.filter(p => {
    if (!poolSearchQuery) return true;
    const q = poolSearchQuery.toLowerCase();
    return (p.pool_code || "").toLowerCase().includes(q) ||
      (p.transit_location_name || "").toLowerCase().includes(q) ||
      (p.title || "").toLowerCase().includes(q);
  });

  const filteredUsers = allUsers.filter(u => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const toggleSharedUser = (email) => {
    setSharedWithEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };

  const handleSubmit = async () => {
    if (!method && !isJoiningPool) return;
    if (!isJoiningPool && consType === "transit" && !selectedTransitId) return;
    if (!isJoiningPool && consType === "transit" && !isAddressSlotOk("final")) return;
    if (isJoiningPool && !isAddressSlotOk("final")) return;
    if (isJoiningPool && selectedPool?.consolidation_type === "transit" && !selectedTransitMethodId) return;
    if (!isJoiningPool && consType === "" && !joinDirectPool && !isAddressSlotOk("direct")) return;
    if (!isJoiningPool && consType === "other" && !isAddressSlotOk("other")) return;
    if (joinExistingPool && !selectedPoolId) return;
    setSubmitting(true);

    const u = currentUser || await base44.auth.me();
    const orderIds = targetOrders.map(o => o.id);

    // Determine effective address object for each slot
    const getEffectiveAddr = (slot) => {
      const inNewMode = !!addressInputMode[slot] || savedAddresses.length === 0;
      if (inNewMode) {
        // user typed a new address — compute full_text dynamically
        if (!isAddressFormValid(newAddress)) return null;
        return { id: `new_${Date.now()}`, label: newAddress.label || "新地址", full_text: serializeAddressToText(newAddress), ...newAddress };
      }
      const addrId = slot === "final" ? finalAddressId : selectedAddress;
      return savedAddresses.find(a => a.id === addrId) || null;
    };

    // Save new address to UserPreference if requested.
    // addressInputMode[slot]=true only when user explicitly picks "输入新地址" from dropdown.
    // But when there are NO saved addresses, the form is shown directly (no dropdown) and
    // addressInputMode stays empty — so we also check if saveNewAddress is on and address is valid.
    const isInNewAddressMode = Object.values(addressInputMode).some(v => v) || savedAddresses.length === 0;
    if (saveNewAddress && isAddressFormValid(newAddress) && isInNewAddressMode) {
      const newEntry = {
        id: `addr_${Date.now()}`,
        label: newAddress.label || "新地址",
        full_text: serializeAddressToText(newAddress),
        ...newAddress,
      };
      const updatedAddresses = [...savedAddresses, newEntry];
      if (userPrefId) {
        await userPrefApi.update(userPrefId, { saved_addresses: updatedAddresses });
      } else {
        // Create a new UserPreference record with tenant context via mutateTenantEntity
        const created = await userPrefApi.create({ user_email: u.email, saved_addresses: updatedAddresses });
        if (created?.id) setUserPrefId(created.id);
      }
      // Update local state so address is available immediately
      setSavedAddresses(updatedAddresses);
    }
    const totalWeight = targetOrders.reduce((s, o) => s + (o.weight_g || 0), 0);

    // Addons belong to the submitter's orders, not the pool
    const selectedAddons = shippingAddons.filter(a => selectedAddonIds.includes(a.id));
    const addonUpdates = selectedAddonIds.length > 0 ? {
      selected_addon_ids: selectedAddonIds,
      selected_addons: selectedAddons.map(a => ({ id: a.id, name: a.name, fee: a.fee, fee_currency: a.fee_currency })),
    } : {};

    // Attach customs declaration data if filled out (single shipment only)
    const hasCustoms = customsData && customsData.items && customsData.items.some(it => it.name);
    const customsNote = hasCustoms ? JSON.stringify(customsData) : null;

    const updates = {
      shipping_method: method,
      consolidation_requested: consolidation,
      order_status: "notified_shipment",
      ...(hasCustoms ? { customs_declaration: customsData } : {}),
      ...(consolidation && deadline ? { consolidation_deadline: deadline } : {}),
      ...(!isJoiningPool && consolidation && minWeight ? { consolidation_min_weight_g: parseFloat(minWeight) } : {}),
      ...(!isJoiningPool && hasConsolidationConditions ? { consolidation_timeout_action: timeoutAction } : {}),
      ...(consType === "transit" ? { consolidation_transit_id: selectedTransitId, consolidation_final_address_id: finalAddressId } : {}),
      ...addonUpdates,
    };

    await Promise.all(
      targetOrders.map(o =>
        updateOrder(o.id, {
          ...updates,
          user_note: [o.user_note, note].filter(Boolean).join("\n"),
        })
      )
    );

    if (joinDirectPool && selectedDirectPoolId) {
      const directPool = directPools.find(p => p.id === selectedDirectPoolId);
      if (directPool) {
        await shippingPoolApi.update(directPool.id, {
          order_ids: [...new Set([...(directPool.order_ids || []), ...orderIds])],
          order_names: [...new Set([...(directPool.order_names || []), ...targetOrders.map(o => o.product_name || "")])],
          total_weight_g: (directPool.total_weight_g || 0) + totalWeight,
        });
      }
    } else if (isJoiningPool && selectedPool) {
      // When joining an existing pool, we update the pool's order list.
      // If the user filled a new address for this join, also persist it to the pool.
      const joinAddrObj = getEffectiveAddr("final");
      const joinAddrUpdate = joinAddrObj ? {
        destination_country: joinAddrObj.country || "",
        recipient_name: joinAddrObj.recipient_name || "",
        recipient_phone: joinAddrObj.phone || "",
        address_line1: joinAddrObj.addr2 || "",
        address_line2: joinAddrObj.addr1 || "",
        city: joinAddrObj.addr3 || "",
        state: joinAddrObj.state || "",
      } : {};
      await shippingPoolApi.update(selectedPool.id, {
        order_ids: [...new Set([...(selectedPool.order_ids || []), ...orderIds])],
        total_weight_g: (selectedPool.total_weight_g || 0) + totalWeight,
        ...joinAddrUpdate,
      });
    } else {
      const transitLoc = transitLocations.find(l => l.id === selectedTransitId);
      const prefix = consType === "transit" && transitLoc?.code_prefix
        ? transitLoc.code_prefix.toUpperCase()
        : "AAA";
      const existingPools = await fetchShippingPools();
      const prefixPools = existingPools.filter(p => p.pool_code && p.pool_code.startsWith(prefix));
      const nextSeq = (prefixPools.length + 1).toString().padStart(5, "0");
      const pool_code = `${prefix}${nextSeq}`;

      const addrObj = consType === "transit"
        ? getEffectiveAddr("final")
        : getEffectiveAddr(consType === "other" ? "other" : "direct");
      const transitMethod = transitMethods.find(m => m.id === selectedTransitMethodId);

      // Extract destination country from the address object
      const destCountry = addrObj?.country || null;

      await shippingPoolApi.create({
        pool_code,
        title: poolTitle.trim() || "",
        consolidation_type: consType || "",
        order_ids: orderIds,
        order_names: targetOrders.map(o => o.product_name || ""),
        creator_email: u.email,
        creator_name: u.full_name || u.email,
        is_admin_created: false,
        shipping_method: method,
        total_weight_g: totalWeight,
        status: "pending",
        transit_location_id: consType === "transit" ? selectedTransitId : "",
        transit_location_name: transitLoc?.name || "",
        final_address_id: consType === "transit" ? finalAddressId : "",
        transit_shipping_method_id: selectedTransitMethodId || "",
        transit_shipping_method_name: transitMethod?.name || "",
        selected_addon_ids: [],
        selected_addons: [],
        user_note: note || "",
        messages: [],
        is_private: isPrivate,
        shared_with_emails: isPrivate ? sharedWithEmails : [],
        destination_country: destCountry,
        recipient_name: addrObj?.recipient_name || "",
        recipient_phone: addrObj?.phone || "",
        address_line1: addrObj?.addr2 || "",
        address_line2: addrObj?.addr1 || "",
        city: addrObj?.addr3 || "",
        state: addrObj?.state || "",
        postal_code: "",
      });
    }

    onSuccess?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">通知发货</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isMulti ? `已选择 ${targetOrders.length} 个订单` : targetOrders[0]?.product_name}
            </p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Multi-order list */}
           {isMulti && (
             <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 max-h-28 overflow-y-auto">
               {targetOrders.map(o => (
                 <div key={o.id} className="flex items-center gap-2 text-xs text-gray-600">
                   <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                   <span className="truncate">{o.product_name}</span>
                   <span className="text-gray-400 flex-shrink-0">{o.weight_g || 100}g</span>
                 </div>
               ))}
               <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                 <span className="text-xs font-medium text-gray-700">总重量</span>
                 <span className="text-xs font-semibold text-gray-900">{totalWeight}g</span>
               </div>
             </div>
           )}

          {/* Shipping method */}
           <div>
             <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">发货方式</label>
             <Select value={method} onValueChange={(val) => { setMethod(val); setMethodError(null); }} disabled={!!isJoiningPool}>
               <SelectTrigger className={`mt-1.5 ${isJoiningPool ? "opacity-50 cursor-not-allowed" : ""} ${methodError ? "border-red-300" : ""}`}>
                 <SelectValue placeholder={isJoiningPool ? "使用拼邮池配置" : "请选择发货方式"} />
               </SelectTrigger>
               <SelectContent>
                 {SHIPPING_METHODS.map(m => (
                   <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
             {isJoiningPool && <p className="text-xs text-gray-400 mt-1">发货方式将使用所选拼邮需求的配置</p>}
             {method && !isJoiningPool && getMethodError() && (
               <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                 <p className="text-xs text-red-700 font-medium">⚠️ 所选运输方式不可用</p>
                 <p className="text-xs text-red-600 mt-1">{getMethodError()}</p>
                 <p className="text-xs text-red-600 mt-1">请重新选择运输方式</p>
               </div>
             )}
           </div>

          {/* Consolidation type */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">拼邮方式</label>
            {[
              { key: "", label: "单独发货", desc: "不申请拼邮" },
              { key: "transit", label: "申请拼邮到中转地", desc: "与其他包裹合并，发往指定中转地" },
              { key: "other", label: "申请拼邮到其它地址", desc: "与其他包裹合并，发往自选地址" },
            ].map(opt => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${consType === opt.key ? "border-red-300 bg-red-50" : "border-gray-100 hover:bg-gray-50"}`}>
                <input type="radio" checked={consType === opt.key} onChange={() => { setConsType(opt.key); setJoinExistingPool(false); setSelectedPoolId(""); setJoinDirectPool(false); setSelectedDirectPoolId(""); }} className="mt-0.5 accent-red-600" />
                <div>
                  <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Join existing direct shipment pool (only for single shipment) */}
          {consType === "" && directPools.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${joinDirectPool ? "bg-teal-50 border-b border-teal-100" : "hover:bg-gray-50"}`}>
                <Checkbox checked={joinDirectPool} onCheckedChange={v => { setJoinDirectPool(!!v); if (!v) setSelectedDirectPoolId(""); }} />
                <div>
                  <p className="text-sm font-medium text-gray-800">加入已有的单独发货申请</p>
                  <p className="text-xs text-gray-400 mt-0.5">将此订单合并到已有的发货申请中一起发货</p>
                </div>
              </label>
              {joinDirectPool && (
                <div className="px-4 py-3 space-y-2 bg-teal-50/40">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input placeholder="搜索发货申请编号..." className="pl-8 h-8 text-sm"
                      value={directPoolSearchQuery} onChange={e => setDirectPoolSearchQuery(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {directPools.filter(p => {
                      if (!directPoolSearchQuery) return true;
                      const q = directPoolSearchQuery.toLowerCase();
                      return (p.pool_code || "").toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                    }).map(p => (
                      <label key={p.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedDirectPoolId === p.id ? "border-teal-400 bg-teal-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                        <input type="radio" checked={selectedDirectPoolId === p.id} onChange={() => setSelectedDirectPoolId(p.id)} className="mt-0.5 accent-teal-600" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-mono font-medium text-teal-700">{p.pool_code}</span>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            单独发货 · {p.shipping_method || "方式未定"} · {(p.order_ids || []).length} 件
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Address selection for non-consolidation */}
          {consType === "" && !joinDirectPool && (
            <AddressBlock
              slot="direct"
              label="收货地址 *"
              savedAddresses={savedAddresses}
              selectedId={selectedAddress}
              isNewMode={!!addressInputMode["direct"]}
              newAddress={newAddress}
              saveNewAddress={saveNewAddress}
              onSelect={(v) => handleAddressSelect(v, "direct")}
              onNewAddressChange={setNewAddress}
              onSaveToggle={setSaveNewAddress}
            />
          )}

          {/* Customs declaration — single shipment only */}
          {consType === "" && !joinDirectPool && (
            <CustomsDeclarationForm
              value={customsData}
              onChange={setCustomsData}
              hazmatText={hazmatText || initialData?.hazmatText || null}
            />
          )}

          {/* Transit location selection */}
          {consType === "transit" && (
            <div className="space-y-3">
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/40 space-y-2">
                <label className="text-xs text-blue-700 font-medium">选择中转地 *</label>
                {transitLocations.length === 0 ? (
                  <p className="text-xs text-gray-400">暂无可用中转地，请联系管理员</p>
                ) : transitLocations.map(l => (
                  <label key={l.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedTransitId === l.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"} ${joinExistingPool ? "opacity-50 pointer-events-none" : ""}`}>
                    <input type="radio" checked={selectedTransitId === l.id} onChange={() => { setSelectedTransitId(l.id); setSelectedTransitMethodId(""); setSelectedAddonIds([]); }} className="mt-0.5 accent-blue-600" disabled={joinExistingPool} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{l.name}</p>
                      <p className="text-xs text-gray-400">
                        {[getCountry(l.country)?.name || l.country, l.province].filter(Boolean).join(" · ")}
                        {l.handling_fee > 0 && ` · 手续费 ${l.handling_fee_currency || "JPY"} ${l.handling_fee}`}
                        {l.allow_storage && " · 支持暂存"}
                        {l.allow_pickup && " · 支持自取"}
                      </p>
                      {l.manager_contact && <p className="text-xs text-gray-400 mt-0.5">联系：{l.manager_contact}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <AddressBlock
                slot="final"
                label="最终收货地址（货品从中转地发往此处）*"
                savedAddresses={savedAddresses}
                selectedId={finalAddressId}
                isNewMode={!!addressInputMode["final"]}
                newAddress={newAddress}
                saveNewAddress={saveNewAddress}
                onSelect={(v) => handleAddressSelect(v, "final")}
                onNewAddressChange={setNewAddress}
                onSaveToggle={setSaveNewAddress}
              />
            </div>
          )}

          {/* Join existing pool option (only for consolidation types) */}
          {consolidation && existingPools.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${joinExistingPool ? "bg-purple-50 border-b border-purple-100" : "hover:bg-gray-50"}`}>
                <Checkbox checked={joinExistingPool} onCheckedChange={v => { setJoinExistingPool(!!v); if (!v) setSelectedPoolId(""); }} />
                <div>
                  <p className="text-sm font-medium text-gray-800">加入已有的拼邮需求</p>
                  <p className="text-xs text-gray-400 mt-0.5">将此次发货订单加入到现有的拼邮池中</p>
                </div>
              </label>

              {joinExistingPool && (
                <div className="px-4 py-3 space-y-2 bg-purple-50/40">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input placeholder="搜索拼邮需求编号或名称..." className="pl-8 h-8 text-sm"
                      value={poolSearchQuery} onChange={e => setPoolSearchQuery(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {filteredPools.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">无匹配的拼邮需求</p>
                    ) : filteredPools.map(p => (
                      <label key={p.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedPoolId === p.id ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                        <input type="radio" checked={selectedPoolId === p.id} onChange={() => setSelectedPoolId(p.id)} className="mt-0.5 accent-purple-600" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-medium text-purple-700">{p.pool_code}</span>
                            {p.is_private && <span className="text-xs text-gray-400">🔒</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                            {p.consolidation_type === "transit" ? `中转拼邮 → ${p.transit_location_name || "中转地"}` : "自选地址拼邮"}
                            {p.shipping_method && ` · ${p.shipping_method}`}
                            {` · 当前 ${(p.order_ids || []).length} 件`}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {isJoiningPool && (
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      ℹ️ 加入已有拼邮需求后，运输方式与凑满重量设置将使用该需求的配置。发货期限设置仅适用于本次新加入的订单。
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Natural-language consolidation config */}
          {consolidation && !isJoiningPool && (
            <div className="border border-blue-100 rounded-xl overflow-hidden">
              <button type="button"
                onClick={() => setStrategyOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100/60 transition-colors">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">拼邮策略</p>
                <span className="text-xs text-blue-400">{strategyOpen ? "收起 ▲" : "展开 ▼"}</span>
              </button>
              {strategyOpen && (
              <div className="bg-blue-50 px-4 pb-4 space-y-3">

              <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                <span>在</span>
                <DeadlineToken value={deadline} onChange={setDeadline} />
                <span>前拼邮发出，</span>
              </div>

              <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                <span>使用</span>
                <Select value={consMethod} onValueChange={v => { setConsMethod(v); setConsMethodFallback(""); }}>
                  <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-blue-400 rounded-none bg-blue-50 text-blue-700 font-medium text-sm px-2 w-auto min-w-[120px] focus:ring-0 focus:border-blue-600">
                    <SelectValue placeholder="任何运输方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">任何运输方式</SelectItem>
                    {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {consMethod && consMethod !== "any" && (
                  <>
                    <span className="text-gray-400">或</span>
                    <Select value={consMethodFallback} onValueChange={setConsMethodFallback}>
                      <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-gray-300 rounded-none bg-gray-50 text-gray-500 font-medium text-sm px-2 w-auto min-w-[100px] focus:ring-0">
                        <SelectValue placeholder="可留空" />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIPPING_METHODS.filter(m => m.value !== consMethod).map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <span>，</span>
              </div>

              <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                <span>凑满</span>
                <Token type="number" value={minWeight} onChange={setMinWeight} placeholder="2000" suffix="g" />
                <span>时发货。</span>
              </div>

              {hasConsolidationConditions && (
                <div className="space-y-2 pt-1 border-t border-blue-100">
                  <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                    <span className="text-gray-500">若条件未达成，则</span>
                    <Token value={timeoutAction} onChange={setTimeoutAction} options={TIMEOUT_ACTIONS} />
                    <span>。</span>
                  </div>
                  {timeoutAction === "ship_individually" && (
                    <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5 pl-2">
                      <span className="text-gray-500">单独发货方式：</span>
                      <Select value={timeoutMethod} onValueChange={setTimeoutMethod}>
                        <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-blue-400 rounded-none bg-blue-50 text-blue-700 font-medium text-sm px-2 w-auto min-w-[120px] focus:ring-0">
                          <SelectValue placeholder="请选择" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

            </div>
            )}
          </div>
          )}

          {/* Privacy setting - shown for all consolidation types, including when joining a pool */}
          {consolidation && !isJoiningPool && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <label className={`flex items-center gap-3 cursor-pointer rounded-lg p-2 -m-2 transition-colors ${isPrivate ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                <Checkbox checked={isPrivate} onCheckedChange={v => { setIsPrivate(!!v); if (!v) setSharedWithEmails([]); }} />
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">不公开</span>
                  <span className="text-xs text-gray-400">（仅管理员和指定用户可见）</span>
                </div>
              </label>
              {isPrivate && (
                <div className="ml-2 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>选择可查看此拼邮需求的用户（管理员始终可见，无需选择）</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input placeholder="搜索用户..." className="pl-8 h-7 text-xs"
                      value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
                  </div>
                  {allUsers.length === 0 ? (
                    <p className="text-xs text-gray-400">暂无其他用户</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                      {filteredUsers.map(u => (
                        <label key={u.email} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                          <Checkbox checked={sharedWithEmails.includes(u.email)} onCheckedChange={() => toggleSharedUser(u.email)} />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-gray-700">{u.full_name || u.email}</span>
                            {u.full_name && <span className="text-xs text-gray-400 ml-1.5">{u.email}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {sharedWithEmails.length > 0 && (
                    <p className="text-xs text-gray-500">已选择与 {sharedWithEmails.length} 位用户分享</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Joining existing pool: show final address + deadline */}
          {isJoiningPool && (
            <div className="space-y-3">
              <AddressBlock
                slot="final"
                label="最终收货地址 *"
                savedAddresses={savedAddresses}
                selectedId={finalAddressId}
                isNewMode={!!addressInputMode["final"]}
                newAddress={newAddress}
                saveNewAddress={saveNewAddress}
                onSelect={(v) => handleAddressSelect(v, "final")}
                onNewAddressChange={setNewAddress}
                onSaveToggle={setSaveNewAddress}
              />
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">发货期限（仅适用于本次订单）</p>
                <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                  <span>在</span>
                  <DeadlineToken value={deadline} onChange={setDeadline} />
                  <span>前发出。</span>
                </div>
              </div>
            </div>
          )}

          {/* Address picker for consType="other" */}
          {consType === "other" && (
            <AddressBlock
              slot="other"
              label="拼邮目标地址 *"
              savedAddresses={savedAddresses}
              selectedId={selectedAddress}
              isNewMode={!!addressInputMode["other"]}
              newAddress={newAddress}
              saveNewAddress={saveNewAddress}
              onSelect={(v) => handleAddressSelect(v, "other")}
              onNewAddressChange={setNewAddress}
              onSaveToggle={setSaveNewAddress}
            />
          )}

          <TransitMethodSection
            consType={isJoiningPool ? (selectedPool?.consolidation_type || consType) : consType}
            selectedTransitId={isJoiningPool ? (selectedPool?.transit_location_id || selectedTransitId) : selectedTransitId}
            transitLocations={transitLocations}
            transitMethods={transitMethods}
            selectedTransitMethodId={selectedTransitMethodId}
            setSelectedTransitMethodId={setSelectedTransitMethodId}
          />

          {/* Show shipping addons for all shipment types */}
          {!joinDirectPool && (
            <TransitAddonSection
              consType={consType}
              selectedTransitId={isJoiningPool ? (selectedPool?.transit_location_id || selectedTransitId) : selectedTransitId}
              transitLocations={transitLocations}
              shippingAddons={shippingAddons}
              selectedAddonIds={selectedAddonIds}
              setSelectedAddonIds={setSelectedAddonIds}
            />
          )}

          {/* Pool title — only when creating a new pool (not joining existing) */}
          {!joinDirectPool && !isJoiningPool && (
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">发货申请名称（可选）</label>
              <Input
                placeholder="不填则使用系统自动生成的编号"
                value={poolTitle}
                onChange={e => setPoolTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">备注（可选）</label>
            <Textarea rows={3} placeholder="特殊要求或补充说明..." value={note} onChange={e => setNote(e.target.value)} className="mt-1.5" />
          </div>
        </div>

        {/* Footer: missing required fields reminder */}
        {(() => {
          const missing = [];
          if (!method && !joinDirectPool && !isJoiningPool) missing.push("发货方式");
          if (!isJoiningPool && consType === "transit" && !selectedTransitId) missing.push("中转地");
          if (!isJoiningPool && consType === "transit" && !isAddressSlotOk("final")) {
            const inNew = !!addressInputMode["final"] || savedAddresses.length === 0;
            if (inNew) {
              if (!newAddress.label?.trim()) missing.push("收货地址：地址标签");
              if (!newAddress.recipient_name?.trim()) missing.push("收货地址：受取人お名前");
              if (!newAddress.country?.trim()) missing.push("收货地址：受取人国名");
              if (!newAddress.addr2?.trim()) missing.push("収货地址：住所2");
              if (!newAddress.addr1?.trim()) missing.push("收货地址：住所1");
              if (!newAddress.state?.trim()) missing.push("收货地址：州名など");
              if (!newAddress.phone?.trim()) missing.push("收货地址：連絡先電話番号");
            } else {
              missing.push("最终收货地址");
            }
          }
          if (isJoiningPool && !isAddressSlotOk("final")) {
            const inNew = !!addressInputMode["final"] || savedAddresses.length === 0;
            if (inNew) {
              if (!newAddress.label?.trim()) missing.push("收货地址：地址标签");
              if (!newAddress.recipient_name?.trim()) missing.push("收货地址：受取人お名前");
              if (!newAddress.country?.trim()) missing.push("收货地址：受取人国名");
              if (!newAddress.addr2?.trim()) missing.push("収货地址：住所2");
              if (!newAddress.addr1?.trim()) missing.push("收货地址：住所1");
              if (!newAddress.state?.trim()) missing.push("收货地址：州名など");
              if (!newAddress.phone?.trim()) missing.push("收货地址：連絡先電話番号");
            } else {
              missing.push("最终收货地址");
            }
          }
          if (!isJoiningPool && consType === "" && !joinDirectPool && !isAddressSlotOk("direct")) {
            const inNew = !!addressInputMode["direct"] || savedAddresses.length === 0;
            if (inNew) {
              if (!newAddress.label?.trim()) missing.push("收货地址：地址标签");
              if (!newAddress.recipient_name?.trim()) missing.push("收货地址：受取人お名前");
              if (!newAddress.country?.trim()) missing.push("收货地址：受取人国名");
              if (!newAddress.addr2?.trim()) missing.push("收货地址：住所2");
              if (!newAddress.addr1?.trim()) missing.push("收货地址：住所1");
              if (!newAddress.state?.trim()) missing.push("收货地址：州名など");
              if (!newAddress.phone?.trim()) missing.push("收货地址：連絡先電話番号");
            } else {
              missing.push("收货地址");
            }
          }
          if (!isJoiningPool && consType === "other" && !isAddressSlotOk("other")) {
            const inNew = !!addressInputMode["other"] || savedAddresses.length === 0;
            if (inNew) {
              if (!newAddress.label?.trim()) missing.push("拼邮地址：地址标签");
              if (!newAddress.recipient_name?.trim()) missing.push("拼邮地址：受取人お名前");
              if (!newAddress.country?.trim()) missing.push("拼邮地址：受取人国名");
              if (!newAddress.addr2?.trim()) missing.push("拼邮地址：住所2");
              if (!newAddress.addr1?.trim()) missing.push("拼邮地址：住所1");
              if (!newAddress.state?.trim()) missing.push("拼邮地址：州名など");
              if (!newAddress.phone?.trim()) missing.push("拼邮地址：連絡先電話番号");
            } else {
              missing.push("拼邮目标地址");
            }
          }
          if (joinExistingPool && !selectedPoolId) missing.push("拼邮需求");
          if (joinDirectPool && !selectedDirectPoolId) missing.push("发货申请");
          if (missing.length === 0) return null;
          return (
            <div className="px-5 pb-3">
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-orange-700 mb-1">⚠️ 请填写以下必填项后再提交：</p>
                <ul className="space-y-0.5">
                  {missing.map((m, i) => (
                    <li key={i} className="text-xs text-orange-600">· {m}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button
             size="sm"
             className="bg-red-600 hover:bg-red-700"
             onClick={handleSubmit}
             disabled={
               (!method && !joinDirectPool && !isJoiningPool) || submitting ||
               (method && !isJoiningPool && getMethodError()) ||
               (!isJoiningPool && consType === "transit" && !selectedTransitId) ||
               (!isJoiningPool && consType === "transit" && !isAddressSlotOk("final")) ||
               (isJoiningPool && !isAddressSlotOk("final")) ||
               (isJoiningPool && selectedPool?.consolidation_type === "transit" && !selectedTransitMethodId) ||
               (!isJoiningPool && consType === "" && !joinDirectPool && !isAddressSlotOk("direct")) ||
               (!isJoiningPool && consType === "other" && !isAddressSlotOk("other")) ||
               (joinExistingPool && !selectedPoolId) ||
               (joinDirectPool && !selectedDirectPoolId)
             }
           >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "提交中..." : joinDirectPool && selectedDirectPoolId ? `加入发货申请 (${targetOrders.length})` : isJoiningPool ? `加入拼邮需求 (${targetOrders.length})` : isMulti ? `确认通知发货 (${targetOrders.length})` : "确认通知发货"}
          </Button>
        </div>
      </div>
    </div>
  );
}