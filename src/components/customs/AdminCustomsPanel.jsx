/**
 * AdminCustomsPanel
 *
 * Admin interface for viewing/editing the customs declaration of a ShipmentRequest.
 * Rendered inside the admin shipment detail view.
 * Editable until shipping_request_status = 'shipped'.
 *
 * Props:
 *   shipmentRequestId: string
 *   shipmentStatus: string
 *   customsMode: 'admin_fill' | 'user_fill'
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Edit2, Save, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CustomsDeclarationForm from "@/components/customs/CustomsDeclarationForm";

const LOCKED_STATUSES = ['shipped', 'delivered'];

export default function AdminCustomsPanel({ shipmentRequestId, shipmentStatus, customsMode }) {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [declaration, setDeclaration] = useState(null);
  const [dangerousGoodsText, setDangerousGoodsText] = useState("");
  const [formValue, setFormValue] = useState(null);

  const isLocked = LOCKED_STATUSES.includes(shipmentStatus);

  useEffect(() => {
    if (!shipmentRequestId) return;
    setLoading(true);
    base44.functions.invoke('getCustomsDeclaration', { shipment_request_id: shipmentRequestId })
      .then(r => {
        const data = r.data || {};
        setDeclaration(data.declaration || null);
        setDangerousGoodsText(data.dangerous_goods_text || "");
        setFormValue(data.declaration ? {
          items: data.declaration.items || [],
          dangerous_goods_confirmed: data.declaration.dangerous_goods_confirmed || false,
          undeliverable_instruction: data.declaration.undeliverable_instruction || "",
          return_method: data.declaration.return_method || "",
        } : {
          items: [{ item_name_en: "", unit_price: "", currency: "JPY", quantity: 1, weight_g: "", item_type: "gift", total_value: "" }],
          dangerous_goods_confirmed: false,
          undeliverable_instruction: "",
          return_method: "",
        });
      })
      .finally(() => setLoading(false));
  }, [shipmentRequestId]);

  const handleSave = async () => {
    setSaving(true);
    const r = await base44.functions.invoke('saveCustomsDeclaration', {
      shipment_request_id: shipmentRequestId,
      items: (formValue?.items || []).map(item => ({
        ...item,
        unit_price: parseFloat(item.unit_price) || 0,
        quantity: parseInt(item.quantity) || 1,
        weight_g: parseFloat(item.weight_g) || 0,
      })),
      dangerous_goods_confirmed: formValue?.dangerous_goods_confirmed || false,
      undeliverable_instruction: formValue?.undeliverable_instruction || null,
      return_method: formValue?.return_method || null,
    });
    if (r.data?.success) {
      setDeclaration(r.data.declaration);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
        <Loader2 className="w-4 h-4 animate-spin" />加载报关信息...
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">报关信息 (Customs Declaration)</span>
          <Badge className={`text-xs ${customsMode === 'user_fill' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {customsMode === 'user_fill' ? '用户填写' : '管理员填写'}
          </Badge>
          {declaration && (
            <Badge className="text-xs bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-0.5" />已填写
            </Badge>
          )}
          {saved && (
            <Badge className="text-xs bg-green-100 text-green-700 animate-pulse">保存成功 ✓</Badge>
          )}
        </div>
        {!isLocked && (
          editing ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>取消</Button>
              <Button size="sm" className="h-7 text-xs bg-gray-900 hover:bg-gray-800" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                保存
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>
              <Edit2 className="w-3 h-3 mr-1" />{declaration ? "编辑" : "填写"}
            </Button>
          )
        )}
        {isLocked && <Badge className="text-xs bg-gray-100 text-gray-500">发货后不可修改</Badge>}
      </div>

      <div className="p-4">
        {!declaration && !editing ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {customsMode === 'user_fill' ? '用户尚未填写报关信息' : '管理员尚未填写报关信息'}
          </p>
        ) : (
          <CustomsDeclarationForm
            value={formValue}
            onChange={setFormValue}
            dangerousGoodsText={dangerousGoodsText}
            readOnly={!editing}
          />
        )}
      </div>
    </div>
  );
}