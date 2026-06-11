import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Package, AlertCircle, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import StorageSettingsManager from "@/components/admin/StorageSettingsManager";

export default function AdminStorageSettings() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const isTenantAdmin = user?.role === "admin" || user?.role === "tenant_admin";
  const isPlatformAdmin = user?.role === "platform_admin";

  if (user && !isTenantAdmin && !isPlatformAdmin) {
    return <div className="text-center py-8 text-red-600">仅管理员可访问此页面</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-5 h-5" />
          库存存放期限设置
        </h1>
      </div>

      <Card className="border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" />
            库存管理设置
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">
            设置订单库存存放期限、超期提醒和仓储管理费用
          </p>
        </CardHeader>
        <CardContent>
          <StorageSettingsManager />
        </CardContent>
      </Card>

      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            功能说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <strong>模块化功能：</strong>
              <p className="text-gray-500 text-xs mt-0.5">
                管理员可选择开启或关闭库存管理功能。关闭后，相关设置和功能不再显示，不影响其他功能正常使用。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <strong>存放期限：</strong>
              <p className="text-gray-500 text-xs mt-0.5">
                从订单入库日开始计算，管理员可设置默认存放天数（默认 90 天）。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <strong>到期行为：</strong>
              <p className="text-gray-500 text-xs mt-0.5">
                管理员可设置到期后自动执行的操作：发送提醒、追加仓储费用、更新订单状态为「已超时」。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <strong>仓储管理费：</strong>
              <p className="text-gray-500 text-xs mt-0.5">
                可设置每日仓储费用，支持按外箱模板单独设置（优先级高于默认设置）。费用累计至运费结算时一并收取。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <strong>通知模板：</strong>
              <p className="text-gray-500 text-xs mt-0.5">
                系统自动创建 3 个通知模板：即将到期通知、已到期通知、需要支付逾期费用通知。可在通知模板管理中自定义内容。
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <strong>自动化检查：</strong>
              <p className="text-gray-500 text-xs mt-0.5">
                系统每日自动检查超期订单，执行管理员设置的操作（提醒、收费、变更状态）。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}