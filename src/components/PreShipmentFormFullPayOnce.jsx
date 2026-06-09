/**
 * PreShipmentFormFullPayOnce - 一次付款配置组件
 * 在预出货阶段，根据出货方式估算运费并收取预估运费
 */
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Truck, Calculator, AlertTriangle } from "lucide-react";
import { getCountryZone } from "@/lib/countries";

/**
 * Resolve the best-match estimate rate for a given method + destination country.
 * Priority: method.official_pool_estimate_rates (country/zone match) >
 *           method.official_pool_estimate_rates (empty country = fallback) >
 *           method scalar (legacy) >
 *           globalRates array (country/zone match) >
 *           globalRates array (empty = fallback) >
 *           globalScalarRate/globalScalarUnit >
 *           hardcoded default (150 JPY / 100g)
 */
function resolveEstimateRate(method, destinationCountry, globalScalarRate, globalScalarUnit, globalRates) {
  const country = destinationCountry || "";
  const zone = country ? (getCountryZone ? getCountryZone(country) : null) : null;

  function matchRates(rates) {
    if (!rates || rates.length === 0) return null;
    // Exact country match
    let hit = rates.find(r => r.country && r.country === country);
    // Zone match
    if (!hit && zone) hit = rates.find(r => r.country && r.country === zone);
    // Fallback: empty country = applies to all
    if (!hit) hit = rates.find(r => !r.country);
    return hit;
  }

  // 1. Method-level rates array
  const methodHit = matchRates(method?.official_pool_estimate_rates);
  if (methodHit && methodHit.rate_per_unit > 0) {
    return { rate: methodHit.rate_per_unit, unitG: methodHit.unit_g > 0 ? methodHit.unit_g : 100 };
  }

  // 2. Method-level legacy scalar fields
  const legacyRate = method?.official_pool_estimate_rate_per_unit > 0
    ? method.official_pool_estimate_rate_per_unit
    : method?.official_pool_estimate_rate_per_100g > 0
      ? method.official_pool_estimate_rate_per_100g
      : null;
  if (legacyRate) {
    const legacyUnit = method?.official_pool_estimate_unit_g > 0 ? method.official_pool_estimate_unit_g : 100;
    return { rate: legacyRate, unitG: legacyUnit };
  }

  // 3. Global rates array
  const globalHit = matchRates(globalRates);
  if (globalHit && globalHit.rate_per_unit > 0) {
    return { rate: globalHit.rate_per_unit, unitG: globalHit.unit_g > 0 ? globalHit.unit_g : 100 };
  }

  // 4. Global legacy scalar
  if (globalScalarRate > 0) {
    return { rate: globalScalarRate, unitG: globalScalarUnit > 0 ? globalScalarUnit : 100 };
  }

  // 5. Hardcoded default
  return { rate: 150, unitG: 100 };
}

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
  shippingMethod,
  destinationCountry,
  isRestoring,
  globalEstimateRatePer100g,  // legacy scalar fallback
  globalEstimateUnitG,         // legacy scalar unit fallback
  globalEstimateRates,         // new array-style global rates [{country, rate_per_unit, unit_g}]
}) {
  // Reset when consType/pool selection changes, but NOT during initial data restore
  const isRestoringRef = useRef(isRestoring);
  useEffect(() => { isRestoringRef.current = isRestoring; }, [isRestoring]);

  useEffect(() => {
    if (isRestoringRef.current) return; // skip reset while parent is restoring saved data
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
      console.log('[FullPay] Skip: missing data', { fullPayOnceEnabled, userEstimatedWeight, shippingMethod, shippingMethodsLength: shippingMethods.length });
      setEstimatedShippingFee(0);
      return;
    }
    
    const weight = parseFloat(userEstimatedWeight) || 0;
    if (weight <= 0) {
      console.log('[FullPay] Skip: invalid weight', weight);
      setEstimatedShippingFee(0);
      return;
    }
    
    const method = shippingMethods.find(m => m.code === shippingMethod);
    if (!method) {
      console.log('[FullPay] Skip: method not found', shippingMethod);
      setEstimatedShippingFee(0);
      return;
    }
    
    // Map country code to zone (for shipping methods that use zone-based pricing)
    // This mapping should ideally come from SiteSettings or a config entity
    const countryToZone = {
      'CN': 'zone1',
      'US': 'zone2',
      'CA': 'zone2',
      'GB': 'zone2',
      'DE': 'zone2',
      'FR': 'zone2',
      'AU': 'zone2',
      'NZ': 'zone2',
      'KR': 'zone3',
      'TH': 'zone3',
      'SG': 'zone3',
      'MY': 'zone3',
      'PH': 'zone3',
      'VN': 'zone3',
      'ID': 'zone3',
      'IN': 'zone3',
      'BR': 'zone4',
      'MX': 'zone4',
      'AR': 'zone4',
      'CL': 'zone4',
      'ZA': 'zone4',
      'EG': 'zone4',
      'RU': 'zone5',
      'UA': 'zone5'
    };
    const zoneOrCountry = countryToZone[destinationCountry] || destinationCountry;
    
    console.log('[FullPay] Computing fee:', { 
      method: method.name, 
      rate_mode: method.rate_mode, 
      destinationCountry,
      zoneOrCountry,
      weight,
      consType,
      simple_rates_count: method.simple_rates?.length || 0,
      detailed_rates_count: method.detailed_rates?.length || 0
    });
    
    let fee = 0;
    
    if (consType === "official_pool") {
      // Priority: method-level rates array (country match) > method-level scalar > global rates array > global scalar > default
      const { rate: ratePerUnit, unitG } = resolveEstimateRate(method, destinationCountry, globalEstimateRatePer100g, globalEstimateUnitG, globalEstimateRates);
      fee = Math.ceil(weight / unitG) * ratePerUnit;
      console.log('[FullPay] Official pool fee:', fee, { ratePerUnit, unitG });
    } else if (consType === "") {
      // Direct shipping - use detailed rate table
      if (method.rate_mode === "simple" && method.simple_rates) {
        const rate = method.simple_rates.find(r => r.country === zoneOrCountry);
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
          console.log('[FullPay] Simple rate found:', { rate, fee });
        } else {
          console.log('[FullPay] Simple rate NOT found for zone/country:', zoneOrCountry, 'available zones:', method.simple_rates.map(r => r.country));
        }
      } else if (method.rate_mode === "detailed" && method.detailed_rates) {
        const rate = method.detailed_rates.find(r => 
          r.country === zoneOrCountry && 
          weight >= r.weight_from_g && 
          weight <= r.weight_to_g
        );
        if (rate) {
          fee = rate.fee || 0;
          console.log('[FullPay] Detailed rate found:', { rate, fee });
        } else {
          console.log('[FullPay] Detailed rate NOT found for zone:', zoneOrCountry, 'weight:', weight, 'available zones:', [...new Set(method.detailed_rates.map(r => r.country))]);
        }
      } else {
        console.log('[FullPay] No valid rate mode:', method.rate_mode);
      }
    }
    
    setEstimatedShippingFee(Math.round(fee));
  }, [fullPayOnceEnabled, userEstimatedWeight, shippingMethod, shippingMethods, consType, destinationCountry]);

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
          {/* Weight input - required when full pay once is enabled */}
          <div>
            <Label className="text-sm">预估重量 (g) <span className="text-red-500">*</span></Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="例如：500"
              value={userEstimatedWeight}
              onChange={(e) => setUserEstimatedWeight(e.target.value)}
              className={`mt-1 ${fullPayOnceEnabled && (!userEstimatedWeight || parseFloat(userEstimatedWeight) <= 0) ? "border-red-300 focus-visible:ring-red-300" : ""}`}
            />
            {fullPayOnceEnabled && (!userEstimatedWeight || parseFloat(userEstimatedWeight) <= 0) ? (
              <p className="text-xs text-red-500 mt-1">开启一次付款后，预估重量为必填项</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">请输入商品预估重量（克），用于计算运费</p>
            )}
          </div>

          {/* Real-time shipping fee display */}
          {fullPayOnceEnabled && userEstimatedWeight && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800 font-medium flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  预估运费
                </span>
                <span className="text-lg font-bold text-blue-700">¥{estimatedShippingFee > 0 ? estimatedShippingFee.toLocaleString() : '0'}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1.5">
                基于 {userEstimatedWeight}g · 运输方式：{shippingMethods.find(m => m.code === shippingMethod)?.name || '未选择'}
              </p>
              {estimatedShippingFee === 0 && (
                <p className="text-xs text-blue-600 mt-1 text-orange-600">
                  无法计算运费，请检查：1) 是否选择了运输方式 2) 该运输方式是否配置了运费模板
                </p>
              )}
              {consType === "official_pool" && estimatedShippingFee > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  <Calculator className="w-3 h-3 inline mr-1" />
                  简易估算：{(() => {
                    const m = shippingMethods.find(sm => sm.code === shippingMethod);
                    const { rate, unitG } = resolveEstimateRate(m, destinationCountry, globalEstimateRatePer100g, globalEstimateUnitG, globalEstimateRates);
                    return `每 ${unitG}g 按 ${rate} JPY`;
                  })()} 计算
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