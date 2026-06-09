import { useState, useEffect } from "react";
import { X, Truck, Package, MapPin, User, Phone, Home, Image as ImageIcon, Upload, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { base44 } from "@/api/base44Client";

export default function TransitShippingDetailPanel({ 
  pool, 
  selectedUserEntry, 
  selectedAddressGroup,
  onClose,
  onSave
}) {
  const [formData, setFormData] = useState({
    transit_shipping_method: '',
    transit_tracking_number: '',
    transit_fee_jpy: '',
    transit_note: '',
    transit_image_urls: []
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Generate a stable key for this address group based on order IDs
  const getAddressGroupKey = () => {
    if (!selectedAddressGroup?.orders?.length) return null;
    const orderIds = selectedAddressGroup.orders.map(o => o.order_id).sort();
    return orderIds.join('|');
  };

  // Load existing shipping data when selection changes
  useEffect(() => {
    if (selectedUserEntry && selectedAddressGroup) {
      const groupKey = getAddressGroupKey();
      if (!groupKey) return;

      // Find existing shipping info from pool.transit_shipping_info_per_user
      const userInfo = pool?.transit_shipping_info_per_user?.find(
        info => info.user_email === selectedUserEntry.user_email
      );
      
      if (userInfo && userInfo.address_groups) {
        // Find the address group by order IDs instead of index
        const existingGroup = userInfo.address_groups.find(group => {
          const groupOrderIds = (group.order_ids || []).sort();
          const currentOrderIds = selectedAddressGroup.orders.map(o => o.order_id || o.id).filter(Boolean).sort();
          return JSON.stringify(groupOrderIds) === JSON.stringify(currentOrderIds);
        });
        
        if (existingGroup) {
          setFormData({
            transit_shipping_method: existingGroup.transit_shipping_method || '',
            transit_tracking_number: existingGroup.transit_tracking_number || '',
            transit_fee_jpy: existingGroup.transit_fee_jpy || '',
            transit_note: existingGroup.transit_note || '',
            transit_image_urls: existingGroup.transit_image_urls || []
          });
        } else {
          // Reset form for new address group
          setFormData({
            transit_shipping_method: '',
            transit_tracking_number: '',
            transit_fee_jpy: '',
            transit_note: '',
            transit_image_urls: []
          });
        }
      } else {
        setFormData({
          transit_shipping_method: '',
          transit_tracking_number: '',
          transit_fee_jpy: '',
          transit_note: '',
          transit_image_urls: []
        });
      }
    }
  }, [selectedUserEntry, selectedAddressGroup, pool?.id]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Use the UploadFile integration
      const response = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = response.file_url;
      if (fileUrl) {
        setFormData(prev => ({
          ...prev,
          transit_image_urls: [...prev.transit_image_urls, fileUrl]
        }));
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      transit_image_urls: prev.transit_image_urls.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!selectedUserEntry || !selectedAddressGroup) return;
    
    setIsSaving(true);
    try {
      // Get order IDs for this address group - handle both order_id and id fields
      const orderIds = selectedAddressGroup.orders.map(o => o.order_id || o.id).filter(Boolean);

      await base44.functions.invoke('updateUserTransitShipping', {
        pool_id: pool?.id,
        user_email: selectedUserEntry.user_email,
        order_ids: orderIds,
        shipping_data: {
          ...formData,
          transit_fee_jpy: formData.transit_fee_jpy ? Number(formData.transit_fee_jpy) : 0
        }
      });
      
      if (onSave) {
        onSave(formData);
      }
    } catch (error) {
      console.error('Failed to save shipping info:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedUserEntry || !selectedAddressGroup) {
    return (
      <Card className="w-[400px] border-l-0 rounded-l-none h-full">
        <CardContent className="flex items-center justify-center h-full py-12">
          <div className="text-center text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">请选择一个地址组以填写发货信息</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const addr = selectedAddressGroup.address;
  const orderCount = selectedAddressGroup.orders.length;

  return (
    <Card className="w-[400px] border-l-0 rounded-l-none h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">中转地发货信息</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedUserEntry.user_name || selectedUserEntry.user_email}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-4">
          {/* Address Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800 text-sm">收货地址</span>
            </div>
            {addr && (
              <div className="text-xs space-y-1 text-blue-900">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{addr.recipient_name || '收件人'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <span>{addr.phone || '电话'}</span>
                </div>
                <div className="flex items-start gap-1">
                  <Home className="w-3 h-3 mt-0.5" />
                  <span className="text-xs">
                    {addr.country} {addr.addr1} {addr.addr2} {addr.addr3}
                    {addr.state && `, ${addr.state}`}
                    {addr.postal_code && ` ${addr.postal_code}`}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <Package className="w-3 h-3 mr-1" />
                {orderCount} 个订单
              </Badge>
            </div>
          </div>

          {/* Order List */}
          <div>
            <h4 className="font-medium text-gray-700 text-sm mb-2">包含订单</h4>
            <div className="space-y-1">
              {selectedAddressGroup.orders.map((entry, idx) => (
                <div key={idx} className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
                  <p className="font-medium text-gray-700 truncate">{entry.product_name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">数量：{entry.quantity}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Form */}
          <div className="space-y-3 pt-3 border-t">
            <h4 className="font-medium text-gray-700 text-sm">发货信息</h4>
            
            {/* Transit Shipping Method */}
            <div>
              <Label className="text-xs">中转运输方式</Label>
              <Input
                className="text-sm"
                value={formData.transit_shipping_method}
                onChange={(e) => handleInputChange('transit_shipping_method', e.target.value)}
                placeholder="填写中转运输方式"
              />
            </div>

            {/* Tracking Number */}
            <div>
              <Label className="text-xs">中转运输单号</Label>
              <Input
                className="text-sm"
                value={formData.transit_tracking_number}
                onChange={(e) => handleInputChange('transit_tracking_number', e.target.value)}
                placeholder="填写运输单号"
              />
            </div>

            {/* Transit Fee */}
            <div>
              <Label className="text-xs">中转运费 (JPY)</Label>
              <Input
                className="text-sm"
                type="number"
                value={formData.transit_fee_jpy}
                onChange={(e) => handleInputChange('transit_fee_jpy', e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Note */}
            <div>
              <Label className="text-xs">备注</Label>
              <Textarea
                className="text-sm min-h-[80px]"
                value={formData.transit_note}
                onChange={(e) => handleInputChange('transit_note', e.target.value)}
                placeholder="填写备注信息"
              />
            </div>

            {/* Image Upload */}
            <div>
              <Label className="text-xs mb-2 block">上传凭证图片</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="text-sm"
                />
                {isUploading && (
                  <div className="w-4 h-4 border-2 border-t-slate-800 border-slate-200 rounded-full animate-spin" />
                )}
              </div>
              
              {formData.transit_image_urls?.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {formData.transit_image_urls.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`凭证 ${idx + 1}`} className="w-full h-20 object-cover rounded border" />
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </ScrollArea>

      {/* Footer with Save Button */}
      <div className="border-t p-4 bg-gray-50 flex-shrink-0">
        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-t-white border-white/30 rounded-full animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? '保存中...' : '保存发货信息'}
        </Button>
      </div>
    </Card>
  );
}