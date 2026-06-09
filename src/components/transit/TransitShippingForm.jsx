import { useState } from "react";
import { X, Upload, Loader2, Trash2, CheckCircle, Package, Truck, Calendar, FileText, Image as ImageIcon, Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";

export default function TransitShippingForm({ 
  pool, 
  transitMethods, 
  preferredTransitMethodId,
  onSubmit,
  loading 
}) {
  const isSubmitted = !!pool.transit_shipped_date;
  const [transitShippingMethodId, setTransitShippingMethodId] = useState(preferredTransitMethodId || "");
  const [transitShippingMethodCustom, setTransitShippingMethodCustom] = useState("");
  const [transitTrackingNumber, setTransitTrackingNumber] = useState("");
  const [transitFeeJpy, setTransitFeeJpy] = useState("");
  const [transitImages, setTransitImages] = useState([]);
  const [transitNote, setTransitNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file }).then(r => r.file_url)
      );
      const urls = await Promise.all(uploadPromises);
      setTransitImages(prev => [...prev, ...urls]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (url) => {
    setTransitImages(prev => prev.filter(u => u !== url));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const selectedMethod = transitMethods.find(m => m.id === transitShippingMethodId);
      await onSubmit({
        transit_shipping_method_id: transitShippingMethodId === 'custom' ? null : transitShippingMethodId,
        transit_shipping_method: transitShippingMethodId === 'custom' ? transitShippingMethodCustom : selectedMethod?.name,
        transit_tracking_number: transitTrackingNumber,
        transit_fee_jpy: parseFloat(transitFeeJpy) || 0,
        transit_image_urls: transitImages,
        transit_note: transitNote
      });
    } catch (error) {
      console.error('Submit failed:', error);
      alert('提交失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isSubmitted ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              中转地发货详情
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              中转地发货信息
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSubmitted ? (
          /* ===== Submitted View (Read-only, Detailed) ===== */
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3 mr-1 inline" />
                已发货
              </Badge>
              {pool.transit_shipped_date && (
                <span className="text-xs text-gray-500">
                  发货时间：{new Date(pool.transit_shipped_date).toLocaleString("zh-CN")}
                </span>
              )}
            </div>

            {/* Shipping Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Truck className="w-3.5 h-3.5" />
                  <span>运输方式</span>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {pool.transit_shipping_method || pool.transit_shipping_method_name || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Package className="w-3.5 h-3.5" />
                  <span>运单号</span>
                </div>
                <p className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                  {pool.transit_tracking_number || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileText className="w-3.5 h-3.5" />
                  <span>中转运费</span>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {pool.transit_fee_jpy ? `${pool.transit_fee_jpy} JPY` : "0 JPY"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <User className="w-3.5 h-3.5" />
                  <span>发货操作人</span>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {pool.transit_shipped_by || "-"}
                </p>
              </div>
            </div>

            {/* Note */}
            {pool.transit_note && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <FileText className="w-3.5 h-3.5" />
                  <span>中转人备注</span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{pool.transit_note}</p>
                </div>
              </div>
            )}

            {/* Images */}
            {pool.transit_arrival_image_urls && pool.transit_arrival_image_urls.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>发货图片 ({pool.transit_arrival_image_urls.length})</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {pool.transit_arrival_image_urls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={url} 
                        alt={`Transit ${idx}`} 
                        className="w-full h-24 object-cover rounded border hover:shadow-md transition-shadow cursor-pointer" 
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Info */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>创建时间：{new Date(pool.created_date).toLocaleString("zh-CN")}</span>
              </div>
              {pool.transit_arrival_confirmed_at && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>中转地收货：{new Date(pool.transit_arrival_confirmed_at).toLocaleString("zh-CN")}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ===== Edit Form (Existing) ===== */
          <>
            {/* Shipping Method */}
            <div>
              <Label>中转运输方式</Label>
              <select
                value={transitShippingMethodId}
                onChange={(e) => setTransitShippingMethodId(e.target.value)}
                className="mt-1 w-full border rounded-lg p-2 text-sm"
              >
                <option value="">选择运输方式</option>
                {transitMethods.map(method => (
                  <option key={method.id} value={method.id}>
                    {method.name} {method.description ? `(${method.description})` : ''}
                  </option>
                ))}
                <option value="custom">自定义...</option>
              </select>
              {transitShippingMethodId === 'custom' && (
                <Input
                  placeholder="输入自定义运输方式"
                  value={transitShippingMethodCustom}
                  onChange={(e) => setTransitShippingMethodCustom(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {/* Tracking Number */}
            <div>
              <Label>中转运输单号</Label>
              <Input
                placeholder="输入运单号"
                value={transitTrackingNumber}
                onChange={(e) => setTransitTrackingNumber(e.target.value)}
              />
            </div>

            {/* Transit Fee */}
            <div>
              <Label>中转运费 (JPY)</Label>
              <Input
                type="number"
                placeholder="0"
                value={transitFeeJpy}
                onChange={(e) => setTransitFeeJpy(e.target.value)}
              />
            </div>

            {/* Images */}
            <div>
              <Label>中转地发货图片</Label>
              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-blue-600 mt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </div>
              ) : (
                <label className="cursor-pointer block mt-1">
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-blue-300 transition-colors">
                    <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">点击上传图片</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
              {transitImages.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {transitImages.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} alt={`Transit ${idx}`} className="w-full h-20 object-cover rounded border" />
                      <button
                        onClick={() => handleRemoveImage(url)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <Label>中转人备注</Label>
              <Textarea
                placeholder="填写打包备注、特殊情况说明等..."
                value={transitNote}
                onChange={(e) => setTransitNote(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Submit Button */}
            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={saving || uploading}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  保存并提交
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}