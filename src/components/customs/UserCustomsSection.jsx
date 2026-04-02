/**
 * UserCustomsSection
 *
 * Shown on the user side when a ShipmentRequest has customs_declaration_mode = 'user_fill'.
 * Loads the declaration, shows the form, and allows saving.
 *
 * Props:
 *   shipmentRequest: { id, shipping_request_status, customs_declaration_mode }
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Save, Loader2, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CustomsDeclarationForm from "@/components/customs/CustomsDeclarationForm";

const LOCKED_STATUSES = ['shipped', 'delivered'];

export default function UserCustomsSection({ shipmentRequest }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [declaration, setDeclaration] = useState(null);
  const [dangerousGoodsText, setDangerousGoodsText] = useState("");
  const [formValue, setFormValue] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const isLocked = LOCKED_STATUSES.includes(shipmentRequest?.shipping_request_status);
  const mode = shipmentRequest?.customs_declaration_mode;

  useEffect(() => {
    if (!shipmentRequest?.id) return;
    setLoading(true);
    base44.functions.invoke('getCustomsDeclaration', { shipment_request_id: shipmentRequest.id })
      .then(r => {
        const data = r.data || {};
        setDeclaration(data.declaration || null);
        setDangerousGoodsText(data.dangerous_goods_text || "");
        const decl = data.declaration;
        setFormValue(decl ? {
          items: decl.items || [],
          dangerous_goods_confirmed: decl.dangerous_goods_confirmed || false,
          undeliverable_instruction: decl.undeliverable_instruction || "",
          return_method: decl.return_method || "",
        } : {
          items: [{ item_name_en: "", unit_price: "", currency: "JPY", quantity: 1, weight_g: "", item_type: "gift", total_value: "" }],
          dangerous_goods_confirmed: false,
          undeliverable_instruction: "",
          return_method: "",
        });
        // Auto-expand if incomplete
        if (!decl && mode === 'user_fill') setExpanded(true);
      })
      .finally(() => setLoading(false));
  }, [shipmentRequest?.id]);

  const handleSave = async () => {
    setSaving(true);
    const r = await base44.functions.invoke('saveCustomsDeclaration', {
      shipment_request_id: shipmentRequest.id,
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  // Not user_fill — don't render
  if (mode !== 'user_fill') return null;

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100/60 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">报关信息 (Customs Declaration)</span>
          {declaration ? (
            <Badge className="text-xs bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-0.5" />已填写
            </Badge>
          ) : (
            <Badge className="text-xs bg-orange-100 text-orange-700">待填写</Badge>
          )}
          {saved && <Badge className="text-xs bg-green-100 text-green-700 animate-pulse">保存成功 ✓</Badge>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
              <Loader2 className="w-4 h-4 animate-spin" />加载中...
            </div>
          ) : (
            <>
              <CustomsDeclarationForm
                value={formValue}
                onChange={setFormValue}
                dangerousGoodsText={dangerousGoodsText}
                readOnly={isLocked}
              />
              {!isLocked && (
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    {saving ? "保存中..." : "保存报关信息"}
                  </Button>
                </div>
              )}
              {isLocked && (
                <p className="text-xs text-gray-400 text-right">发货后报关信息不可修改</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}