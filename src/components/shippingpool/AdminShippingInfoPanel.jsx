/**
 * AdminShippingInfoPanel
 * Two-step admin panel for filling shipping info on a ShippingPool.
 *
 * Step 1 (pending → awaiting_payment): fill info, notify user to pay.
 * Step 2 (ready_to_ship → shipped): fill tracking number, confirm dispatch.
 *
 * Shows full per-user fee breakdown using calcFeeBreakdownPerUser.
 */
import { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi, updateOrder } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Truck, CheckCircle, ExternalLink, X, Plus, Loader2, MapPin } from "lucide-react";
import { getCountry, getCountryZone } from "@/lib/countries";
import { calcFeeBreakdownPerUser } from "@/lib/shippingFeeCalc";
import { getExchangeRates } from "@/lib/exchangeRates";
import ShippingFeeBreakdown from "@/components/shippingpool/ShippingFeeBreakdown";
import { ImageWithViewer } from "@/components/common/ImageViewer";

const STATUS_CONFIG = {
  pending:                       { label: "待处理",    color: "bg-amber-100 text-amber-700" },
  awaiting_payment:              { label: "待付款",    color: "bg-orange-100 text-orange-700" },
  awaiting_payment_confirmation: { label: "待确认付款", color: "bg-blue-100 text-blue-700" },
  ready_to_ship:                 { label: "待发货",    color: "bg-lime-100 text-lime-700" },
  shipped:                       { label: "已发货",    color: "bg-green-100 text-green-700" },
  delivered:                     { label: "已签收",    color: "bg-emerald-100 text-emerald-700" },
  cancelled:                     { label: "已取消",    color: "bg-red-100 text-red-600" },
  processing:                    { label: "处理中",    color: "bg-blue-100 text-blue-700" },
};

function PaymentProofImage({ url }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <>
      <div>
        <p className="text-xs text-blue-600 mb-1">付款凭证：</p>
        <img
          src={url}
          alt="付款凭证"
          className="max-w-full max-h-48 rounded-lg border border-blue-200 object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
          onClick={() => setLightboxOpen(true)}
          title="点击查看大图"
        />
      </div>
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <button className="absolute -top-8 right-0 text-white/70 hover:text-white" onClick={() => setLightboxOpen(false)}>
              <X className="w-5 h-5" />
            </button>
            <img
              src={url}
              alt="付款凭证大图"
              className="max-w-[85vw] max-h-[75vh] rounded-xl object-contain shadow-2xl cursor-pointer"
              onClick={() => window.open(url, "_blank")}
              title="点击在新标签页打开"
            />
            <button
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs"
              onClick={() => window.open(url, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5" />在新标签页打开
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminShippingInfoPanel({
  pool: initialPool,
  orders = [],
  boxTemplates = [],
  shippingMethods = [],
  defaultPackingFeeSingle = 0,
  defaultPackingFeeConsolidation = 0,
  transitLocations = [],
  transitShippingMethods = [],
  onPoolUpdated,
}) {
  const isConsolidation = (initialPool.consolidation_type === "transit" || initialPool.consolidation_type === "other");

  // Derive unique users from orders
  const uniqueUsers = [...new Map(
    orders.filter(o => o.user_email).map(o => [o.user_email, { email: o.user_email, name: o.user_name || o.user_email }])
  ).values()];

  const initPackingFeesPerUser = () => {
    if ((initialPool.packing_fees_per_user || []).length > 0) return initialPool.packing_fees_per_user;
    const defaultFee = isConsolidation ? defaultPackingFeeConsolidation : defaultPackingFeeSingle;
    return uniqueUsers.map(u => ({ user_email: u.email, fee_jpy: defaultFee }));
  };

  const [pool, setPool] = useState(initialPool);
  const [saving, setSaving] = useState(false);
  const [confirmingSaving, setConfirmingSaving] = useState(false);
  const [exchangeRates, setExchangeRates] = useState(null);

  useEffect(() => {
    getExchangeRates().then(rates => setExchangeRates(rates)).catch(() => {});
  }, []);

  // Form fields
  const [trackingNumber, setTrackingNumber] = useState(pool.tracking_number || "");
  const [boxTemplateId, setBoxTemplateId] = useState(pool.box_template_id || "none");
  const [finalWeightG, setFinalWeightG] = useState(pool.final_weight_g?.toString() || pool.total_weight_g?.toString() || "");
  const [shippingFeeJpy, setShippingFeeJpy] = useState(pool.shipping_fee_jpy?.toString() || "");
  const [feeAutoCalced, setFeeAutoCalced] = useState(false);
  const [packingFeesPerUser, setPackingFeesPerUser] = useState(initPackingFeesPerUser);
  const [adminNote, setAdminNote] = useState(pool.admin_note || "");
  const [adminPackingNote, setAdminPackingNote] = useState(pool.admin_packing_note || "");

  // Image uploads
  const [labelImageUrls, setLabelImageUrls] = useState(pool.label_image_urls || []);
  const [packingImageUrls, setPackingImageUrls] = useState(pool.packing_image_urls || []);
  const [uploadingLabel, setUploadingLabel] = useState(false);
  const [uploadingPacking, setUploadingPacking] = useState(false);
  const [draggingLabel, setDraggingLabel] = useState(false);
  const [draggingPacking, setDraggingPacking] = useState(false);

  const selectedBox = boxTemplates.find(b => b.id === boxTemplateId);
  const boxWeight = selectedBox?.weight_g || 0;
  const boxPrice = selectedBox?.price_jpy || 0;
  const totalPackingFee = packingFeesPerUser.reduce((s, u) => s + (parseFloat(u.fee_jpy) || 0), 0);

  // Find the shipping method matching pool's shipping_method code
  const matchedShippingMethod = shippingMethods.find(m =>
    m.code === pool.shipping_method || m.name === pool.shipping_method
  ) || null;

  // Auto-calculate shipping fee from weight using the matched shipping method's rates
  const calcFeeFromWeight = (weightG) => {
    if (!matchedShippingMethod || !pool.destination_country) return null;
    const country = pool.destination_country;
    // Resolve zone code: if rates are stored by zone (e.g. "zone1"), map the country code first
    const zoneCode = getCountryZone(country); // e.g. "CN" → "zone1"
    if (matchedShippingMethod.rate_mode === "detailed") {
      // Try exact country match first, then fall back to zone match
      let rates = (matchedShippingMethod.detailed_rates || []).filter(r => r.country === country);
      if (rates.length === 0 && zoneCode) {
        rates = (matchedShippingMethod.detailed_rates || []).filter(r => r.country === zoneCode);
      }
      if (rates.length === 0) return null;
      const bracket = rates.find(r => weightG >= r.weight_from_g && weightG <= r.weight_to_g);
      if (!bracket) return null;
      const fee = Math.round(parseFloat(bracket.fee) || 0);
      const currency = bracket.currency || "JPY";
      return { fee, currency };
    } else {
      // Try exact country match first, then fall back to zone match
      let rates = (matchedShippingMethod.simple_rates || []).filter(r => r.country === country);
      if (rates.length === 0 && zoneCode) {
        rates = (matchedShippingMethod.simple_rates || []).filter(r => r.country === zoneCode);
      }
      if (rates.length === 0) return null;
      const r = rates[0];
      const firstWeightG = parseFloat(r.first_weight_g) || 0;
      const firstFee = parseFloat(r.first_weight_fee) || 0;
      const addUnitG = parseFloat(r.additional_unit_g) || 0;
      const addUnitFee = parseFloat(r.additional_unit_fee) || 0;
      if (weightG <= firstWeightG) return { fee: Math.round(firstFee), currency: r.currency || "JPY" };
      if (addUnitG <= 0) return { fee: Math.round(firstFee), currency: r.currency || "JPY" };
      const extra = Math.ceil((weightG - firstWeightG) / addUnitG) * addUnitFee;
      return { fee: Math.round(firstFee + extra), currency: r.currency || "JPY" };
    }
  };

  // Resolve transit location and shipping method from pool
  const transitLocation = transitLocations.find(l => l.id === pool.transit_location_id) || null;
  const transitShippingMethod = transitShippingMethods.find(m => m.id === pool.transit_shipping_method_id) || null;

  // Live fee breakdown calculation (includes packing fees, transit fees with currency conversion)
  const feeBreakdowns = useMemo(() => {
    if (orders.length === 0) return [];
    return calcFeeBreakdownPerUser({
      pool,
      orders,
      shippingFeeJpy: parseFloat(shippingFeeJpy) || 0,
      boxPriceJpy: boxPrice,
      packingFeesPerUser,
      transitLocation,
      transitShippingMethod,
      exchangeRates,
    });
  }, [orders, shippingFeeJpy, boxPrice, packingFeesPerUser, pool.selected_addons, pool.transit_location_id, pool.transit_shipping_method_id, exchangeRates]);

  // Grand total = sum of all users' total_jpy from the live breakdown
  const grandTotalJpy = feeBreakdowns.reduce((s, b) => s + (b.total_jpy || 0), 0);

  const buildUpdatePayload = () => {
    const btId = boxTemplateId === "none" ? "" : boxTemplateId;
    const breakdowns = calcFeeBreakdownPerUser({
      pool,
      orders,
      shippingFeeJpy: parseFloat(shippingFeeJpy) || 0,
      boxPriceJpy: btId ? boxPrice : 0,
      packingFeesPerUser,
      transitLocation,
      transitShippingMethod,
      exchangeRates,
    });
    return {
      tracking_number: trackingNumber,
      box_template_id: btId,
      box_template_name: btId ? (selectedBox?.name || "") : "",
      box_price_jpy: btId ? boxPrice : 0,
      final_weight_g: parseFloat(finalWeightG) || 0,
      shipping_fee_jpy: parseFloat(shippingFeeJpy) || 0,
      actual_fee: parseFloat(shippingFeeJpy) || 0,
      fee_currency: "JPY",
      packing_fee_jpy: totalPackingFee,
      packing_fees_per_user: packingFeesPerUser,
      fee_breakdown_per_user: breakdowns,
      admin_note: adminNote,
      admin_packing_note: adminPackingNote,
      label_image_urls: labelImageUrls,
      packing_image_urls: packingImageUrls,
    };
  };

  const handleSetAwaitingPayment = async () => {
    if (!shippingFeeJpy) return;
    setSaving(true);
    const payload = { ...buildUpdatePayload(), status: "awaiting_payment", payment_status: "unpaid" };
    await shippingPoolApi.update(pool.id, payload);
    // Update all orders in this pool to notified_shipment_fee_pending
    await Promise.all(
      (pool.order_ids || []).map(id =>
        updateOrder(id, { order_status: "notified_shipment_fee_pending" })
      )
    );
    setPool(p => ({ ...p, ...payload }));
    setSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  const handleSaveInfoOnly = async () => {
    setSaving(true);
    const payload = buildUpdatePayload();
    await shippingPoolApi.update(pool.id, payload);
    setPool(p => ({ ...p, ...payload }));
    setSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  const handleConfirmPayment = async () => {
    setConfirmingSaving(true);
    const payload = {
      ...buildUpdatePayload(),
      status: "ready_to_ship",
      payment_status: "paid",
      admin_confirmed_payment: true,
    };
    await shippingPoolApi.update(pool.id, payload);
    // Update all orders in this pool to notified_shipment_fee_paid
    await Promise.all(
      (pool.order_ids || []).map(id =>
        updateOrder(id, { order_status: "notified_shipment_fee_paid" })
      )
    );
    setPool(p => ({ ...p, ...payload }));
    setConfirmingSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  const handleShip = async () => {
    if (!trackingNumber) return;
    setSaving(true);
    const payload = {
      ...buildUpdatePayload(),
      status: "shipped",
      shipped_date: new Date().toISOString().split("T")[0],
    };
    await shippingPoolApi.update(pool.id, payload);
    await Promise.all(
      (pool.order_ids || []).map(id =>
        updateOrder(id, {
          order_status: "shipped",
          tracking_number: trackingNumber,
          shipped_date: payload.shipped_date,
        })
      )
    );
    setPool(p => ({ ...p, ...payload }));
    setSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  const handleUploadLabelImage = async (file) => {
    setUploadingLabel(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setLabelImageUrls(prev => [...prev, file_url]);
    setUploadingLabel(false);
  };

  const handleUploadPackingImage = async (file) => {
    setUploadingPacking(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPackingImageUrls(prev => [...prev, file_url]);
    setUploadingPacking(false);
  };

  const handleDrop = async (e, type) => {
    e.preventDefault();
    if (type === "label") setDraggingLabel(false); else setDraggingPacking(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    for (const file of files) {
      if (type === "label") await handleUploadLabelImage(file);
      else await handleUploadPackingImage(file);
    }
  };

  const currentStatus = pool.status;
  const isStep1 = currentStatus === "pending" || currentStatus === "processing";
  const isAwaitingPayment = currentStatus === "awaiting_payment";
  const isAwaitingConfirmation = currentStatus === "awaiting_payment_confirmation";
  const isStep2 = currentStatus === "ready_to_ship";
  const isDone = currentStatus === "shipped" || currentStatus === "delivered";

  return (
    <div className="border border-red-100 rounded-xl overflow-hidden">
      <div className="bg-red-50 px-4 py-2.5 border-b border-red-100 flex items-center justify-between">
        <span className="text-sm font-medium text-red-700">管理员操作</span>
        <Badge className={`text-xs ${STATUS_CONFIG[pool.status]?.color || ""}`}>
          {STATUS_CONFIG[pool.status]?.label}
        </Badge>
      </div>

      {isDone && (
        <div className="p-4 text-sm text-gray-500 text-center">
          {pool.status === "shipped" ? "📦 已发货" : "✅ 已签收"}
          {pool.tracking_number && <span className="ml-2 font-mono text-gray-700">{pool.tracking_number}</span>}
        </div>
      )}

      {(isStep1 || isStep2 || isAwaitingPayment || isAwaitingConfirmation) && (
        <div className="p-4 space-y-4">
          {isStep1 && (
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <strong>第一步：</strong>填写发货信息，通知用户确认并付款。运单号可在付款确认后填写。
            </p>
          )}
          {isAwaitingPayment && (
            <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              等待用户付款中。可继续修改发货信息。
            </p>
          )}
          {isAwaitingConfirmation && (
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              用户已提交付款，请核实后确认收款，进入待发货状态。
            </p>
          )}
          {isStep2 && (
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <strong>第二步：</strong>用户已付款，请填写运单号确认发货。
            </p>
          )}

          {/* User's shipping destination address (read-only) */}
          {(pool.recipient_name || pool.address_line1 || pool.state) && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs text-green-800 space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-green-700 mb-1">
                <MapPin className="w-3.5 h-3.5" />发货目的地（用户填写）
              </div>
              {pool.recipient_name && <div>收件人：<span className="font-medium">{pool.recipient_name}</span>{pool.recipient_phone && <span className="ml-2 text-green-600">{pool.recipient_phone}</span>}</div>}
              {pool.destination_country && <div>国家：<span className="font-medium">{getCountry(pool.destination_country)?.name || pool.destination_country}</span></div>}
              {pool.state && <div>省/州：<span className="font-medium">{pool.state}</span></div>}
              {pool.city && <div>城市/区：<span className="font-medium">{pool.city}</span></div>}
              {pool.address_line1 && <div>街道地址：<span className="font-medium">{pool.address_line1}</span></div>}
              {pool.address_line2 && <div>详细地址：<span className="font-medium">{pool.address_line2}</span></div>}
            </div>
          )}

          {/* Transit info (read-only, from pool) */}
          {(transitLocation || pool.transit_shipping_method_name) && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-0.5">
              {transitLocation && (
                <div>中转地：<span className="font-medium">{transitLocation.name}</span>
                  {transitLocation.handling_fee > 0 && <span className="ml-2 text-blue-500">手续费 ¥{transitLocation.handling_fee} {transitLocation.handling_fee_currency || "JPY"}/人</span>}
                </div>
              )}
              {pool.transit_shipping_method_name && (
                <div>中转运输：<span className="font-medium">{pool.transit_shipping_method_name}</span></div>
              )}
              {(pool.selected_addons || []).length > 0 && (
                <div>增值服务：<span className="font-medium">{(pool.selected_addons || []).map(a => `${a.name}（¥${a.fee}）`).join("、")}</span></div>
              )}
            </div>
          )}

          {/* Box template */}
          <div>
            <Label className="text-xs text-gray-500">外箱选择</Label>
            <Select value={boxTemplateId} onValueChange={setBoxTemplateId}>
              <SelectTrigger className="mt-1 h-auto min-h-8 text-sm py-1.5">
                {boxTemplateId === "none" ? (
                  <span className="text-gray-400">未使用外箱</span>
                ) : selectedBox ? (
                  <div className="flex items-center gap-2">
                    {selectedBox.image_url && <img src={selectedBox.image_url} alt="" className="w-6 h-6 rounded object-cover border border-gray-100 flex-shrink-0" />}
                    <span className="font-medium">{selectedBox.name}</span>
                    {selectedBox.weight_g > 0 && <span className="text-gray-400 text-xs">{selectedBox.weight_g}g</span>}
                    {selectedBox.price_jpy > 0 && <span className="text-orange-600 text-xs">¥{Math.round(selectedBox.price_jpy)}</span>}
                  </div>
                ) : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未使用外箱</SelectItem>
                {boxTemplates.filter(b => b.is_active !== false).map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    <div className="flex items-center gap-2 py-0.5">
                      {b.image_url
                        ? <img src={b.image_url} alt="" className="w-8 h-8 rounded object-cover border border-gray-100 flex-shrink-0" />
                        : <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />}
                      <div>
                        <div className="font-medium text-sm">{b.name}</div>
                        <div className="text-xs text-gray-400 flex gap-2">
                          {b.weight_g > 0 && <span>自重 {b.weight_g}g</span>}
                          {b.price_jpy > 0 && <span className="text-orange-600">¥{Math.round(b.price_jpy)}</span>}
                          {b.description && <span>{b.description}</span>}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weight & shipping fee */}
          {(() => {
            const wNum = parseFloat(finalWeightG);
            const calcResult = (!isNaN(wNum) && wNum > 0) ? calcFeeFromWeight(wNum) : null;
            const feeCurrency = calcResult ? calcResult.currency : "JPY";
            const applyWeight = (w) => {
              setFinalWeightG(String(w));
              if (w > 0) {
                const calc = calcFeeFromWeight(w);
                if (calc) { setShippingFeeJpy(String(calc.fee)); setFeeAutoCalced(true); }
              } else { setFeeAutoCalced(false); }
            };
            return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">最终总重量 (g)</Label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input className="h-8 text-sm flex-1" type="text" inputMode="decimal" placeholder={pool.total_weight_g || "0"}
                      value={finalWeightG}
                      onChange={e => {
                        const raw = e.target.value;
                        setFinalWeightG(raw);
                        const w = parseFloat(raw);
                        if (!isNaN(w) && w > 0) {
                          const calc = calcFeeFromWeight(w);
                          if (calc) { setShippingFeeJpy(String(calc.fee)); setFeeAutoCalced(true); }
                        } else { setFeeAutoCalced(false); }
                      }} />
                    <button type="button" onClick={() => applyWeight((parseFloat(finalWeightG) || 0) + 100)}
                      className="h-8 px-2 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex-shrink-0">+100</button>
                    <button type="button" onClick={() => applyWeight(Math.max(0, (parseFloat(finalWeightG) || 0) - 100))}
                      className="h-8 px-2 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex-shrink-0">-100</button>
                  </div>
                  {boxWeight > 0 && <p className="text-xs text-gray-400 mt-0.5">含外箱 {boxWeight}g</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                    国际运费 ({feeCurrency}) *
                    {matchedShippingMethod && !calcResult && finalWeightG && (
                      <span className="text-orange-400 font-normal">（该重量无匹配区间）</span>
                    )}
                    {!matchedShippingMethod && <span className="text-gray-400 font-normal">（手动填写）</span>}
                  </Label>
                  <div className="mt-1 relative">
                    <Input className="h-8 text-sm pr-14" type="text" inputMode="decimal" placeholder="0"
                      value={shippingFeeJpy}
                      onChange={e => { setShippingFeeJpy(e.target.value); setFeeAutoCalced(false); }} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{feeCurrency}</span>
                  </div>
                  {matchedShippingMethod && calcResult && (
                    <p className="text-xs mt-0.5 text-blue-500">
                      按{matchedShippingMethod.name || pool.shipping_method}费率{feeAutoCalced ? "（已自动填入）" : `：${feeCurrency} ${calcResult.fee.toLocaleString()}`}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Packing fees per user */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-gray-500">
                捆包作业手续费 (JPY)
                {isConsolidation && uniqueUsers.length > 1 && <span className="ml-1 text-gray-400">（按用户分别设置）</span>}
              </Label>
              {totalPackingFee > 0 && <span className="text-xs text-gray-500">合计 ¥{totalPackingFee}</span>}
            </div>
            {packingFeesPerUser.length <= 1 ? (
              <div className="flex items-center gap-1.5">
                 <Input className="h-8 text-sm flex-1" type="text" inputMode="decimal" placeholder="0"
                   value={packingFeesPerUser[0]?.fee_jpy || ""}
                   onChange={e => {
                     const fee = parseFloat(e.target.value) || 0;
                     if (packingFeesPerUser.length === 0) {
                       setPackingFeesPerUser([{ user_email: "__all__", fee_jpy: fee }]);
                     } else {
                       setPackingFeesPerUser([{ ...packingFeesPerUser[0], fee_jpy: fee }]);
                     }
                   }} />
                 <button type="button" onClick={() => {
                   const cur = parseFloat(packingFeesPerUser[0]?.fee_jpy) || 0;
                   const fee = cur + 100;
                   if (packingFeesPerUser.length === 0) setPackingFeesPerUser([{ user_email: "__all__", fee_jpy: fee }]);
                   else setPackingFeesPerUser([{ ...packingFeesPerUser[0], fee_jpy: fee }]);
                 }} className="h-8 px-2 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex-shrink-0">+100</button>
                 <button type="button" onClick={() => {
                   const cur = parseFloat(packingFeesPerUser[0]?.fee_jpy) || 0;
                   const fee = Math.max(0, cur - 100);
                   if (packingFeesPerUser.length === 0) setPackingFeesPerUser([{ user_email: "__all__", fee_jpy: fee }]);
                   else setPackingFeesPerUser([{ ...packingFeesPerUser[0], fee_jpy: fee }]);
                 }} className="h-8 px-2 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex-shrink-0">-100</button>
               </div>
            ) : (
              <div className="space-y-1.5">
                {packingFeesPerUser.map((uf, idx) => (
                  <div key={uf.user_email} className="flex items-center gap-1.5">
                     <span className="text-xs text-gray-600 flex-1 truncate">{uf.user_email}</span>
                     <Input className="h-7 text-xs w-24" type="text" inputMode="decimal" placeholder="0"
                       value={uf.fee_jpy}
                       onChange={e => setPackingFeesPerUser(prev =>
                         prev.map((u, i) => i === idx ? { ...u, fee_jpy: parseFloat(e.target.value) || 0 } : u)
                       )} />
                     <button type="button" onClick={() => setPackingFeesPerUser(prev =>
                       prev.map((u, i) => i === idx ? { ...u, fee_jpy: (parseFloat(u.fee_jpy) || 0) + 100 } : u)
                     )} className="h-7 px-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex-shrink-0">+100</button>
                     <button type="button" onClick={() => setPackingFeesPerUser(prev =>
                       prev.map((u, i) => i === idx ? { ...u, fee_jpy: Math.max(0, (parseFloat(u.fee_jpy) || 0) - 100) } : u)
                     )} className="h-7 px-1.5 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 flex-shrink-0">-100</button>
                     <span className="text-xs text-gray-400">JPY</span>
                   </div>
                ))}
              </div>
            )}
          </div>

          {/* Fee breakdown preview */}
          {(shippingFeeJpy || boxPrice > 0 || totalPackingFee > 0) && feeBreakdowns.length > 0 && (
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">
                费用明细{isConsolidation ? "（含平摊运费）" : ""}
              </Label>
              <ShippingFeeBreakdown
                breakdowns={feeBreakdowns}
                isConsolidation={isConsolidation}
              />
            </div>
          )}

          {/* Tracking number */}
          <div>
            <Label className="text-xs text-gray-500">
              运单号{isStep2 ? " *" : " (可选，稍后填写)"}
            </Label>
            <Input className="mt-1 h-8 text-sm font-mono"
              placeholder={isStep2 ? "填写后确认发货" : "稍后填写"}
              value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs text-gray-500">捆包备注（展示给用户）</Label>
              <Input className="mt-1 h-8 text-sm"
                placeholder="如：已合并为1箱，尺寸 30×20×15cm"
                value={adminPackingNote} onChange={e => setAdminPackingNote(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">管理员内部备注</Label>
              <Textarea rows={2} className="mt-1 text-sm"
                value={adminNote} onChange={e => setAdminNote(e.target.value)} />
            </div>
          </div>

          {/* Image uploads */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">发货面单图片</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {labelImageUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <ImageWithViewer src={url} alt="发货面单">
                      <img src={url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                    </ImageWithViewer>
                    <button
                      onClick={() => setLabelImageUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
              <label
                className={`cursor-pointer flex flex-col items-center gap-1 px-2.5 py-3 border-2 border-dashed rounded-md text-xs transition-colors ${draggingLabel ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-300 text-gray-400 hover:border-gray-400"}`}
                onDragOver={e => { e.preventDefault(); setDraggingLabel(true); }}
                onDragLeave={() => setDraggingLabel(false)}
                onDrop={e => handleDrop(e, "label")}>
                {uploadingLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{uploadingLabel ? "上传中..." : "点击或拖拽上传"}</span>
                <input type="file" accept="image/*" className="hidden" disabled={uploadingLabel} multiple
                  onChange={e => { Array.from(e.target.files).forEach(f => handleUploadLabelImage(f)); }} />
              </label>
              <input
                type="text"
                placeholder="粘贴图片URL或剪切板图片（Ctrl+V）"
                className="mt-1.5 w-full h-7 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onPaste={e => {
                  const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                  if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) handleUploadLabelImage(f); }
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const url = e.target.value.trim();
                    if (url) { setLabelImageUrls(prev => [...prev, url]); e.target.value = ""; }
                  }
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">捆包状态图片</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {packingImageUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <ImageWithViewer src={url} alt="捆包状态图片">
                      <img src={url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                    </ImageWithViewer>
                    <button
                      onClick={() => setPackingImageUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
              <label
                className={`cursor-pointer flex flex-col items-center gap-1 px-2.5 py-3 border-2 border-dashed rounded-md text-xs transition-colors ${draggingPacking ? "border-blue-400 bg-blue-50 text-blue-500" : "border-gray-300 text-gray-400 hover:border-gray-400"}`}
                onDragOver={e => { e.preventDefault(); setDraggingPacking(true); }}
                onDragLeave={() => setDraggingPacking(false)}
                onDrop={e => handleDrop(e, "packing")}>
                {uploadingPacking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{uploadingPacking ? "上传中..." : "点击或拖拽上传"}</span>
                <input type="file" accept="image/*" className="hidden" disabled={uploadingPacking} multiple
                  onChange={e => { Array.from(e.target.files).forEach(f => handleUploadPackingImage(f)); }} />
              </label>
              <input
                type="text"
                placeholder="粘贴图片URL或剪切板图片（Ctrl+V）"
                className="mt-1.5 w-full h-7 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onPaste={e => {
                  const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                  if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) handleUploadPackingImage(f); }
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const url = e.target.value.trim();
                    if (url) { setPackingImageUrls(prev => [...prev, url]); e.target.value = ""; }
                  }
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {isStep1 && (
              <>
                {trackingNumber && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-700">
                    ⚠️ 填写运单号后，可在第二步直接确认发货（跳过付款流程）
                  </div>
                )}
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 w-full"
                  onClick={handleSetAwaitingPayment} disabled={saving || !shippingFeeJpy}>
                  <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "保存中..." : `通知用户付款（合计 ¥${Math.round(grandTotalJpy).toLocaleString()} JPY）`}
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs"
                  onClick={handleSaveInfoOnly} disabled={saving}>
                  {saving ? "保存中..." : "仅保存信息（不通知）"}
                </Button>
              </>
            )}

            {isAwaitingPayment && (
              <>
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm text-orange-700">
                  运费 <strong>¥{Math.round(grandTotalJpy).toLocaleString()} JPY</strong>，等待用户付款。
                </div>
                <Button size="sm" variant="outline" className="w-full text-xs"
                  onClick={handleSaveInfoOnly} disabled={saving}>
                  {saving ? "保存中..." : "保存信息修改"}
                </Button>
              </>
            )}

            {isAwaitingConfirmation && (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 space-y-2">
                  <p className="text-xs text-blue-700 font-medium">
                    用户已提交付款（¥{Math.round(grandTotalJpy).toLocaleString()} JPY），请核实后确认收款。
                  </p>
                  {pool.payment_proof_url && (
                    <PaymentProofImage url={pool.payment_proof_url} />
                  )}
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full"
                    onClick={handleConfirmPayment} disabled={confirmingSaving}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    {confirmingSaving ? "确认中..." : "确认收款，进入待发货"}
                  </Button>
                </div>
                <Button size="sm" variant="outline" className="w-full text-xs"
                  onClick={handleSaveInfoOnly} disabled={saving}>
                  {saving ? "保存中..." : "保存信息修改"}
                </Button>
              </>
            )}

            {isStep2 && (
              <>
                <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm text-green-700">
                  ✅ 用户已付款，请填写运单号确认发货。
                </div>
                {trackingNumber && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-700">
                    ⚠️ 确认发货后，所有关联订单将同步更新为"已发货"。
                  </div>
                )}
                <Button size="sm" className="bg-red-600 hover:bg-red-700 w-full"
                  onClick={handleShip} disabled={saving || !trackingNumber}>
                  <Truck className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? "保存中..." : "确认发货"}
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs"
                  onClick={handleSaveInfoOnly} disabled={saving}>
                  {saving ? "保存中..." : "保存信息修改"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}