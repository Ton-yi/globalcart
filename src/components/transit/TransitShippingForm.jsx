import { useState } from "react";
import { X, Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

export default function TransitShippingForm({ 
  pool, 
  shippingMethods, 
  onSubmit,
  loading 
}) {
  const [transitShippingMethod, setTransitShippingMethod] = useState(pool.pre_shipment?.transit_shipping_method || "");
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
      await onSubmit({
        transit_shipping_method: transitShippingMethod === 'custom' ? transitShippingMethodCustom : transitShippingMethod,
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
          <Upload className="w-4 h-4" />
          中转地发货信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shipping Method */}
        <div>
          <Label>中转运输方式</Label>
          <select
            value={transitShippingMethod}
            onChange={(e) => setTransitShippingMethod(e.target.value)}
            className="mt-1 w-full border rounded-lg p-2 text-sm"
          >
            <option value="">选择运输方式</option>
            {shippingMethods.map(method => (
              <option key={method.id} value={method.name}>
                {method.name}
              </option>
            ))}
            <option value="custom">自定义...</option>
          </select>
          {transitShippingMethod === 'custom' && (
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
      </CardContent>
    </Card>
  );
}