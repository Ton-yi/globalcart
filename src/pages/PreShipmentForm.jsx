/**
 * PreShipmentForm - 预出货信息填写页
 * 用户在提交订单后，预先填写出货信息。
 * 订单入库后系统自动按此信息生成发货申请。
 * URL params: order_id
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { fetchTenantConfig, tenantEntity } from "@/lib/tenantApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import AddressForm, { EMPTY_ADDRESS_FORM, serializeAddressToText, isAddressFormValid } from "@/components/common/AddressForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, Package, MapPin, Check, ChevronLeft, PlusCircle, Zap } from "lucide-react";
import PaymentMethodSelector from "@/components/common/PaymentMethodSelector";

export default function PreShipmentForm() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("order_id");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Config data
  const [shippingMethods, setShippingMethods] = useState([]);
  const [transitLocations, setTransitLocations] = useState([]);
  const [shippingAddons, setShippingAddons] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Form state
  const [consType, setConsType] = useState(""); // "" = direct, "transit" = transit
  const [joinOfficialPool, setJoinOfficialPool] = useState(false); // Join official shipping pool
  const [selectedPoolId, setSelectedPoolId] = useState(""); // Specific pool selection
  const [joinExistingPool, setJoinExistingPool] = useState(false); // Join existing pool (direct or transit)
  const [selectedExistingPoolId, setSelectedExistingPoolId] = useState(""); // Selected existing pool
  const [shippingMethod, setShippingMethod] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [userNote, setUserNote] = useState("");
  const [transitLocationId, setTransitLocationId] = useState("");
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [addonCustomFees, setAddonCustomFees] = useState({});
  const [addonFeeErrors, setAddonFeeErrors] = useState({});
  const [address, setAddress] = useState({ label: "", ...EMPTY_ADDRESS_FORM });
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  
  // Official pools for selection
  const [officialPools, setOfficialPools] = useState([]);

  // Payment after submit (direct to payment page if needed)
  const [paymentMethod, setPaymentMethod] = useState("");

  useEffect(() => {
    if (!orderId || !user) return;
    
    let isMounted = true;
    
    const loadData = async () => {
      try {
        const [ord, cfg, prefs, methods, poolsRes] = await Promise.all([
          base44.functions.invoke('getTenantOrders', {}).then(r => (r.data?.orders || []).find(o => o.id === orderId)),
          fetchTenantConfig(),
          tenantEntity.list('UserPreference', { user_email: user.email }).catch(() => []),
          base44.functions.invoke('managePaymentMethod', { action: 'list' }).then(r => r.data?.methods || []).catch(() => []),
          base44.functions.invoke('getTenantShippingPools', { status: 'pending' }).catch(() => ({ data: { pools: [] } })),
        ]);
        
        if (!isMounted) return;
        
        setOrder(ord || null);

        // Pre-fill form if order already has pre_shipment data (edit mode)
        if (ord?.pre_shipment) {
          const ps = ord.pre_shipment;
          if (ps.shipping_method) setShippingMethod(ps.shipping_method);
          if (ps.scheduled_ship_date) setScheduledDate(ps.scheduled_ship_date);
          if (ps.user_note) setUserNote(ps.user_note);
          const savedConsType = ps.consType || "";
          setConsType(savedConsType);
          if (ps.transit_location_id) setTransitLocationId(ps.transit_location_id);
          if (ps.selected_addon_ids) setSelectedAddonIds(ps.selected_addon_ids);
          // Restore the specific pool selection (use target_pool_id, NOT pool_created which is an automation flag)
          if (savedConsType === "official_pool") {
            setJoinOfficialPool(true);
            setSelectedPoolId(ps.target_pool_id || "");
          }
        }
        
        // Deduplicate shipping methods by id - ensure unique
        const allMethods = (cfg.shippingMethods || []).filter(m => m.is_active !== false);
        const uniqueMap = new Map();
        allMethods.forEach(m => {
          if (!uniqueMap.has(m.id)) {
            uniqueMap.set(m.id, m);
          }
        });
        const deduped = Array.from(uniqueMap.values());
        
        // Only update if data actually changed (prevent unnecessary re-renders)
        setShippingMethods(prev => {
          const prevIds = prev.map(m => m.id).join(',');
          const newIds = deduped.map(m => m.id).join(',');
          return prevIds === newIds ? prev : deduped;
        });
        
        setTransitLocations(prev => {
          const filtered = (cfg.transitLocations || []).filter(l => l.is_active !== false);
          const prevIds = prev.map(l => l.id).join(',');
          const newIds = filtered.map(l => l.id).join(',');
          return prevIds === newIds ? prev : filtered;
        });
        
        setShippingAddons(prev => {
          const filtered = (cfg.addons || []).filter(a => a.addon_type === 'shipping' && a.is_active !== false);
          const prevIds = prev.map(a => a.id).join(',');
          const newIds = filtered.map(a => a.id).join(',');
          return prevIds === newIds ? prev : filtered;
        });
        
        setPaymentMethods(prev => {
          const prevIds = prev.map(m => m.id || m.name).join(',');
          const newIds = (methods || []).map(m => m.id || m.name).join(',');
          return prevIds === newIds ? prev : (methods || []);
        });
        
        // Set official pools (admin-created pools)
        const allPools = poolsRes.data?.pools || [];
        const adminPools = allPools.filter(p => p.is_admin_created === true);
        setOfficialPools(adminPools);

        const pref = prefs[0];
        const addrs = (pref?.saved_addresses || []).map(a => ({ ...EMPTY_ADDRESS_FORM, ...a }));
        setSavedAddresses(addrs);

        // If editing and order has a saved address, restore it
        const existingAddress = ord?.pre_shipment?.address;
        if (existingAddress && existingAddress.recipient_name) {
          setAddress({ label: existingAddress.label || "", ...existingAddress });
          setUseNewAddress(true);
          setSelectedAddressId("");
        } else {
          const defaultId = pref?.default_address_id || "";
          const defaultAddr = addrs.find(a => a.id === defaultId) || addrs[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setAddress({ label: defaultAddr.label || "", ...defaultAddr });
            setUseNewAddress(false);
          } else {
            setUseNewAddress(true);
          }
        }
        if (isMounted) setLoading(false);
      } catch (error) {
        console.error('[PreShipmentForm] Load error:', error);
        if (isMounted) setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [orderId, user?.email]);

  const handleAddressSelect = (id) => {
    if (id === "__new__") {
      setSelectedAddressId("");
      setUseNewAddress(true);
      setAddress({ label: "", ...EMPTY_ADDRESS_FORM });
      setSaveAddress(false);
    } else {
      setSelectedAddressId(id);
      setUseNewAddress(false);
      const addr = savedAddresses.find(a => a.id === id);
      if (addr) setAddress({ label: addr.label || "", ...addr });
      setSaveAddress(false);
    }
  };

  // Filter addons based on selected transit location's disabled_addon_ids
  const selectedTransitLocation = transitLocations.find(l => l.id === transitLocationId);
  const disabledAddonIds = (consType === "transit" && selectedTransitLocation?.disabled_addon_ids) 
    ? selectedTransitLocation.disabled_addon_ids 
    : [];
  const availableAddons = shippingAddons.filter(a => !disabledAddonIds.includes(a.id));

  // Remove any selected addons that are now disabled when transit location changes
  const effectiveSelectedAddonIds = selectedAddonIds.filter(id => !disabledAddonIds.includes(id));
  const selectedAddons = availableAddons.filter(a => effectiveSelectedAddonIds.includes(a.id));

  // When user picks a specific official pool (not "default"), shipping method is not required
  const specificPoolSelected = consType === "official_pool" && !!selectedPoolId;

  const canSubmit = () => {
    if (!specificPoolSelected && !shippingMethod) return false;
    if (consType === "transit") return !!transitLocationId;
    if (consType === "official_pool") return true;
    return isAddressFormValid(address);
  };

  const handleSubmit = async () => {
    if (!canSubmit() || submitting) return;
    
    // Validate addon custom fees are within range
    const hasFeeErrors = Object.entries(addonCustomFees).some(([addonId, fee]) => {
      const addon = shippingAddons.find(a => a.id === addonId);
      return addon && addon.is_user_customizable && effectiveSelectedAddonIds.includes(addonId) && 
             (fee < addon.min_fee || fee > addon.max_fee);
    });
    
    if (hasFeeErrors) {
      alert('请确保所有自定义增值服务的金额都在指定区间内');
      return;
    }
    
    setSubmitting(true);

    // Save new address if requested
    if (useNewAddress && saveAddress && isAddressFormValid(address) && address.label?.trim()) {
      const existingPrefs = await tenantEntity.list('UserPreference', { user_email: user.email });
      const existingAddrs = existingPrefs[0]?.saved_addresses || [];
      const newEntry = {
        id: Date.now().toString(),
        label: address.label.trim(),
        full_text: serializeAddressToText(address),
        ...address,
      };
      if (existingPrefs.length > 0) {
        await tenantEntity.update('UserPreference', existingPrefs[0].id, { saved_addresses: [...existingAddrs, newEntry] });
      } else {
        await tenantEntity.create('UserPreference', { user_email: user.email, saved_addresses: [newEntry] });
      }
    }

    const effectiveAddress = useNewAddress ? address : (savedAddresses.find(a => a.id === selectedAddressId) || address);
    const transitLoc = transitLocations.find(l => l.id === transitLocationId);
    
    // Handle official pool selection
    const selectedPool = officialPools.find(p => p.id === selectedPoolId);
    const poolCode = selectedPool?.pool_code || "";
    
    // Handle existing pool selection (direct or transit)
    const existingPool = officialPools.find(p => p.id === selectedExistingPoolId);
    const existingPoolCode = existingPool?.pool_code || "";

    const preShipment = {
      shipping_method: shippingMethod,
      scheduled_ship_date: scheduledDate,
      user_note: userNote,
      consType,
      transit_location_id: consType === "transit" ? transitLocationId : "",
      transit_location_name: consType === "transit" ? (transitLoc?.name || "") : "",
      address: consType === "transit" || consType === "official_pool" ? {} : { ...effectiveAddress },
      selected_addon_ids: effectiveSelectedAddonIds,
      selected_addons: selectedAddons.map(a => {
        const customFee = addonCustomFees[a.id];
        const isCustomizable = a.is_user_customizable;
        return {
          id: a.id,
          name: a.name,
          fee: isCustomizable && customFee !== undefined ? customFee : a.fee,
          fee_currency: a.fee_currency
        };
      }),
      pool_created: consType === "official_pool" || (joinExistingPool && !!selectedExistingPoolId),
      target_pool_id: consType === "official_pool" ? selectedPoolId : (joinExistingPool ? selectedExistingPoolId : ""),
      target_pool_code: consType === "official_pool" ? poolCode : (joinExistingPool ? existingPoolCode : ""),
      target_pool_title: consType === "official_pool" && selectedPool ? (selectedPool.title || selectedPool.pool_code) : (joinExistingPool && existingPool ? (existingPool.title || existingPool.pool_code) : ""),
      join_existing_pool: joinExistingPool,
    };

    const res = await base44.functions.invoke('updateTenantOrder', {
      order_id: orderId,
      pre_shipment: preShipment,
    });

    // Update local order state so subsequent edits in the same session see fresh data
    if (res?.data?.order) {
      setOrder(res.data.order);
    } else {
      setOrder(prev => ({ ...prev, pre_shipment: preShipment }));
    }

    setSubmitting(false);

    // If order needs payment, redirect directly to payment page
    const needsPayment = order.payment_status === "awaiting_payment" || order.order_status === "payment_pending";
    if (needsPayment) {
      const m = paymentMethods.find(pm => (pm.provider_key || pm.name) === paymentMethod || pm.value === paymentMethod);
      const cur = m?.payment_currency || "JPY";
      const method = paymentMethod || "other";
      navigate(`/Payment?order_id=${orderId}&method=${method}&pay_currency=${cur}`);
      return;
    }

    setSubmitted(true);
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto py-12 text-center text-gray-400 text-sm">加载中...</div>;
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-gray-400">
        <p className="text-sm">订单不存在或无法访问</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(createPageUrl("MyOrders"))}>返回我的订单</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">预出货信息已保存</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            订单入库后，系统将自动按照您填写的信息生成发货申请，无需再手动操作。
          </p>
        </div>

        {/* Order summary */}
        <Card className="border-green-100 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Package className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-800">{order.product_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{order.order_number}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate(createPageUrl("MyOrders"))}>
            查看我的订单
          </Button>
          {(order.payment_status === "awaiting_payment" || order.order_status === "payment_pending") && (
            <Button className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={() => {
                const m = paymentMethods.find(pm => (pm.provider_key || pm.name) === paymentMethod);
                const cur = m?.payment_currency || "JPY";
                navigate(`/Payment?order_id=${orderId}&method=${paymentMethod || "other"}&pay_currency=${cur}`);
              }}>
              前往付款
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(createPageUrl("MyOrders"))} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{order?.pre_shipment ? "编辑预出货信息" : "预出货信息"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">预先填写，入库后自动生成发货申请</p>
        </div>
      </div>

      {/* Order card */}
      <Card className="border-gray-200">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{order.product_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{order.order_number} · ¥{(order.estimated_jpy || 0).toLocaleString()}</p>
            </div>
            <Badge variant="outline" className="text-xs flex-shrink-0">预出货</Badge>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50">
        <Zap className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          填写后，管理员确认订单入库时，系统将自动按此信息创建发货申请，跳过手动通知步骤。
        </AlertDescription>
      </Alert>

      {/* Consignment type & transit location */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck className="w-4 h-4" />发货方式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Direct vs transit vs official pool */}
          <div className="space-y-2">
            {[
              { key: "", label: "直接发货", desc: "货品直接从日本发往收货地址" },
              ...(transitLocations.length > 0 ? [{ key: "transit", label: "发往中转地", desc: "货品先发往中转地，再自行安排" }] : []),
              { key: "official_pool", label: "加入官方拼邮", desc: "加入管理员创建的拼邮池，享受优惠运费" },
            ].map(opt => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${consType === opt.key ? "border-red-300 bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" checked={consType === opt.key} onChange={() => {
                  setConsType(opt.key);
                  setJoinExistingPool(false);
                  setSelectedExistingPoolId("");
                  if (opt.key === "official_pool") {
                    setJoinOfficialPool(true);
                    setUseNewAddress(false);
                  }
                }} className="mt-0.5 accent-red-600" />
                <div>
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Direct shipping - option to join existing pool */}
          {consType === "" && (
            <div className="space-y-2 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
              <Label className="text-xs text-blue-700 font-medium">是否加入已有的直接发货申请？</Label>
              <div className="space-y-1.5">
                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${!joinExistingPool ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                  <input type="radio" checked={!joinExistingPool} onChange={() => setJoinExistingPool(false)} className="mt-0.5 accent-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">创建新的直接发货申请</p>
                    <p className="text-xs text-gray-500">单独发货到您填写的地址</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${joinExistingPool ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                  <input type="radio" checked={joinExistingPool} onChange={() => setJoinExistingPool(true)} className="mt-0.5 accent-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">加入已有的直接发货申请</p>
                    <p className="text-xs text-gray-500">与其他订单合并发货（如有）</p>
                  </div>
                </label>
              </div>
              
              {joinExistingPool && (
                <div className="mt-2 space-y-2">
                  <Label className="text-xs text-blue-700">选择要加入的发货申请</Label>
                  {/* Fetch and display user's existing direct shipping pools */}
                  {(() => {
                    const myDirectPools = officialPools.filter(p => !p.is_admin_created && !p.consolidation_type && p.creator_email === user.email);
                    if (myDirectPools.length === 0) {
                      return (
                        <div className="text-sm text-gray-500 py-2">
                          暂无可用的直接发货申请，将创建新的发货申请
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        {myDirectPools.map(pool => (
                          <label key={pool.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedExistingPoolId === pool.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                            <input type="radio" checked={selectedExistingPoolId === pool.id} onChange={() => setSelectedExistingPoolId(pool.id)} className="mt-0.5 accent-blue-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{pool.pool_code}</p>
                              <p className="text-xs text-gray-500">已参团：{pool.order_ids?.length || 0} 单 · 运输方式：{pool.shipping_method || '未设置'}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Transit location */}
          {consType === "transit" && (
            <>
              <div className="space-y-2 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
                <Label className="text-xs text-blue-700 font-medium">选择中转地 *</Label>
                {transitLocations.map(l => (
                  <label key={l.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${transitLocationId === l.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                    <input type="radio" checked={transitLocationId === l.id} onChange={() => setTransitLocationId(l.id)} className="mt-0.5 accent-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{l.name}</p>
                      {l.manager_contact && <p className="text-xs text-gray-400">联系：{l.manager_contact}</p>}
                    </div>
                  </label>
                ))}
              </div>
              
              {/* Option to join existing transit pool */}
              <div className="space-y-2 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
                <Label className="text-xs text-blue-700 font-medium">是否加入已有的中转拼邮申请？</Label>
                <div className="space-y-1.5">
                  <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${!joinExistingPool ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                    <input type="radio" checked={!joinExistingPool} onChange={() => setJoinExistingPool(false)} className="mt-0.5 accent-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">创建新的中转拼邮申请</p>
                      <p className="text-xs text-gray-500">单独发货到选中转地</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${joinExistingPool ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                    <input type="radio" checked={joinExistingPool} onChange={() => setJoinExistingPool(true)} className="mt-0.5 accent-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">加入已有的中转拼邮申请</p>
                      <p className="text-xs text-gray-500">与其他订单合并拼邮（如有）</p>
                    </div>
                  </label>
                </div>
                
                {joinExistingPool && (
                  <div className="mt-2 space-y-2">
                    <Label className="text-xs text-blue-700">选择要加入的拼邮申请</Label>
                    {(() => {
                      const myTransitPools = officialPools.filter(p => p.consolidation_type === 'transit' && p.creator_email === user.email);
                      if (myTransitPools.length === 0) {
                        return (
                          <div className="text-sm text-gray-500 py-2">
                            暂无可用的中转拼邮申请，将创建新的拼邮申请
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5">
                          {myTransitPools.map(pool => (
                            <label key={pool.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedExistingPoolId === pool.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                              <input type="radio" checked={selectedExistingPoolId === pool.id} onChange={() => setSelectedExistingPoolId(pool.id)} className="mt-0.5 accent-blue-600" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{pool.pool_code}</p>
                                <p className="text-xs text-gray-500">已参团：{pool.order_ids?.length || 0} 单 · 中转地：{pool.transit_location_name || '未设置'}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Official pool selection */}
          {consType === "official_pool" && (
            <div className="space-y-2 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
              <Label className="text-xs text-blue-700 font-medium">选择要加入的官方拼邮池</Label>
              {officialPools.length > 0 ? (
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${!selectedPoolId ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                    <input type="radio" checked={!selectedPoolId} onChange={() => setSelectedPoolId("")} className="mt-0.5 accent-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">默认拼官方</p>
                      <p className="text-xs text-gray-500">系统将自动匹配最近的同运输方式拼邮池</p>
                    </div>
                  </label>
                  {officialPools.map(pool => (
                    <label key={pool.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedPoolId === pool.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                      <input type="radio" checked={selectedPoolId === pool.id} onChange={() => setSelectedPoolId(pool.id)} className="mt-0.5 accent-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{pool.title || pool.pool_code}</p>
                        <p className="text-xs text-gray-500">已参团：{pool.order_ids?.length || 0} 单 · 截止：{pool.consolidation_deadline || '未设置'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-2">
                  暂无可用的官方拼邮池，将默认加入最近的同类型拼邮
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping method & date — greyed out when a specific official pool is selected */}
      <Card className={`border-gray-200 transition-opacity ${specificPoolSelected ? "opacity-40 pointer-events-none" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-4 h-4" />运输方式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">运输方式 *</Label>
            {shippingMethods.length > 0 ? (
              <Select value={shippingMethod} onValueChange={setShippingMethod}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="选择运输方式..." />
                </SelectTrigger>
                <SelectContent>
                  {shippingMethods.map(m => <SelectItem key={`${m.id}-${m.code}`} value={m.code}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input className="mt-1 h-9 text-sm" placeholder="如：EMS、海运..." value={shippingMethod} onChange={e => setShippingMethod(e.target.value)} />
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-500">期望发货日期（可选）</Label>
            <div className="flex gap-2 mt-1">
              <button type="button"
                onClick={() => setScheduledDate(scheduledDate === "__asap__" ? "" : "__asap__")}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-md border text-sm transition-colors ${scheduledDate === "__asap__" ? "border-orange-400 bg-orange-50 text-orange-600 font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                ⚡ 尽快
              </button>
              <Input type="date" className="h-9 text-sm flex-1"
                value={scheduledDate === "__asap__" ? "" : scheduledDate}
                onChange={e => setScheduledDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address (only for direct shipment) */}
      {consType === "" && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" />收货地址
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedAddresses.length > 0 && (
              <Select value={useNewAddress ? "__new__" : (selectedAddressId || "")} onValueChange={handleAddressSelect}>
                <SelectTrigger><SelectValue placeholder="选择地址簿中的地址" /></SelectTrigger>
                <SelectContent>
                  {savedAddresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  <SelectItem value="__new__">
                    <span className="flex items-center gap-1.5 text-blue-600"><PlusCircle className="w-3.5 h-3.5" />输入新地址</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {!useNewAddress && selectedAddressId && (() => {
              const addr = savedAddresses.find(a => a.id === selectedAddressId);
              return addr ? (
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap">
                  {addr.full_text || serializeAddressToText(addr)}
                </div>
              ) : null;
            })()}
            {(useNewAddress || savedAddresses.length === 0) && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-500">地址标签</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="如：家、公司"
                    value={address.label || ""} onChange={e => setAddress(p => ({ ...p, label: e.target.value }))} />
                </div>
                <AddressForm value={address} onChange={v => setAddress(p => ({ ...p, ...v }))} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={saveAddress} onCheckedChange={v => setSaveAddress(!!v)} />
                  <span className="text-xs text-gray-600">保存此地址到地址簿</span>
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Addons */}
      {availableAddons.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">发货增值服务（可选）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableAddons.map(a => {
              const isSelected = effectiveSelectedAddonIds.includes(a.id);
              const isCustomizable = a.is_user_customizable;
              return (
                <div key={a.id} className={`rounded-lg border p-2.5 transition-colors ${isSelected ? "border-yellow-400 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox checked={isSelected}
                        onCheckedChange={v => setSelectedAddonIds(prev => v ? [...prev, a.id] : prev.filter(id => id !== a.id))} />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{a.name}</span>
                          {isCustomizable && (
                            <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">用户可自定义</Badge>
                          )}
                          {a.description && <span className="text-xs text-gray-400">{a.description}</span>}
                        </div>
                        {isCustomizable && (
                          <span className="text-[10px] text-gray-500">区间：{a.fee_currency || "JPY"} {a.min_fee} - {a.max_fee} · 默认：{Number(a.fee || 0).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    {!isCustomizable && (
                      <span className="text-xs font-medium text-yellow-700 flex-shrink-0">+{a.fee_currency || "JPY"} {Number(a.fee || 0).toLocaleString()}</span>
                    )}
                  </label>
                  {isCustomizable && isSelected && (
                    <div className="mt-2 ml-6 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-600 font-medium">用户可自定义</span>
                        <Input
                          type="number"
                          className="h-7 w-28 text-xs"
                          placeholder={`${a.min_fee}-${a.max_fee}`}
                          value={addonCustomFees[a.id] ?? a.fee}
                          onChange={(e) => {
                            const val = e.target.value;
                            const value = val === '' ? '' : parseFloat(val) || 0;
                            setAddonCustomFees(prev => ({ ...prev, [a.id]: value }));
                            if (value === '' || value < a.min_fee || value > a.max_fee) {
                              setAddonFeeErrors(prev => ({ ...prev, [a.id]: value === '' ? '请输入金额' : `请输入${a.min_fee}-${a.max_fee}之间的金额` }));
                            } else {
                              setAddonFeeErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors[a.id];
                                return newErrors;
                              });
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs text-yellow-700">{a.fee_currency || "JPY"}</span>
                      </div>
                      {addonFeeErrors[a.id] && (
                        <span className="text-[10px] text-red-600">{addonFeeErrors[a.id]}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Note */}
      <Card className="border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">备注（可选）</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={2} className="text-sm" placeholder="特殊要求、包装说明..."
            value={userNote} onChange={e => setUserNote(e.target.value)} />
        </CardContent>
      </Card>

      {/* Payment section (if order needs payment) */}
      {(order.payment_status === "awaiting_payment" || order.order_status === "payment_pending") && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">付款方式</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={m => setPaymentMethod(m.value)}
              prefetched={paymentMethods.length > 0 ? paymentMethods : null}
              activeColor="border-red-500 bg-red-50 text-red-700"
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <Button variant="outline" className="flex-1" onClick={() => navigate(createPageUrl("MyOrders"))}>
          跳过，稍后再说
        </Button>
        <Button
          className="flex-1 bg-red-600 hover:bg-red-700"
          disabled={!canSubmit() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "保存中..." : "保存预出货信息"}
        </Button>
      </div>
    </div>
  );
}