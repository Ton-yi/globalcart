/**
 * TransitShippingForm - 中转地发货信息填写表单
 * 用于中转地负责人填写发货信息
 */
import { useState } from "react";
import { Truck, DollarSign, ClipboardCheck, Save, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TransitShippingForm({ request, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    transit_shipping_method: request?.transit_shipping_method || '',
    transit_tracking_number: request?.transit_tracking_number || '',
    transit_fee_jpy: request?.transit_fee_jpy || 0,
    transit_note: request?.transit_note || '',
    transit_shipped_date: request?.transit_shipped_date || new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      alert('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" />
            中转地发货信息
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600">运输方式</Label>
            <Input
              value={formData.transit_shipping_method}
              onChange={(e) => setFormData({ ...formData, transit_shipping_method: e.target.value })}
              placeholder="例如：EMS、航空便"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">发货日期</Label>
            <Input
              type="date"
              value={formData.transit_shipped_date}
              onChange={(e) => setFormData({ ...formData, transit_shipped_date: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600">运输单号</Label>
          <Input
            value={formData.transit_tracking_number}
            onChange={(e) => setFormData({ ...formData, transit_tracking_number: e.target.value })}
            placeholder="例如：1234567890"
            className="h-9 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-600">运费 (JPY)</Label>
          <Input
            type="number"
            value={formData.transit_fee_jpy}
            onChange={(e) => setFormData({ ...formData, transit_fee_jpy: parseInt(e.target.value) || 0 })}
            placeholder="0"
            className="h-9 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-600">备注</Label>
          <Textarea
            value={formData.transit_note}
            onChange={(e) => setFormData({ ...formData, transit_note: e.target.value })}
            placeholder="填写其他备注信息..."
            className="h-20 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            保存
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="text-xs h-8"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}