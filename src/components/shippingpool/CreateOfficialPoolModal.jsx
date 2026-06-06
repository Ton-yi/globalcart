/**
 * CreateOfficialPoolModal
 * Simplified wizard for admins to create official consolidation pools.
 * No order selection step - just basic info (address, shipping method, date, notes).
 * Users can later add their own orders to the pool.
 */
import { useState, useEffect } from "react";
import { X, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi, tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountrySelect from "@/components/common/CountrySelect";
import { SHIPPING_METHODS } from "@/components/shippingpool/shippingFormConstants";

export default function CreateOfficialPoolModal({ onClose, onSuccess }) {
  const [user, setUser] = useState(null);
  const [transitLocations, setTransitLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    recipient_name: "",
    recipient_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    destination_country: "",
    shipping_method: "",
    scheduled_ship_date: "",
    transit_location_id: "",
    user_note: "",
    title: "",
  });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const u = await base44.auth.me();
      setUser(u);

      const locs = await tenantEntity.list('TransitLocation', { is_active: true });
      setTransitLocations(locs);

      // Auto-select the default official pool transit location
      const defaultLoc = locs.find(l => l.is_default_official_pool);
      if (defaultLoc) {
        setForm(p => ({
          ...p,
          transit_location_id: defaultLoc.id,
          recipient_name: defaultLoc.manager_contact || "",
          address_line1: defaultLoc.address || "",
          city: defaultLoc.province || "",
          destination_country: defaultLoc.country || "",
        }));
      }

      setLoading(false);
    };
    init().catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!form.destination_country) return;
    setSubmitting(true);

    const transitLoc = transitLocations.find(l => l.id === form.transit_location_id);

    // Generate pool_code
    const prefix = form.transit_location_id && transitLoc?.code_prefix ? transitLoc.code_prefix.toUpperCase() : "TYO";
    const allPools = await shippingPoolApi.list();
    const prefixPools = allPools.filter(p => p.pool_code && p.pool_code.startsWith(prefix));
    const pool_code = `${prefix}${(prefixPools.length + 1).toString().padStart(5, "0")}`;

    await shippingPoolApi.create({
      ...form,
      pool_code,
      order_ids: [],
      order_names: [],
      creator_email: user.email,
      creator_name: user.full_name || user.email,
      is_admin_created: true,
      total_weight_g: 0,
      status: "pending",
      transit_location_name: transitLoc?.name || "",
      messages: [],
      consolidation_type: "transit",
    });

    onSuccess?.();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900">创建官方拼邮需求</h2>
            <p className="text-xs text-gray-400 mt-0.5">填写基本信息，用户后续可自行添加订单</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <Label className="text-xs text-gray-500">拼邮需求标题（可选）</Label>
            <Input className="mt-1 h-8 text-sm" placeholder="如：3 月下旬东京拼邮"
              value={form.title} onChange={e => f("title", e.target.value)} />
          </div>

          {/* Address selector - transit locations only */}
          <div>
            <Label className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mb-1.5">
              <MapPin className="w-3.5 h-3.5" />收货/中转地址
            </Label>
            <Select 
              value={form.transit_location_id} 
              onValueChange={(v) => {
                const loc = transitLocations.find(l => l.id === v);
                if (loc) {
                  f("transit_location_id", v);
                  f("recipient_name", loc.manager_contact || "");
                  f("address_line1", loc.address || "");
                  f("city", loc.province || "");
                  f("destination_country", loc.country || "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择中转地..." />
              </SelectTrigger>
              <SelectContent>
                {transitLocations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    📍 {l.name} {l.code_prefix ? `(${l.code_prefix})` : ""} - {l.address || "地址待补充"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country + shipping method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">目的国家 *</Label>
              <CountrySelect
                value={form.destination_country}
                onChange={v => f("destination_country", v)}
                placeholder="选择国家"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">将从收货地址自动填充，可手动修改</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">运输方式</Label>
              <Select value={form.shipping_method} onValueChange={v => f("shipping_method", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="选择..." /></SelectTrigger>
                <SelectContent>
                  {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scheduled date */}
          <div>
            <Label className="text-xs text-gray-500">计划发货日期</Label>
            <Input type="date" className="mt-1 h-8 text-sm" value={form.scheduled_ship_date} onChange={e => f("scheduled_ship_date", e.target.value)} />
          </div>

          {/* Note */}
          <div>
            <Label className="text-xs text-gray-500">备注</Label>
            <Textarea rows={2} className="mt-1 text-sm" placeholder="特殊要求、说明..." value={form.user_note} onChange={e => f("user_note", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700"
            disabled={submitting || !form.transit_location_id}
            onClick={handleSubmit}>
            {submitting ? "创建中..." : "创建拼邮需求"}
          </Button>
        </div>
      </div>
    </div>
  );
}