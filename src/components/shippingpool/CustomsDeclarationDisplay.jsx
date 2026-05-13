/**
 * CustomsDeclarationDisplay
 * Read-only display of customs declaration data for admin view.
 * Each cell value is clickable to copy.
 */
import { useState } from "react";
import { ClipboardList, Copy, Check } from "lucide-react";

const CONTENT_TYPE_LABELS = {
  gift: "礼品 (Gift)",
  merchandise: "商品 (Merchandise)",
  documents: "文件 (Documents)",
  sample: "样品 (Sample)",
  personal_effects: "个人物品 (Personal Effects)",
  other: "其他 (Other)",
};

const UNDELIVERABLE_LABELS = {
  return: "寄回",
  abandon: "放弃",
  redirect: "转送",
};

const RETURN_METHOD_LABELS = {
  air: "空运",
  economy: "最经济的路线",
};

function CopyCell({ value, className = "" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value && value !== 0) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <span
      onClick={handleCopy}
      title="点击复制"
      className={`cursor-pointer select-none inline-flex items-center gap-0.5 group rounded px-1 py-0.5 hover:bg-blue-50 transition-colors ${className}`}
    >
      <span className="font-medium text-gray-800">{value ?? "—"}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
        {copied
          ? <Check className="w-3 h-3 text-green-500" />
          : <Copy className="w-3 h-3 text-blue-400" />
        }
      </span>
    </span>
  );
}

export default function CustomsDeclarationDisplay({ orders = [] }) {
  // Collect all orders that have customs_declaration filled
  const ordersWithCustoms = orders.filter(o => {
    const cd = o.customs_declaration;
    return cd && cd.items && cd.items.some(it => it.name);
  });

  if (ordersWithCustoms.length === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-100/60 border-b border-orange-200">
        <ClipboardList className="w-3.5 h-3.5 text-orange-600" />
        <span className="text-xs font-medium text-orange-700">用户填写的报关单</span>
        <span className="text-xs text-orange-400 ml-1">（点击值即可复制）</span>
      </div>

      <div className="p-3 space-y-4">
        {ordersWithCustoms.map((order, orderIdx) => {
          const cd = order.customs_declaration;
          return (
            <div key={order.id} className="space-y-2">
              {ordersWithCustoms.length > 1 && (
                <p className="text-xs text-gray-500 font-medium truncate">
                  📦 {order.product_name || order.order_number || `订单 ${orderIdx + 1}`}
                </p>
              )}

              {/* Content type */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-20 shrink-0">内容物种类：</span>
                <CopyCell value={CONTENT_TYPE_LABELS[cd.content_type] || cd.content_type} />
              </div>

              {/* Items table */}
              {cd.items && cd.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-orange-100/50">
                        <th className="text-left px-2 py-1.5 text-gray-500 font-medium border-b border-orange-200">品名（英文）</th>
                        <th className="text-right px-2 py-1.5 text-gray-500 font-medium border-b border-orange-200">单价</th>
                        <th className="text-left px-2 py-1.5 text-gray-500 font-medium border-b border-orange-200">货币</th>
                        <th className="text-right px-2 py-1.5 text-gray-500 font-medium border-b border-orange-200">重量(g)</th>
                        <th className="text-right px-2 py-1.5 text-gray-500 font-medium border-b border-orange-200">个数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cd.items.filter(it => it.name).map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-orange-100 last:border-0">
                          <td className="px-2 py-1.5"><CopyCell value={item.name} /></td>
                          <td className="px-2 py-1.5 text-right"><CopyCell value={item.unit_price} /></td>
                          <td className="px-2 py-1.5"><CopyCell value={item.currency} /></td>
                          <td className="px-2 py-1.5 text-right"><CopyCell value={item.weight_g} /></td>
                          <td className="px-2 py-1.5 text-right"><CopyCell value={item.quantity} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Undeliverable instruction */}
              {cd.undeliverable_action && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-20 shrink-0">无法送达：</span>
                  <CopyCell value={
                    UNDELIVERABLE_LABELS[cd.undeliverable_action] || cd.undeliverable_action
                  } />
                  {cd.undeliverable_action === "return" && cd.return_method && (
                    <>
                      <span className="text-gray-400">用</span>
                      <CopyCell value={RETURN_METHOD_LABELS[cd.return_method] || cd.return_method} />
                    </>
                  )}
                </div>
              )}

              {/* Hazmat confirmed */}
              {cd.hazmat_confirmed && (
                <p className="text-xs text-green-600">✅ 用户已确认危险品声明</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}