/**
 * 票务订单发货申请表单组件
 * 支持日本发货（本地运输方式）和自提两种模式
 */
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Store, Calendar, MapPin, CreditCard, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { AddressForm } from "@/components/common/AddressForm";

export default function TicketShippingRequestForm({ order, onSubmit, onCancel, submitting }) {
  const [shippingMethod, setShippingMethod] = useState("domestic"); // "domestic" | "pickup"
  const [selectedShippingMethod, setSelectedShippingMethod] = useState("");
  const [selectedPickupLocation, setSelectedPickupLocation] = useState("");
  const [expectedDeliveryDatetime, setExpectedDeliveryDatetime] = useState("");
  const [pickupDatetime, setPickupDatetime] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("alipay");

  const ticketData = order.ticket_data || {};

  // 计算需要补正的金额
  const calculatePaymentAmount = () => {
    // 订单现存有待补款金额（如 supplement_requested 为 true 则有 supplement_amount）
    const pendingSupplement = order.supplement_requested ? (order.supplement_amount || 0) : 0;
    
    // 运输方式费用或自提点服务费
    let shippingFee = 0;
    if (shippingMethod === "domestic" && selectedShippingMethod) {
      // TODO: 从运输方式获取费用
      shippingFee = 0; // 暂时设为 0，后续从运输方式配置读取
    } else if (shippingMethod === "pickup" && selectedPickupLocation) {
      // 从自提点获取服务费
      const pickupLocation = pickupLocations?.find(p => p.id === selectedPickupLocation);
      shippingFee = pickupLocation?.fee_jpy || 0;
    }
    
    return pendingSupplement + shippingFee;
  };

  const paymentAmount = calculatePaymentAmount();

  // 获取运输方式列表
  const { data: shippingMethods = [] } = useQuery({
    queryKey: ['shipping_methods'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTenantSettings', { key: 'shipping_methods' });
      return res.data?.settings || [];
    }
  });

  // 获取自提点列表
  const { data: pickupLocations = [] } = useQuery({
    queryKey: ['pickup_locations'],
    queryFn: async () => {
      const res = await base44.entities.PickupLocation.filter({ is_active: true });
      return res || [];
    }
  });

  // 获取收货地址列表（用户地址）
  const { data: addresses = [] } = useQuery({
    queryKey: ['user_addresses'],
    queryFn: async () => {
      const res = await base44.entities.UserPreference.filter({ 
        user_email: order.user_email,
        type: 'address'
      });
      return res || [];
    }
  });

  const [selectedAddress, setSelectedAddress] = useState(null);

  const handleSubmit = async () => {
    if (shippingMethod === "domestic") {
      if (!selectedShippingMethod) {
        return { error: "请选择运输方式" };
      }
      if (!selectedAddress) {
        return { error: "请选择收货地址" };
      }
      if (!expectedDeliveryDatetime) {
        return { error: "请选择期望到着日時" };
      }
    } else if (shippingMethod === "pickup") {
      if (!selectedPickupLocation) {
        return { error: "请选择自提地点" };
      }
      if (!pickupDatetime) {
        return { error: "请选择自提日時" };
      }
    }

    const requestData = {
      shipping_method_type: shippingMethod,
      shipping_method_code: shippingMethod === "domestic" ? selectedShippingMethod : null,
      pickup_location_id: shippingMethod === "pickup" ? selectedPickupLocation : null,
      expected_delivery_datetime: shippingMethod === "domestic" ? expectedDeliveryDatetime : null,
      pickup_datetime: shippingMethod === "pickup" ? pickupDatetime : null,
      address: shippingMethod === "domestic" ? selectedAddress : null,
      note: note.trim(),
      payment_amount_jpy: paymentAmount,
      payment_method: paymentMethod
    };

    return onSubmit(requestData);
  };

  const domesticShippingMethods = shippingMethods.filter(m => 
    m.enabled_for_direct_ship !== false && m.is_active
  );

  return (
    <div className="space-y-4">
      {/* 发货方式切换 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${shippingMethod === "domestic" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">日本发货</div>
            <div className="text-xs text-gray-500">本地运输方式配送</div>
          </div>
        </div>
        <Switch
          checked={shippingMethod === "pickup"}
          onCheckedChange={(v) => setShippingMethod(v ? "pickup" : "domestic")}
          disabled={submitting}
        />
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${shippingMethod === "pickup" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">自提</div>
            <div className="text-xs text-gray-500">自提点取货</div>
          </div>
        </div>
      </div>

      {/* 日本发货选项 */}
      {shippingMethod === "domestic" && (
        <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-2">
            <Truck className="w-4 h-4" />日本发货信息
          </div>

          {/* 运输方式选择 */}
          <div>
            <Label className="text-sm">运输方式</Label>
            <Select value={selectedShippingMethod} onValueChange={setSelectedShippingMethod} disabled={submitting}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="请选择运输方式" />
              </SelectTrigger>
              <SelectContent>
                {domesticShippingMethods.map(m => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.name} ({m.transit_days})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 收货地址选择 */}
          <div>
            <Label className="text-sm">收货地址（日本）</Label>
            <Select value={selectedAddress?.id || ""} onValueChange={(v) => {
              const addr = addresses.find(a => a.id === v);
              setSelectedAddress(addr);
            }} disabled={submitting}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="请选择收货地址" />
              </SelectTrigger>
              <SelectContent>
                {addresses.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.recipient_name} - {a.addr1?.slice(0, 20)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAddress && (
              <div className="mt-2 p-3 bg-white rounded border text-xs text-gray-700 space-y-1">
                <div>〒{selectedAddress.postal_code}</div>
                <div>{selectedAddress.addr1}</div>
                <div>{selectedAddress.addr2}</div>
                <div>{selectedAddress.recipient_phone}</div>
              </div>
            )}
          </div>

          {/* 期望到着日時 */}
          <div>
            <Label className="text-sm">期望到着日時</Label>
            <Input 
              type="datetime-local" 
              value={expectedDeliveryDatetime}
              onChange={(e) => setExpectedDeliveryDatetime(e.target.value)}
              disabled={submitting}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* 自提选项 */}
      {shippingMethod === "pickup" && (
        <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-900 mb-2">
            <Store className="w-4 h-4" />自提信息
          </div>

          {/* 自提地点选择 */}
          <div>
            <Label className="text-sm">自提地点</Label>
            <Select value={selectedPickupLocation} onValueChange={setSelectedPickupLocation} disabled={submitting}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="请选择自提地点" />
              </SelectTrigger>
              <SelectContent>
                {pickupLocations.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.fee_jpy > 0 ? `(¥${p.fee_jpy.toLocaleString()})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPickupLocation && (
              <div className="mt-2 p-3 bg-white rounded border text-xs text-gray-700">
                {pickupLocations.find(p => p.id === selectedPickupLocation)?.description && (
                  <div className="mb-2">{pickupLocations.find(p => p.id === selectedPickupLocation)?.description}</div>
                )}
              </div>
            )}
          </div>

          {/* 自提日時 */}
          <div>
            <Label className="text-sm">自提日時</Label>
            <Input 
              type="datetime-local" 
              value={pickupDatetime}
              onChange={(e) => setPickupDatetime(e.target.value)}
              disabled={submitting}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* 备注 */}
      <div>
        <Label className="text-sm">备注</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="请填写其它需要说明的信息..."
          disabled={submitting}
          className="mt-1"
        />
      </div>

      {/* 付款金额补正 */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
          <CreditCard className="w-4 h-4" />付款信息
        </div>
        <div className="space-y-2 text-sm">
          {order.supplement_requested && (order.supplement_amount || 0) > 0 && (
            <div className="flex justify-between text-gray-700">
              <span>待补款金额</span>
              <span className="font-medium">¥{(order.supplement_amount || 0).toLocaleString()}</span>
            </div>
          )}
          {shippingMethod === "pickup" && selectedPickupLocation && (
            <div className="flex justify-between text-gray-700">
              <span>自提点服务费</span>
              <span className="font-medium">
                ¥{(pickupLocations.find(p => p.id === selectedPickupLocation)?.fee_jpy || 0).toLocaleString()}
              </span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
            <span className="font-semibold">应付总额</span>
            <span className="text-lg font-bold text-blue-700">¥{paymentAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* 支付方式选择 */}
        <div className="mt-3">
          <Label className="text-sm">支付方式</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={submitting || paymentAmount === 0}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alipay">支付宝</SelectItem>
              <SelectItem value="wechatpay">微信支付</SelectItem>
              <SelectItem value="credit">记账</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={async () => {
            const result = await handleSubmit();
            if (result?.error) {
              // Error handling will be done by parent
            }
          }}
          disabled={submitting}
        >
          {submitting ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />提交中...</>
          ) : (
            <><Truck className="w-3.5 h-3.5 mr-1" />提交发货申请</>
          )}
        </Button>
      </div>
    </div>
  );
}