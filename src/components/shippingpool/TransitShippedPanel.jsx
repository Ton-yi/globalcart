/**
 * TransitShippedPanel - 用户发货申请详情中显示中转地发货信息及确认收货
 */
import { Truck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import { base44 } from "@/api/base44Client";
import { useState } from "react";

export default function TransitShippedPanel({ orders, currentUser, onUpdated }) {
  const [confirming, setConfirming] = useState(false);

  const myTransitShippedOrders = orders.filter(o =>
    o.user_email === currentUser?.email && o.order_status === 'transit_shipped'
  );
  if (myTransitShippedOrders.length === 0) return null;

  const sample = myTransitShippedOrders[0];
  const trackingNumber = sample.transit_tracking_number;
  const shippingMethod = sample.transit_shipping_method;
  const shippedDate = sample.transit_shipped_date;
  const note = sample.transit_note;
  const imageUrls = sample.transit_image_urls || [];

  const handleConfirm = async () => {
    setConfirming(true);
    // Only confirm orders that are actually in transit_shipped state (not other statuses)
    const idsToConfirm = myTransitShippedOrders.map(o => o.id);
    await Promise.all(idsToConfirm.map(id =>
      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: 'delivered' })
    ));
    setConfirming(false);
    onUpdated?.();
  };

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden">
      <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200 flex items-center gap-2">
        <Truck className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700">
          中转地已发货 · 等待签收（{myTransitShippedOrders.length} 件）
        </span>
      </div>
      <div className="p-4 space-y-3">
        {shippedDate && <p className="text-xs text-gray-500">中转发货日期：{shippedDate}</p>}
        {shippingMethod && (
          <p className="text-xs text-gray-600">运输方式：<span className="font-medium">{shippingMethod}</span></p>
        )}
        {trackingNumber ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 space-y-1.5">
            <p className="text-xs text-gray-400">中转运单号</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base font-bold text-gray-800 select-all">{trackingNumber}</span>
              <button
                onClick={() => navigator.clipboard.writeText(trackingNumber)}
                className="text-xs text-blue-500 hover:text-blue-700 underline">
                复制
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">运单号待中转地填写</p>
        )}
        {note && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-xs text-yellow-800">
            <p className="font-medium text-yellow-600 mb-0.5">中转地备注</p>
            <p className="whitespace-pre-wrap">{note}</p>
          </div>
        )}
        {imageUrls.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">中转地发货图片</p>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <ImageWithViewer key={i} src={url} alt="发货图片">
                  <img src={url} alt="" className="w-16 h-16 rounded object-cover border border-gray-200 hover:opacity-80 cursor-pointer" />
                </ImageWithViewer>
              ))}
            </div>
          </div>
        )}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          disabled={confirming}
          onClick={handleConfirm}>
          <CheckCircle className="w-4 h-4 mr-2" />
          {confirming ? "确认中..." : "确认收货"}
        </Button>
      </div>
    </div>
  );
}