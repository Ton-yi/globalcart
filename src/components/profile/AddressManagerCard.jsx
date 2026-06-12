/**
 * AddressManagerCard — 收货地址管理（新旧个人档案页共用）
 * 地址增删改 / 设为默认，改动即时保存
 */
import { useState, useEffect } from "react";
import { useUserPref } from "@/hooks/useUserPref";
import AddressForm, { EMPTY_ADDRESS_FORM, serializeAddressToText, isAddressFormValid } from "@/components/common/AddressForm";
import { getCountry } from "@/lib/countries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, Edit2, Check, Star } from "lucide-react";
import { toast } from "sonner";

export default function AddressManagerCard() {
  const { pref, prefs, savePref } = useUserPref();
  const [addresses, setAddresses] = useState([]);
  const [defaultAddressId, setDefaultAddressId] = useState("");
  const [editingAddr, setEditingAddr] = useState(null); // null | "new" | id
  const [addrForm, setAddrForm] = useState({ label: "", ...EMPTY_ADDRESS_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pref) return;
    // 合并所有 pref 记录中的地址（按 id 去重）
    const allAddrs = (prefs || []).flatMap(r => r.saved_addresses || []);
    const seen = new Set();
    const merged = allAddrs
      .filter(a => { if (!a.id || seen.has(a.id)) return false; seen.add(a.id); return true; })
      .map(a => ({ country: "", ...a }));
    setAddresses(merged);
    setDefaultAddressId(pref.default_address_id || "");
  }, [pref?.id]); // eslint-disable-line

  const persist = async (newAddresses, newDefaultId) => {
    setSaving(true);
    await savePref({ saved_addresses: newAddresses, default_address_id: newDefaultId });
    setSaving(false);
  };

  const af = (k, v) => setAddrForm(p => ({ ...p, [k]: v }));

  const handleOpenNew = () => {
    setAddrForm({ label: "", ...EMPTY_ADDRESS_FORM });
    setEditingAddr("new");
  };

  const handleOpenEdit = (addr) => {
    setAddrForm({
      label: addr.label || "",
      recipient_name: addr.recipient_name || "",
      country: addr.country || "",
      addr1: addr.addr1 || "",
      addr2: addr.addr2 || "",
      addr3: addr.addr3 || "",
      state: addr.state || "",
      phone: addr.phone || "",
    });
    setEditingAddr(addr.id);
  };

  const handleSaveAddr = async () => {
    if (!addrForm.label.trim() || !isAddressFormValid(addrForm)) return;
    const { label, ...fields } = addrForm;
    const full_text = serializeAddressToText(fields);
    let newAddresses;
    let newDefaultId = defaultAddressId;
    if (editingAddr === "new") {
      const newAddr = { id: Date.now().toString(), label, full_text, ...fields };
      newAddresses = [...addresses, newAddr];
      if (addresses.length === 0) newDefaultId = newAddr.id;
    } else {
      newAddresses = addresses.map(a => a.id === editingAddr ? { ...a, label, full_text, ...fields } : a);
    }
    setAddresses(newAddresses);
    setDefaultAddressId(newDefaultId);
    setEditingAddr(null);
    await persist(newAddresses, newDefaultId);
    toast.success("地址已保存");
  };

  const handleDeleteAddr = async (id) => {
    const newAddresses = addresses.filter(a => a.id !== id);
    const newDefaultId = defaultAddressId === id ? "" : defaultAddressId;
    setAddresses(newAddresses);
    setDefaultAddressId(newDefaultId);
    await persist(newAddresses, newDefaultId);
    toast.success("地址已删除");
  };

  const setDefaultAddr = async (id) => {
    setDefaultAddressId(id);
    await persist(addresses, id);
    toast.success("默认地址已更新");
  };

  const isEditing = editingAddr !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />收货地址管理
          </CardTitle>
          {!isEditing && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleOpenNew}>
              <Plus className="w-3.5 h-3.5 mr-1" />添加地址
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing && (
          <div className="border border-red-100 rounded-xl p-4 bg-red-50/30 space-y-3">
            <p className="text-xs font-medium text-gray-600">{editingAddr === "new" ? "添加新地址" : "编辑地址"}</p>
            <div>
              <Label className="text-xs text-gray-500">地址标签 *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="如：家、公司" value={addrForm.label} onChange={e => af("label", e.target.value)} />
            </div>
            <AddressForm value={addrForm} onChange={v => setAddrForm(prev => ({ ...prev, ...v }))} />
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditingAddr(null)}>取消</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSaveAddr} disabled={saving || !addrForm.label.trim() || !isAddressFormValid(addrForm)}>
                <Check className="w-3.5 h-3.5 mr-1" />{saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        )}

        {addresses.length === 0 && !isEditing && (
          <p className="text-xs text-gray-400 text-center py-4">暂无收货地址，点击"添加地址"</p>
        )}
        {addresses.map(addr => {
          const isDefault = defaultAddressId === addr.id;
          return (
            <div key={addr.id} className={`rounded-xl border p-3 ${isDefault ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-gray-50"}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{addr.label}</span>
                  {addr.country && <Badge variant="outline" className="text-xs">{getCountry(addr.country)?.name || addr.country}</Badge>}
                  {isDefault && (
                    <Badge className="text-xs bg-red-100 text-red-700 flex items-center gap-1">
                      <Star className="w-2.5 h-2.5" />默认
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isDefault && (
                    <button onClick={() => setDefaultAddr(addr.id)} className="text-xs text-gray-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 whitespace-nowrap">
                      设为默认
                    </button>
                  )}
                  <button onClick={() => handleOpenEdit(addr)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteAddr(addr.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{addr.full_text}</p>
            </div>
          );
        })}

        <p className="text-xs text-gray-400">默认收货地址将在发货申请时自动填入，改动即时保存</p>
      </CardContent>
    </Card>
  );
}