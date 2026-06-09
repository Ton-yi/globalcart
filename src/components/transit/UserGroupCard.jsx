/**
 * UserGroupCard - 显示用户分组及其订单详情
 * 用于中转地工作面板，展示每个用户的订单集合
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Package, MapPin, Edit2, Save, X, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCountry } from "@/lib/countries";

export default function UserGroupCard({ userEntry, orders, onAddressUpdate, onPackingImageUpload }) {
  const [expanded, setExpanded] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressData, setAddressData] = useState(userEntry.final_address || {});
  const [saving, setSaving] = useState(false);

  const handleSaveAddress = async () => {
    setSaving(true);
    try {
      await onAddressUpdate(userEntry.id, addressData);
      setEditingAddress(false);
    } catch (error) {
      alert('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      await onPackingImageUpload(userEntry.id, file);
    } catch (error) {
      alert('上传失败：' + error.message);
    }
  };

  const orderCount = userEntry.order_ids?.length || 0;
  const hasAddress = userEntry.final_address && userEntry.final_address.recipient_name;

  return (
    <Card className="border-gray-200 hover:border-indigo-300 transition-colors">
      <CardContent className="p-0">
        {/* Header - Always Visible */}
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xs font-semibold text-indigo-700">
                  {(userEntry.user_name || userEntry.user_email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {userEntry.user_name || userEntry.user_email}
                </p>
                <p className="text-xs text-gray-500">
                  {orderCount} 个订单 · ¥{Math.round(userEntry.estimated_jpy).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasAddress ? (
              <Badge variant="outline" className="text-xs">
                <MapPin className="w-3 h-3 mr-1 text-green-600" />
                已填写地址
              </Badge>
            ) : (
              <Badge className="text-xs bg-yellow-100 text-yellow-700">
                <MapPin className="w-3 h-3 mr-1" />
                待填写地址
              </Badge>
            )}
            {userEntry.packing_image_urls?.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <ImageIcon className="w-3 h-3 mr-1" />
                {userEntry.packing_image_urls.length} 图
              </Badge>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="border-t border-gray-100 p-4 space-y-4">
            {/* Address Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  最终收货地址
                </h4>
                {!editingAddress && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingAddress(true)}
                    className="h-7 text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    编辑
                  </Button>
                )}
              </div>

              {editingAddress ? (
                <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <Label className="text-xs">收件人</Label>
                    <Input
                      value={addressData.recipient_name || ''}
                      onChange={(e) => setAddressData({ ...addressData, recipient_name: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">电话</Label>
                    <Input
                      value={addressData.phone || ''}
                      onChange={(e) => setAddressData({ ...addressData, phone: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">国家</Label>
                    <Input
                      value={addressData.country || ''}
                      onChange={(e) => setAddressData({ ...addressData, country: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">地址行 1</Label>
                    <Input
                      value={addressData.addr1 || ''}
                      onChange={(e) => setAddressData({ ...addressData, addr1: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">地址行 2</Label>
                    <Input
                      value={addressData.addr2 || ''}
                      onChange={(e) => setAddressData({ ...addressData, addr2: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">地址行 3</Label>
                    <Input
                      value={addressData.addr3 || ''}
                      onChange={(e) => setAddressData({ ...addressData, addr3: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">州/省</Label>
                    <Input
                      value={addressData.state || ''}
                      onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveAddress}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
                    >
                      {saving ? <span className="animate-spin">⏳</span> : <Save className="w-3 h-3 mr-1" />}
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingAddress(false)}
                      className="text-xs h-8"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : hasAddress ? (
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{addressData.recipient_name}</p>
                  <p className="text-gray-600 mt-1">{addressData.phone}</p>
                  <p className="text-gray-600 mt-1">
                    {getCountry(addressData.country)?.name || addressData.country}
                  </p>
                  <p className="text-gray-600">{addressData.addr1}</p>
                  {addressData.addr2 && <p className="text-gray-600">{addressData.addr2}</p>}
                  {addressData.addr3 && <p className="text-gray-600">{addressData.addr3}</p>}
                  {addressData.state && <p className="text-gray-600">{addressData.state}</p>}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-lg">
                  暂无地址信息
                </div>
              )}
            </div>

            {/* Packing Images Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  打包图片
                </h4>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <span>上传图片</span>
                  </Button>
                </label>
              </div>
              
              {userEntry.packing_image_urls?.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto">
                  {userEntry.packing_image_urls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`打包图${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border flex-shrink-0"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic">暂无打包图片</div>
              )}
            </div>

            {/* Orders List */}
            {orders.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  订单列表（{orders.length}）
                </h4>
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{order.product_name}</span>
                      </div>
                      <span className="text-gray-600">¥{Math.round(order.estimated_jpy).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}