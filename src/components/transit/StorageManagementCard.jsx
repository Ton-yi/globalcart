import { useState } from "react";
import { Package, Clock, Calendar, CheckCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

export default function StorageManagementCard({ pool, onUpdate, isAdmin }) {
  const [storageUntil, setStorageUntil] = useState(pool.transit_storage_until || '');
  const [saving, setSaving] = useState(false);

  const isStorageMode = pool.transit_storage_enabled;
  const isReleased = !!pool.transit_storage_released_to_pool_id;

  const handleEnableStorage = async () => {
    if (!storageUntil) {
      alert('请选择暂存截止日期');
      return;
    }

    setSaving(true);
    try {
      await base44.functions.invoke('manageTransitStorage', {
        pool_id: pool.id,
        action: 'enable_storage',
        storage_until: storageUntil
      });
      onUpdate?.();
      alert('已启用暂存模式');
    } catch (error) {
      alert('操作失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReleaseToPool = async (targetPoolId) => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageTransitStorage', {
        pool_id: pool.id,
        action: 'release_to_pool',
        target_pool_id: targetPoolId
      });
      onUpdate?.();
      alert('已释放到新拼邮');
    } catch (error) {
      alert('操作失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeToShipping = async (shippingMethod) => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageTransitStorage', {
        pool_id: pool.id,
        action: 'change_to_shipping',
        transit_shipping_method: shippingMethod,
        transit_shipping_method_name: shippingMethod
      });
      onUpdate?.();
      alert('已变更为发货模式');
    } catch (error) {
      alert('操作失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" />
          暂存管理
          {isStorageMode && (
            <Badge className="bg-blue-100 text-blue-700 ml-2">暂存中</Badge>
          )}
          {isReleased && (
            <Badge className="bg-green-100 text-green-700 ml-2">
              <CheckCircle className="w-3 h-3 mr-1" />
              已发出
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Storage Status */}
        {isStorageMode && !isReleased && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm bg-blue-50 p-2 rounded">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="font-medium">暂存截止：</span>
              <span>{pool.transit_storage_until}</span>
            </div>
            
            <p className="text-xs text-gray-500">
              暂存期间，您可以随时变更中转运输方式以发出，或等待管理员将订单合并到新拼邮中。
            </p>
          </div>
        )}

        {/* Released Status */}
        {isReleased && (
          <div className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>已合并到新拼邮并发出</span>
          </div>
        )}

        {/* Enable Storage (Admin Only) */}
        {!isStorageMode && isAdmin && (
          <div>
            <Label>暂存截止日期</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="date"
                value={storageUntil}
                onChange={(e) => setStorageUntil(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleEnableStorage} disabled={saving}>
                启用暂存
              </Button>
            </div>
          </div>
        )}

        {/* Actions for storage mode */}
        {isStorageMode && !isReleased && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">操作选项：</p>
            
            {/* Change to shipping */}
            <div className="flex gap-2">
              <select className="flex-1 border rounded-lg p-2 text-sm">
                <option value="">选择运输方式</option>
                {/* Shipping methods would be passed as prop */}
              </select>
              <Button 
                size="sm"
                onClick={() => handleChangeToShipping('EMS')}
                disabled={saving}
              >
                变更为发货
              </Button>
            </div>
            
            {/* Merge to new pool (admin) */}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReleaseToPool('new_pool_id')}
                disabled={saving}
                className="w-full"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                合并到新拼邮（管理员操作）
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}