/**
 * CustomerLogisticsTab - 客户物流地址 Tab
 * 默认收货地址 / 历史地址 / 常用发货方式 / 目的国家 / 中转地使用情况
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star } from "lucide-react";

function AddressBlock({ addr, isDefault }) {
  if (!addr) return null;
  const lines = [
    addr.country, addr.state, addr.city,
    addr.addr1 || addr.address_line1, addr.addr2 || addr.address_line2, addr.addr3,
  ].filter(Boolean).join(" ");
  return (
    <div className={`p-3 border rounded-lg ${isDefault ? "border-blue-300 bg-blue-50" : ""}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{addr.recipient_name || addr.name || "-"}</p>
        {addr.phone && <span className="text-xs text-gray-400">{addr.phone}</span>}
        {isDefault && <Badge className="bg-blue-100 text-blue-700 text-xs"><Star className="w-3 h-3 mr-0.5" />默认</Badge>}
      </div>
      <p className="text-sm text-gray-600 mt-1">{lines || "-"}</p>
      {addr.postal_code && <p className="text-xs text-gray-400 mt-0.5">邮编 {addr.postal_code}</p>}
    </div>
  );
}

export default function CustomerLogisticsTab({ logistics, preferences }) {
  const l = logistics || {};
  const historyAddresses = (l.savedAddresses || []).filter(a => a !== l.defaultAddress);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />收货地址
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {l.defaultAddress ? (
            <AddressBlock addr={l.defaultAddress} isDefault />
          ) : (
            <p className="text-sm text-gray-400">未设置默认地址</p>
          )}
          {historyAddresses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">历史地址（{historyAddresses.length}）</p>
              <div className="space-y-2">
                {historyAddresses.map((addr, idx) => <AddressBlock key={idx} addr={addr} />)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">中转地使用情况</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">是否使用中转地：</span>
            <Badge className={l.usesTransit ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
              {l.usesTransit ? "是" : "否"}
            </Badge>
          </div>
          {l.topTransit && l.topTransit.length > 0 ? (
            <div className="space-y-1">
              {l.topTransit.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{t.name}</span>
                  <Badge variant="outline">{t.count} 次</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">无中转地使用记录</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">常用发货方式</CardTitle>
        </CardHeader>
        <CardContent>
          {preferences?.topShippingMethods && preferences.topShippingMethods.length > 0 ? (
            <div className="space-y-1">
              {preferences.topShippingMethods.map((method, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{method.name}</span>
                  <Badge variant="outline">{method.count} 次</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">无数据</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">目的国家/地区</CardTitle>
        </CardHeader>
        <CardContent>
          {preferences?.topCountries && preferences.topCountries.length > 0 ? (
            <div className="space-y-1">
              {preferences.topCountries.map((country, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm">{country.name}</span>
                  <Badge variant="outline">{country.count} 次</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">无数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}