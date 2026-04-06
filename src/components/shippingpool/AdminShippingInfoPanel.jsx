/**
 * AdminShippingInfoPanel
 * Two-step admin panel for filling shipping info on a ShippingPool.
 *
 * Step 1 (pending/processing → awaiting_payment):
 *   Fill shipping info to send to user for payment confirmation.
 *   Tracking number is optional at this step.
 *
 * Step 2 (ready_to_ship → shipped):
 *   Fill actual dispatch info — tracking number required.
 *
 * Both steps allow editing all fields. The distinction is:
 * - Step 1: tracking number optional, action = notify user to pay
 * - Step 2: tracking number required, action = confirm shipment
 */
import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi, updateOrder } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Truck, CheckCircle, ExternalLink, Upload, X, Plus, Loader2, Package } from "lucide-react";

const STATUS_CONFIG = {
  pending:          { label: "待处理",  color: "bg-amber-100 text-amber-700" },
  awaiting_payment: { label: "待付款",  color: "bg-orange-100 text-orange-700" },
  ready_to_ship:    { label: "待发货",  color: "bg-blue-100 text-blue-700" },
  shipped:          { label: "已发货",  color: "bg-green-100 text-green-700" },
  delivered:        { label: "已签收",  color: "bg-emerald-100 text-emerald-700" },
  cancelled:        { label: "已取消",  color: "bg-red-100 text-red-600" },
  processing:       { label: "处理中",  color: "bg-blue-100 text-blue-700" },
};

export default function AdminShippingInfoPanel({
  pool: initialPool,
  orders = [],
  boxTemplates = [],
  defaultPackingFeeSingle = 0,
  defaultPackingFeeConsolidation = 0,
  onPoolUpdated,
}) {
  const isConsolidation = (initialPool.consolidation_type === "transit" || initialPool.consolidation_type === "other");

  // Derive unique users from orders
  const uniqueUsers = [...new Map(
    orders.filter(o => o.user_email).map(o => [o.user_email, { email: o.user_email, name: o.user_name || o.user_email }])
  ).values()];

  // Initial packing fees per user
  const initPackingFeesPerUser = () => {
    if ((initialPool.packing_fees_per_user || []).length > 0) return initialPool.packing_fees_per_user;
    const defaultFee = isConsolidation ? defaultPackingFeeConsolidation : defaultPackingFeeSingle;
    return uniqueUsers.map(u => ({ user_email: u.email, fee_jpy: defaultFee }));
  };

  const [pool, setPool] = useState(initialPool);
  const [saving, setSaving] = useState(false);

  // Form fields (shared between step 1 and step 2)
  const [trackingNumber, setTrackingNumber] = useState(pool.tracking_number || "");
  const [boxTemplateId, setBoxTemplateId] = useState(pool.box_template_id || "none");
  const [finalWeightG, setFinalWeightG] = useState(pool.final_weight_g?.toString() || pool.total_weight_g?.toString() || "");
  const [shippingFeeJpy, setShippingFeeJpy] = useState(pool.shipping_fee_jpy?.toString() || "");
  const [packingFeesPerUser, setPackingFeesPerUser] = useState(initPackingFeesPerUser);
  const [adminNote, setAdminNote] = useState(pool.admin_note || "");
  const [adminPackingNote, setAdminPackingNote] = useState(pool.admin_packing_note || "");

  // Image upload state
  const [labelImageUrls, setLabelImageUrls] = useState(pool.label_image_urls || []);
  const [packingImageUrls, setPackingImageUrls] = useState(pool.packing_image_urls || []);
  const [uploadingLabel, setUploadingLabel] = useState(false);
  const [uploadingPacking, setUploadingPacking] = useState(false);

  // Payment confirmation (step 2: awaiting_payment → ready_to_ship)
  const [confirmingSaving, setConfirmingSaving] = useState(false);

  const selectedBox = boxTemplates.find(b => b.id === boxTemplateId);
  const boxWeight = selectedBox?.weight_g || 0;
  const boxPrice = selectedBox?.price_jpy || 0;
  const totalPackingFee = packingFeesPerUser.reduce((s, u) => s + (parseFloat(u.fee_jpy) || 0), 0);

  const buildUpdatePayload = () => {
    const btId = boxTemplateId === "none" ? "" : boxTemplateId;
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
      admin_note: adminNote,
      admin_packing_note: adminPackingNote,
      label_image_urls: labelImageUrls,
      packing_image_urls: packingImageUrls,
    };
  };

  // Step 1 action: save info + set awaiting_payment
  const handleSetAwaitingPayment = async () => {
    if (!shippingFeeJpy) return;
    setSaving(true);
    const payload = { ...buildUpdatePayload(), status: "awaiting_payment", payment_status: "unpaid" };
    await shippingPoolApi.update(pool.id, payload);
    setPool(p => ({ ...p, ...payload }));
    setSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  // Step 1 also allows just saving without changing status
  const handleSaveInfoOnly = async () => {
    setSaving(true);
    const payload = buildUpdatePayload();
    await shippingPoolApi.update(pool.id, payload);
    setPool(p => ({ ...p, ...payload }));
    setSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  // Admin confirms payment → ready_to_ship
  const handleConfirmPayment = async () => {
    setConfirmingSaving(true);
    const payload = {
      ...buildUpdatePayload(),
      status: "ready_to_ship",
      payment_status: "paid",
      admin_confirmed_payment: true,
    };
    await shippingPoolApi.update(pool.id, payload);
    setPool(p => ({ ...p, ...payload }));
    setConfirmingSaving(false);
    onPoolUpdated?.({ ...pool, ...payload });
  };

  // Step 2 action: fill tracking → shipped
  const handleShip = async () => {
    if (!trackingNumber) return;
    setSaving(true);
    const payload = {
      ...buildUpdatePayload(),
      status: "shipped",
      shipped_date: new Date().toISOString().split("T")[0],
    };
    await shippingPoolApi.update(pool.id, payload);
    // Update all associated orders
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

  const currentStatus = pool.status;
  const isStep1 = currentStatus === "pending" || currentStatus === "processing";
  const isAwaitingPayment = currentStatus === "awaiting_payment";
  const isStep2 = currentStatus === "ready_to_ship";
  const isDone = currentStatus === "shipped" || currentStatus === "delivered";

  return (
    <div className="border border-red-100 rounded-xl overflow-hidden">
      {/* Header */}
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

      {/* Step 1 or Step 2 form fields — same form, shown in both steps */}
      {(isStep1 || isStep2 || isAwaitingPayment) && (
        <div className="p-4 space-y-4">
          {isStep1 && (
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <strong>第一步：</strong>填写发货信息，通知用户确认并付款。运单号可在付款确认后填写。
            </p>
          )}
          {isAwaitingPayment && (
            <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              等待用户付款中。可继续修改发货信息，或确认收款进入待发货状态。
            </p>
          )}
          {isStep2 && (
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <strong>第二步：</strong>用户已付款，请填写运单号确认发货。
            </p>
          )}

          {/* Box template */}
          <div>
            <Label className="text-xs text-gray-500">外箱选择</Label>
            <Select value={boxTemplateId} onValueChange={setBoxTemplateId}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue placeholder="未使用外箱" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未使用外箱</SelectItem>
                {boxTemplates.filter(b => b.is_active !== false).map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.weight_g > 0 && ` (${b.weight_g}g)`}
                    {b.price_jpy > 0 && ` ¥${b.price_jpy}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBox && (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                {selectedBox.image_url && <img src={selectedBox.image_url} alt="" className="w-6 h-6 rounded object-cover border border-gray-100" />}
                <span>{selectedBox.description}</span>
                {boxWeight > 0 && <span className="text-gray-400">自重 {boxWeight}g</span>}
                {boxPrice > 0 && <span className="text-orange-600">¥{boxPrice} JPY</span>}
              </div>
            )}
          </div>

          {/* Weight & fee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">最终总重量 (g)</Label>
              <Input className="mt-1 h-8 text-sm" type="number" placeholder={pool.total_weight_g || "0"}
                value={finalWeightG} onChange={e => setFinalWeightG(e.target.value)} />
              {boxWeight > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">含外箱 {boxWeight}g</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-gray-500">运费 (JPY) *</Label>
              <Input className="mt-1 h-8 text-sm" type="number" placeholder="0"
                value={shippingFeeJpy} onChange={e => setShippingFeeJpy(e.target.value)} />
            </div>
          </div>

          {/* Packing fees per user */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-gray-500">
                捆包作业手续费 (JPY)
                {isConsolidation && uniqueUsers.length > 1 && (
                  <span className="ml-1 text-gray-400">（可按用户分别设置）</span>
                )}
              </Label>
              {totalPackingFee > 0 && (
                <span className="text-xs text-gray-500">合计 ¥{totalPackingFee}</span>
              )}
            </div>
            {packingFeesPerUser.length === 0 && (
              <div className="flex items-center gap-2">
                <Input className="h-8 text-sm flex-1" type="number" placeholder="0"
                  value={""}
                  onChange={e => {
                    const fee = parseFloat(e.target.value) || 0;
                    // No users yet (shouldn't happen), just set global
                    setPackingFeesPerUser([{ user_email: "__all__", fee_jpy: fee }]);
                  }} />
              </div>
            )}
            {packingFeesPerUser.length === 1 && packingFeesPerUser[0].user_email === "__all__" ? (
              <Input className="h-8 text-sm" type="number" placeholder="0"
                value={packingFeesPerUser[0].fee_jpy}
                onChange={e => setPackingFeesPerUser([{ user_email: "__all__", fee_jpy: parseFloat(e.target.value) || 0 }])} />
            ) : packingFeesPerUser.length === 1 && !isConsolidation ? (
              <Input className="h-8 text-sm" type="number" placeholder="0"
                value={packingFeesPerUser[0].fee_jpy}
                onChange={e => setPackingFeesPerUser([{ ...packingFeesPerUser[0], fee_jpy: parseFloat(e.target.value) || 0 }])} />
            ) : (
              <div className="space-y-1.5">
                {packingFeesPerUser.map((uf, idx) => (
                  <div key={uf.user_email} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 flex-1 truncate">{uf.user_email}</span>
                    <Input className="h-7 text-xs w-28" type="number" placeholder="0"
                      value={uf.fee_jpy}
                      onChange={e => setPackingFeesPerUser(prev =>
                        prev.map((u, i) => i === idx ? { ...u, fee_jpy: parseFloat(e.target.value) || 0 } : u)
                      )} />
                    <span className="text-xs text-gray-400">JPY</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            {/* Label images */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">发货面单图片</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {labelImageUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
                    <button
                      onClick={() => setLabelImageUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-gray-300 rounded-md text-xs text-gray-400 hover:border-gray-400 transition-colors w-fit">
                {uploadingLabel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {uploadingLabel ? "上传中..." : "添加"}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingLabel}
                  onChange={e => { const f = e.target.files[0]; if (f) handleUploadLabelImage(f); }} />
              </label>
            </div>

            {/* Packing images */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">捆包状态图片</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {packingImageUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
                    <button
                      onClick={() => setPackingImageUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-gray-300 rounded-md text-xs text-gray-400 hover:border-gray-400 transition-colors w-fit">
                {uploadingPacking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {uploadingPacking ? "上传中..." : "添加"}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingPacking}
                  onChange={e => { const f = e.target.files[0]; if (f) handleUploadPackingImage(f); }} />
              </label>
            </div>
          </div>

          {/* Summary */}
          {(shippingFeeJpy || totalPackingFee > 0 || boxPrice > 0) && (
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs space-y-1">
              <p className="font-medium text-gray-600 mb-1">费用汇总</p>
              {shippingFeeJpy && <div className="flex justify-between"><span className="text-gray-500">运费</span><span className="font-medium">¥{Math.round(parseFloat(shippingFeeJpy) || 0).toLocaleString()} JPY</span></div>}
              {boxPrice > 0 && <div className="flex justify-between"><span className="text-gray-500">外箱费用</span><span>¥{boxPrice} JPY</span></div>}
              {totalPackingFee > 0 && <div className="flex justify-between"><span className="text-gray-500">捆包手续费</span><span>¥{totalPackingFee} JPY</span></div>}
            </div>
          )}

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
                  {saving ? "保存中..." : `通知用户付款（¥${Math.round(parseFloat(shippingFeeJpy) || 0).toLocaleString()} JPY）`}
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
                  运费 <strong>¥{Math.round(pool.shipping_fee_jpy || 0).toLocaleString()} JPY</strong>，等待用户付款。
                </div>
                {pool.payment_status === "awaiting_confirmation" && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 space-y-2">
                    <p className="text-xs text-blue-700 font-medium">用户已提交付款，请核实后确认。</p>
                    {pool.payment_proof_url && (
                      <a href={pool.payment_proof_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />查看付款凭证
                      </a>
                    )}
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full"
                      onClick={handleConfirmPayment} disabled={confirmingSaving}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      {confirmingSaving ? "确认中..." : "确认收款，进入待发货"}
                    </Button>
                  </div>
                )}
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