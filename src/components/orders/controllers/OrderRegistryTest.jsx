/**
 * 订单注册中心测试组件
 * 
 * 用于验证：
 * 1. 控制器是否正确注册
 * 2. 控制器的方法是否可调用
 * 3. 表格列配置是否正常返回
 */

import { useEffect, useState } from "react";
import { orderRegistry } from "@/lib/orderRegistry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function OrderRegistryTest() {
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    const runTests = async () => {
      const results = [];

      // Test 1: 检查注册中心是否已初始化
      try {
        const types = orderRegistry.getTypes();
        results.push({
          name: "注册中心初始化",
          passed: types.length > 0,
          message: `已注册 ${types.length} 个控制器：${types.join(', ')}`,
        });
      } catch (error) {
        results.push({
          name: "注册中心初始化",
          passed: false,
          message: `错误：${error.message}`,
        });
      }

      // Test 2: 检查实物订单控制器
      try {
        const physicalController = orderRegistry.get('physical');
        if (!physicalController) {
          throw new Error('实物订单控制器未注册');
        }

        // 测试 getLabel
        const label = physicalController.getLabel();
        if (label !== "实物订单") {
          throw new Error(`getLabel 返回错误：${label}`);
        }

        // 测试 getColumnConfig
        const columns = physicalController.getColumnConfig();
        if (!Array.isArray(columns) || columns.length === 0) {
          throw new Error('getColumnConfig 返回空数组');
        }

        // 测试 renderCell
        const mockOrder = {
          order_number: "TY202606140001",
          product_name: "测试商品",
          estimated_jpy: 10000,
          order_status: "pending_confirmation",
        };
        const cellContent = physicalController.renderCell(mockOrder, { key: "product_name" }, {});
        if (!cellContent) {
          throw new Error('renderCell 返回空值');
        }

        results.push({
          name: "实物订单控制器",
          passed: true,
          message: `✓ 标签：${label} | 列数：${columns.length}`,
        });
      } catch (error) {
        results.push({
          name: "实物订单控制器",
          passed: false,
          message: `错误：${error.message}`,
        });
      }

      // Test 3: 检查票务订单控制器
      try {
        const ticketController = orderRegistry.get('ticket');
        if (!ticketController) {
          throw new Error('票务订单控制器未注册');
        }

        const label = ticketController.getLabel();
        const columns = ticketController.getColumnConfig();

        results.push({
          name: "票务订单控制器",
          passed: true,
          message: `✓ 标签：${label} | 列数：${columns.length}`,
        });
      } catch (error) {
        results.push({
          name: "票务订单控制器",
          passed: false,
          message: `错误：${error.message}`,
        });
      }

      // Test 4: 检查 getTabs 方法
      try {
        const tabs = orderRegistry.getTabs();
        if (!Array.isArray(tabs) || tabs.length === 0) {
          throw new Error('getTabs 返回空数组');
        }

        results.push({
          name: "getTabs 方法",
          passed: true,
          message: `✓ 返回 ${tabs.length} 个标签页`,
        });
      } catch (error) {
        results.push({
          name: "getTabs 方法",
          passed: false,
          message: `错误：${error.message}`,
        });
      }

      // Test 5: 检查 filterData 方法
      try {
        const physicalController = orderRegistry.get('physical');
        const mockOrders = [
          { order_number: "1", product_name: "商品 A", order_status: "pending_confirmation" },
          { order_number: "2", product_name: "商品 B", order_status: "paid" },
        ];
        const filtered = physicalController.filterData(mockOrders, {
          statusFilter: "all",
          search: "",
          userProfileMap: {},
          showArchived: false,
        });

        if (!Array.isArray(filtered) || filtered.length !== 2) {
          throw new Error(`filterData 返回错误：${filtered.length}`);
        }

        results.push({
          name: "filterData 方法",
          passed: true,
          message: `✓ 过滤功能正常`,
        });
      } catch (error) {
        results.push({
          name: "filterData 方法",
          passed: false,
          message: `错误：${error.message}`,
        });
      }

      setTestResults(results);
    };

    runTests();
  }, []);

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          订单注册中心测试
          <Badge className={passedCount === totalCount ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
            {passedCount}/{totalCount} 通过
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                result.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              }`}
            >
              {result.passed ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">{result.name}</p>
                <p className="text-xs text-gray-600 mt-1">{result.message}</p>
              </div>
            </div>
          ))}

          {testResults.length === 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-700">正在运行测试...</p>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">已注册的控制器：</h3>
          <div className="flex gap-2 flex-wrap">
            {orderRegistry.getTypes().map(type => (
              <Badge key={type} variant="outline" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}