/**
 * PreShipmentFormFullPayOnce - 一次付款配置组件
 * 在预出货阶段，根据出货方式估算运费并收取预估运费
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Truck, Calculator, AlertTriangle } from "lucide-react";

export default function PreShipmentFormFullPayOnce({ 
  shippingMethods, 
  consType, 
  joinExistingPool, 
  selectedExistingPoolId,
  userEstimatedWeight,
  setUserEstimatedWeight,
  estimatedShippingFee,
  setEstimatedShippingFee,
  fullPayOnceEnabled,
  setFullPayOnceEnabled,
  order,
  shippingMethod
}) {
  // Reset when consType changes
  useEffect(() => {
    setUserEstimatedWeight("");
    setEstimatedShippingFee(0);
    setFullPayOnceEnabled(false);
  }, [consType, joinExistingPool, selectedExistingPoolId]);

  // Check if one-time payment is allowed
  const isAllowed = () => {
    // Not allowed when joining existing pool
    if (joinExistingPool && selectedExistingPoolId) {
      return false;
    }
    // Allowed for direct shipping and official pool
    return consType === "" || consType === "official_pool";
  };

  // Calculate shipping fee based on shipping mode
  useEffect(() => {
    if (!fullPayOnceEnabled || !userEstimatedWeight || !shippingMethod || !shippingMethods.length) {
      setEstimatedShippingFee(0);
      return;
    }
    
    const weight = parseFloat(userEstimatedWeight) || 0;
    if (weight <= 0) {
      setEstimatedShippingFee(0);
      return;
    }
    
    const method = shippingMethods.find(m => m.code === shippingMethod);
    if (!method) {
      setEstimatedShippingFee(0);
      return;
    }
    
    let fee = 0;
    
    // Get destination country from order's pre_shipment address or user preference
    const destinationCountry = order?.pre_shipment?.address?.country || "CN";
    
    if (consType === "official_pool") {
      // Simple estimation for official pool: 150 JPY per 100g
      // This can be configured in shipping method settings later
      const simpleRatePer100g = 150;
      fee = Math.ceil(weight / 100) * simpleRatePer100g;
    } else if (consType === "") {
      // Direct shipping - use detailed rate table
      if (method.rate_mode === "simple" && method.simple_rates) {
        const rate = method.simple_rates.find(r => r.country === destinationCountry);
        if (rate) {
          const firstWeight = rate.first_weight_g || 500;
          const firstFee = rate.first_weight_fee || 0;
          const additionalUnit = rate.additional_unit_g || 500;
          const additionalFee = rate.additional_unit_fee || 0;
          
          if (weight <= firstWeight) {
            fee = firstFee;
          } else {
            const additionalUnits = Math.ceil((weight - firstWeight) / additionalUnit);
            fee = firstFee + (additionalUnits * additionalFee);
          }
        }
      } else if (method.rate_mode === "detailed" && method.detailed_rates) {
        const rate = method.detailed_rates.find(r => 
          r.country === destinationCountry && 
          weight >= r.weight_from_g && 
          weight <= r.weight_to_g
        );
        if (rate) {
          fee = rate.fee || 0;
        }
      }
    }
    
    setEstimatedShippingFee(Math.round(fee));
  }, [fullPayOnceEnabled, userEstimatedWeight, shippingMethod, shippingMethods, consType, order]);

  if (!isAllowed()) {
    return (
      <Alert className="border-gray-200 bg-gray-50">
        <AlertTriangle className="w-4 h-4 text-gray-500" />
        <AlertDescription className="text-gray-600 text-sm">
          加入已有发货池时不支持一次付款模式，运费将在拼邮完成后按实际金额结算。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            一次付款（货款 + 预估运费）
          </CardTitle>
          <Switch
            checked={fullPayOnceEnabled}
            onCheckedChange={setFullPayOnceEnabled}
            className="data-[state=checked]:bg-green-600"
            disabled={!shippingMethods.length}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          启用后，将预先收取预估运费，仓库实际测量后多退少补
        </p>
      </CardHeader>
      
      {fullPayOnceEnabled && (
        <CardContent className="space-y-4">
          {/* Weight input */}
          <div>
            <Label className="text-sm">预估重量 (g) *</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="例如：500"
              value={userEstimatedWeight}
              onChange={(e) => setUserEstimatedWeight(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">请输入商品预估重量（克），用于计算运费</p>
          </div>

          {/* Estimated shipping fee display */}
          {estimatedShippingFee > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-800 font-medium">预估运费</span>
                <span className="text-lg font-bold text-green-700">¥{estimatedShippingFee.toLocaleString()}</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                基于 {userEstimatedWeight}g · 实际重量以仓库测量为准，多退少补
              </p>
              {consType === "official_pool" && (
                <p className="text-xs text-green-600 mt-1">
                  <Calculator className="w-3 h-3 inline mr-1" />
                  简易估算：每 100g 按 150 JPY 计算
                </p>
              )}
            </div>
          )}

          {/* Warning for official pool */}
          {consType === "official_pool" && estimatedShippingFee > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-xs">
                拼邮运费为估算值，实际运费可能因打包方式、外箱重量等因素有所差异，最终以管理员结算为准。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}