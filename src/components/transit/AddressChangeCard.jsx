import { useState } from "react";
import { MapPin, Edit2, AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CountrySelect from "@/components/common/CountrySelect";
import { base44 } from "@/api/base44Client";

export default function AddressChangeCard({ pool, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    recipient_name: pool.recipient_name || '',
    phone: pool.recipient_phone || '',
    addr1: pool.address_line1 || '',
    addr2: pool.address_line2 || '',
    addr3: pool.address_line3 || '',
    city: pool.city || '',
    state: pool.state || '',
    postal_code: pool.postal_code || '',
    country: pool.destination_country || ''
  });

  const currentCount = pool.address_change_count || 0;
  const maxChanges = pool.max_address_changes ?? 1;
  const canChange = currentCount < maxChanges;

  const handleChange = async () => {
    if (!canChange) return;

    setSaving(true);
    try {
      await base44.functions.invoke('changePoolAddress', {
        pool_id: pool.id,
        new_address: formData
      });
      onUpdate?.();
      setEditing(false);
      alert('地址已更新');
    } catch (error) {
      alert(error.message || '更改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            最终收货地址
          </div>
          <Badge className={canChange ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
            已更改 {currentCount}/{maxChanges} 次
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display Mode */}
        {!editing && (
          <div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{pool.recipient_name}</p>
              <p className="text-gray-600">
                {[pool.address_line1, pool.address_line2, pool.address_line3].filter(Boolean).join(' ')}
              </p>
              <p className="text-gray-600">
                {[pool.city, pool.state, pool.postal_code].filter(Boolean).join(' ')}
              </p>
              <p className="text-gray-600">{pool.destination_country}</p>
              {pool.recipient_phone && <p className="text-gray-600">电话：{pool.recipient_phone}</p>}
            </div>
            
            {canChange && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                className="mt-3"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                更改地址
              </Button>
            )}
            
            {!canChange && (
              <div className="flex items-center gap-2 mt-3 text-xs text-red-600 bg-red-50 p-2 rounded">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>地址更改次数已达上限</span>
              </div>
            )}
          </div>
        )}

        {/* Edit Mode */}
        {editing && (
          <div className="space-y-3">
            <div>
              <Label>收件人姓名</Label>
              <Input
                value={formData.recipient_name}
                onChange={(e) => setFormData({...formData, recipient_name: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>国家</Label>
              <CountrySelect
                value={formData.country}
                onChange={(country) => setFormData({...formData, country})}
              />
            </div>
            
            <div>
              <Label>地址行 1</Label>
              <Input
                value={formData.addr1}
                onChange={(e) => setFormData({...formData, addr1: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>地址行 2</Label>
              <Input
                value={formData.addr2}
                onChange={(e) => setFormData({...formData, addr2: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>地址行 3</Label>
              <Input
                value={formData.addr3}
                onChange={(e) => setFormData({...formData, addr3: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>城市</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>州/省</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label>邮编</Label>
              <Input
                value={formData.postal_code}
                onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>电话</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleChange} disabled={saving}>
                <CheckCircle className="w-4 h-4 mr-2" />
                确认更改
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}