/**
 * ShipmentPackingModal
 *
 * Admin packing and shipment completion workflow for ShipmentRequest.
 * Shows: items, customs declaration, quotation breakdown, box template.
 * Allows: start packing, upload packing photos, fill shipment details,
 *         upload shipping labels, mark as shipped.
 */
import { useState, useEffect } from "react";
import { X, Package, Truck, Camera, Upload, CheckCircle, Box, FileText, Scale, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const SR_STATUS = {
  draft:           { label: "草稿",     color: "bg-gray-100 text-gray-600" },
  submitted:       { label: "已提交",   color: "bg-blue-100 text-blue-700" },
  quote_ready:     { label: "待确认",   color: "bg-yellow-100 text-yellow-700" },
  waiting_payment: { label: "待付款",   color: "bg-orange-100 text-orange-700" },
  paid:            { label: "已付款",   color: "bg-green-100 text-green-700" },
  packing:         { label: "打包中",   color: "bg-purple-100 text-purple-700" },
  shipped:         { label: "已发货",   color: "bg-teal-100 text-teal-700" },
  delivered:       { label: "已签收",   color: "bg-emerald-100 text-emerald-700" },
  cancelled:       { label: "已取消",   color: "bg-red-100 text-red-600" },
};

export default function ShipmentPackingModal({ shipmentRequest: initialSr, boxTemplates = [], onClose, onUpdated }) {
  const [sr, setSr] = useState(initialSr);
  const [quoteData, setQuoteData] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [customsData, setCustomsData] = useState(null);

  // Packing photo state
  const [packingPhotos, setPackingPhotos] = useState(initialSr.packing_photos || []);
  const [uploadingPackingPhoto, setUploadingPackingPhoto] = useState(false);

  // Shipment details
  const [trackingNumber, setTrackingNumber] = useState(initialSr.tracking_number || "");
  const [actualShippedDate, setActualShippedDate] = useState(
    initialSr.actual_shipped_date || new Date().toISOString().split("T")[0]
  );
  const [finalWeightG, setFinalWeightG] = useState(
    initialSr.final_total_weight_g != null ? String(initialSr.final_total_weight_g) : ""
  );
  const [shippingLabelImages, setShippingLabelImages] = useState(initialSr.shipping_label_images || []);
  const [uploadingLabel, setUploadingLabel] = useState(false);

  const [startingPacking, setStartingPacking] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [error, setError] = useState("");

  const isShipped = sr.shipping_request_status === "shipped";
  const isPaid = sr.shipping_request_status === "paid";
  const isPacking = sr.shipping_request_status === "packing";

  const boxTemplate = boxTemplates.find(b => b.id === sr.selected_box_template_id) || null;

  useEffect(() => {
    Promise.all([
      base44.functions.invoke("getShipmentQuoteData", { shipment_request_id: sr.id })
        .then(r => setQuoteData(r.data || null))
        .catch(() => setQuoteData(null)),
      base44.functions.invoke("getCustomsDeclaration", { shipment_request_id: sr.id })
        .then(r => setCustomsData(r.data?.declaration || null))
        .catch(() => setCustomsData(null)),
    ]).finally(() => setLoadingQuote(false));
  }, [sr.id]);

  const handleStartPacking = async () => {
    setStartingPacking(true);
    setError("");
    const r = await base44.functions.invoke("startPacking", { shipment_request_id: sr.id });
    if (r.data?.error) { setError(r.data.error); setStartingPacking(false); return; }
    setSr(prev => ({ ...prev, shipping_request_status: "packing", packing_started_at: new Date().toISOString() }));
    setStartingPacking(false);
    onUpdated?.();
  };

  const uploadImage = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleUploadPackingPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPackingPhoto(true);
    const url = await uploadImage(file);
    const updated = [...packingPhotos, url];
    setPackingPhotos(updated);
    setSavingPhotos(true);
    await base44.functions.invoke("savePackingPhotos", {
      shipment_request_id: sr.id,
      packing_photos: updated,
    }).catch(() => {});
    setSavingPhotos(false);
    setUploadingPackingPhoto(false);
    e.target.value = "";
  };

  const handleUploadLabel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLabel(true);
    const url = await uploadImage(file);
    setShippingLabelImages(prev => [...prev, url]);
    setUploadingLabel(false);
    e.target.value = "";
  };

  const handleRemovePackingPhoto = (idx) => {
    setPackingPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveLabelImage = (idx) => {
    setShippingLabelImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleComplete = async () => {
    setError("");
    if (!trackingNumber.trim()) { setError("请填写运单号"); return; }
    const weight = finalWeightG !== "" ? parseFloat(finalWeightG) : null;
    if (weight != null && weight < 0) { setError("重量不能为负数"); return; }

    setCompleting(true);
    const r = await base44.functions.invoke("completeShipment", {
      shipment_request_id: sr.id,
      tracking_number: trackingNumber.trim(),
      actual_shipped_date: actualShippedDate,
      final_total_weight_g: weight != null ? weight : undefined,
      packing_photos: packingPhotos,
      shipping_label_images: shippingLabelImages,
    });
    if (r.data?.error) { setError(r.data.error); setCompleting(false); return; }
    setSr(prev => ({
      ...prev,
      shipping_request_status: "shipped",
      tracking_number: trackingNumber.trim(),
      actual_shipped_date: actualShippedDate,
      final_total_weight_g: weight,
      packing_photos: packingPhotos,
      shipping_label_images: shippingLabelImages,
      shipped_at: new Date().toISOString(),
    }));
    setCompleting(false);
    onUpdated?.();
  };

  const statusCfg = SR_STATUS[sr.shipping_request_status] || SR_STATUS.draft;
  const quote = quoteData?.quote || null;
  const items = quoteData?.items || [];
  const charges = quoteData?.charges || [];
  const customs = quoteData?.customs || null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
              {sr.tracking_number && (
                <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{sr.tracking_number}</span>
              )}
            </div>
            <h2 className="font-semibold text-gray-900 mt-1">
              发货申请 #{sr.id.slice(-6).toUpperCase()}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              创建于 {new Date(sr.created_date).toLocaleDateString("zh-CN")}
              {sr.creator_user_id && <span className="ml-2">{sr.creator_user_id}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* ── Start Packing Action ── */}
          {isPaid && (
            <div className="border border-green-200 rounded-xl p-4 bg-green-50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-green-800">已收到付款，可开始打包</p>
                  <p className="text-xs text-green-600 mt-0.5">点击"开始打包"将状态更新为打包中，并记录操作时间</p>
                </div>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                  onClick={handleStartPacking} disabled={startingPacking}>
                  <Package className="w-3.5 h-3.5 mr-1.5" />
                  {startingPacking ? "处理中..." : "开始打包"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Audit Timestamps ── */}
          {(sr.packing_started_at || sr.shipped_at) && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              {sr.packing_started_at && (
                <div className="bg-purple-50 rounded-lg px-3 py-2">
                  <p className="text-purple-500 font-medium">打包开始</p>
                  <p className="text-purple-800 mt-0.5">{new Date(sr.packing_started_at).toLocaleString("zh-CN")}</p>
                </div>
              )}
              {sr.shipped_at && (
                <div className="bg-teal-50 rounded-lg px-3 py-2">
                  <p className="text-teal-500 font-medium">发出时间</p>
                  <p className="text-teal-800 mt-0.5">{new Date(sr.shipped_at).toLocaleString("zh-CN")}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Box Template ── */}
          {boxTemplate && (
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Box className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">选用外箱</h3>
              </div>
              <div className="flex items-center gap-4">
                {boxTemplate.image_url && (
                  <img src={boxTemplate.image_url} alt={boxTemplate.box_name}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{boxTemplate.box_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    箱重 {boxTemplate.weight_g}g · 箱费 ¥{boxTemplate.price_jpy}
                  </p>
                  {boxTemplate.description && <p className="text-xs text-gray-400 mt-0.5">{boxTemplate.description}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Shipment Items ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">包裹物品 ({items.length} 件)</h3>
            </div>
            {loadingQuote ? (
              <p className="text-xs text-gray-400">加载中...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-gray-400">暂无物品记录</p>
            ) : (
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-800 truncate block">{item.order_id}</span>
                      <span className="text-xs text-gray-400">{item.user_id} · {item.item_weight_g || 0}g</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Customs Declaration ── */}
          {customsData && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <FileText className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">报关申报</h3>
                {customsData.dangerous_goods_confirmed && (
                  <Badge className="text-xs ml-auto bg-green-100 text-green-700">已确认无危险品</Badge>
                )}
              </div>
              <div className="p-4 space-y-2">
                {(customsData.items || []).length === 0 ? (
                  <p className="text-xs text-gray-400">暂无申报物品</p>
                ) : (
                  <div className="space-y-1">
                    {(customsData.items || []).map((item, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 text-xs px-3 py-1.5 bg-gray-50 rounded">
                        <span className="text-gray-800 font-medium truncate">{item.item_name_en}</span>
                        <span className="text-gray-500">x{item.quantity} · {item.weight_g || 0}g</span>
                        <span className="text-gray-600 text-right">{item.currency} {item.total_value || (item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {customsData.undeliverable_instruction && (
                  <p className="text-xs text-gray-400 mt-1">
                    无法投递处理：{customsData.undeliverable_instruction === "return_to_sender" ? "退回寄件方" : customsData.undeliverable_instruction === "abandon" ? "放弃" : "转寄其他地址"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Quotation Breakdown ── */}
          {quote && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <Scale className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">报价摘要</h3>
                <Badge className="text-xs ml-auto bg-gray-100 text-gray-600">v{quote.quote_version}</Badge>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <p className="text-gray-400">计费总重</p>
                    <p className="font-medium text-gray-800 mt-0.5">{quote.final_total_weight_g || 0}g</p>
                  </div>
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <p className="text-gray-400">国际运费</p>
                    <p className="font-medium text-gray-800 mt-0.5">¥{quote.shipping_fee_jpy || 0}</p>
                  </div>
                  {quote.box_name_snapshot && (
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <p className="text-gray-400">外箱（快照）</p>
                      <p className="font-medium text-gray-800 mt-0.5">{quote.box_name_snapshot} · ¥{quote.box_fee_jpy_snapshot || 0}</p>
                    </div>
                  )}
                  {quote.packing_fee_default_jpy > 0 && (
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <p className="text-gray-400">打包费（参考）</p>
                      <p className="font-medium text-gray-800 mt-0.5">¥{quote.packing_fee_default_jpy}</p>
                    </div>
                  )}
                </div>
                {charges.length > 0 && (
                  <div className="border-t pt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-500">用户费用明细</p>
                    {charges.map((c, idx) => (
                      <div key={c.id || idx} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-1.5">
                        <span className="text-gray-600 truncate">{c.user_id}</span>
                        <span className="font-medium text-gray-800 flex-shrink-0 ml-2">¥{c.final_fee_total_jpy}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Packing Photos ── */}
          {(isPacking || isShipped) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700">打包实拍 ({packingPhotos.length} 张)</h3>
                </div>
                {!isShipped && (
                  <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors ${uploadingPackingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingPackingPhoto ? "上传中..." : "上传照片"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadPackingPhoto} disabled={uploadingPackingPhoto} />
                  </label>
                )}
              </div>
              {packingPhotos.length === 0 ? (
                <p className="text-xs text-gray-400">暂无打包照片</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {packingPhotos.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`打包照片 ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer"
                        onClick={() => window.open(url, "_blank")} />
                      {!isShipped && (
                        <button
                          onClick={() => handleRemovePackingPhoto(idx)}
                          className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Shipment Details Form ── */}
          {!isShipped && (isPacking || isPaid) && (
            <div className="border border-blue-100 rounded-xl overflow-hidden">
              <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">填写发货信息</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-gray-500">运单号 <span className="text-red-500">*</span></Label>
                    <Input className="mt-1 h-8 text-sm font-mono"
                      placeholder="填写快递运单号"
                      value={trackingNumber}
                      onChange={e => setTrackingNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">实际发货日期</Label>
                    <Input type="date" className="mt-1 h-8 text-sm"
                      value={actualShippedDate}
                      onChange={e => setActualShippedDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">最终总重量 (g)</Label>
                    <Input type="number" min="0" className="mt-1 h-8 text-sm"
                      placeholder="含箱重，单位 g"
                      value={finalWeightG}
                      onChange={e => setFinalWeightG(e.target.value)} />
                  </div>
                </div>

                {/* Shipping Label Images */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-gray-500">运输标签图片 ({shippingLabelImages.length} 张)</Label>
                    <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 transition-colors ${uploadingLabel ? "opacity-50 pointer-events-none" : ""}`}>
                      <Upload className="w-3 h-3" />
                      {uploadingLabel ? "上传中..." : "上传"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadLabel} disabled={uploadingLabel} />
                    </label>
                  </div>
                  {shippingLabelImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {shippingLabelImages.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img src={url} alt={`标签 ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200 cursor-pointer"
                            onClick={() => window.open(url, "_blank")} />
                          <button
                            onClick={() => handleRemoveLabelImage(idx)}
                            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-700">
                  ⚠️ 填写运单号并点击"确认发货"后，状态将变为"已发货"，此操作不可撤销。
                </div>

                <Button className="w-full bg-red-600 hover:bg-red-700"
                  onClick={handleComplete} disabled={completing || !trackingNumber.trim()}>
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {completing ? "处理中..." : "确认发货"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Shipped — read-only summary ── */}
          {isShipped && (
            <div className="border border-teal-200 rounded-xl overflow-hidden">
              <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-700">已发货</span>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <p className="text-gray-400">运单号</p>
                    <p className="font-mono font-medium text-gray-800 mt-0.5">{sr.tracking_number}</p>
                  </div>
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <p className="text-gray-400">发货日期</p>
                    <p className="font-medium text-gray-800 mt-0.5">{sr.actual_shipped_date}</p>
                  </div>
                  {sr.final_total_weight_g > 0 && (
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <p className="text-gray-400">最终重量</p>
                      <p className="font-medium text-gray-800 mt-0.5">{sr.final_total_weight_g}g</p>
                    </div>
                  )}
                </div>
                {shippingLabelImages.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-gray-500 mb-1.5">运输标签</p>
                    <div className="flex flex-wrap gap-2">
                      {shippingLabelImages.map((url, idx) => (
                        <img key={idx} src={url} alt={`标签 ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 cursor-pointer"
                          onClick={() => window.open(url, "_blank")} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}