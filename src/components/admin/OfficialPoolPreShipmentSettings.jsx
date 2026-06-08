import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

export default function OfficialPoolPreShipmentSettings({ settings, onUpdate, onReload }) {
  const getSetting = (key) => settings.find(s => s.key === key);
  
  const autoCreate = getSetting("official_pool_auto_create_pending");
  const mergeSameUser = getSetting("official_pool_merge_same_user");
  const separateColumns = getSetting("official_pool_separate_columns");
  const separateMethods = getSetting("official_pool_separate_methods");
  
  const autoCreateEnabled = autoCreate?.value !== "false";
  const mergeEnabled = mergeSameUser?.value === "true";
  const separateEnabled = separateColumns?.value === "true";
  const separateMethodsValue = separateMethods?.value || "";

  const [localMethods, setLocalMethods] = useState(separateMethodsValue);

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-500" />
          官方拼邮预出货设置
        </CardTitle>
        <p className="text-xs text-gray-400 mt-1">
          配置用户下单时选择官方拼邮的自动化行为
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Auto-create pending column */}
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <div>
            <Label className="text-sm">预出货选择官方拼邮时自动创建预拼邮列</Label>
            <p className="text-xs text-gray-400 mt-0.5">开启后，用户下单时选择官方拼邮会自动在官方拼邮看板最左侧生成预拼邮订单列</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const newVal = autoCreateEnabled ? "false" : "true";
              await onUpdate("official_pool_auto_create_pending", newVal);
              await onReload();
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoCreateEnabled ? "bg-purple-600" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoCreateEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {autoCreateEnabled && (
          <>
            {/* Merge same user */}
            <div className="flex items-center justify-between pl-4 border-l-2 border-l-purple-200 pb-1 border-b border-gray-100">
              <div>
                <Label className="text-sm text-purple-700">自动合并同用户同预出货状态的订单</Label>
                <p className="text-xs text-gray-400 mt-0.5">开启后，同一用户的相同预出货状态订单会自动合并到一个预拼邮列中</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const newVal = mergeEnabled ? "false" : "true";
                  await onUpdate("official_pool_merge_same_user", newVal);
                  await onReload();
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mergeEnabled ? "bg-purple-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${mergeEnabled ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Separate columns */}
            <div className="pl-4 border-l-2 border-l-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-purple-700">分离多个预发货订单列</Label>
                  <p className="text-xs text-gray-400 mt-0.5">开启后，每个预发货项会单独创建一列预发货订单列</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const newVal = separateEnabled ? "false" : "true";
                    await onUpdate("official_pool_separate_columns", newVal);
                    await onReload();
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${separateEnabled ? "bg-purple-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${separateEnabled ? "translate-x-4" : "translate-x-1"}`} />
                </button>
              </div>

              {separateEnabled && (
                <div>
                  <Label className="text-xs text-gray-500">单独成列的运输方式（留空=全分离）</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      className="h-8 text-sm flex-1"
                      placeholder="EMS,SAL,DHL"
                      value={localMethods}
                      onChange={e => setLocalMethods(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={async () => {
                        await onUpdate("official_pool_separate_methods", localMethods);
                        await onReload();
                      }}
                    >
                      保存
                    </Button>
                  </div>
                  {localMethods && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {localMethods.split(",").map(m => m.trim()).filter(Boolean).map((m, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}