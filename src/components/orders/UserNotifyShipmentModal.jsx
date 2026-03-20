/**
 * UserNotifyShipmentModal
 * Supports single or multiple orders.
 * Includes natural-language combined shipping (拼邮) configuration.
 */
import { useState, useEffect } from "react";
import { X, Truck, Package, MapPin, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const SHIPPING_METHODS = [
  { value: "EMS", label: "EMS" },
  { value: "surface", label: "海运" },
  { value: "small_packet_air", label: "小型包装物空运" },
];

const TIMEOUT_ACTIONS = [
  { value: "ship_individually", label: "单独发货" },
  { value: "next_consolidation", label: "加入下一次最快发出的拼邮" },
  { value: "return_to_storage", label: "退回仓库暂存" },
];

// Clamp a date string to 4-digit year
function clampYear(dateStr) {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts[0] && parts[0].length > 4) {
    parts[0] = parts[0].slice(0, 4);
    return parts.join("-");
  }
  return dateStr;
}

// Inline editable token
function Token({ value, onChange, type = "text", options, placeholder, suffix }) {
  if (options) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-blue-400 rounded-none bg-blue-50 text-blue-700 font-medium text-sm px-2 w-auto min-w-[80px] focus:ring-0 focus:border-blue-600">
          <SelectValue placeholder={placeholder || "选择"} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (type === "date") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <input
          type="date"
          value={value || ""}
          onChange={e => onChange(clampYear(e.target.value))}
          className="inline-block border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-1 rounded-none focus:outline-none focus:border-blue-600"
          style={{ width: "130px" }}
        />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="inline-block border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-1 rounded-none focus:outline-none focus:border-blue-600 w-auto min-w-[60px]"
        style={{ width: `${Math.max((value?.length || placeholder?.length || 4) + 2, 6)}ch` }}
      />
      {suffix && <span className="text-gray-500 text-sm">{suffix}</span>}
    </span>
  );
}

// Deadline token that shows "任何时候" until clicked
function DeadlineToken({ value, onChange }) {
  const [editing, setEditing] = useState(false);

  if (!editing && !value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-0.5 border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-2 h-7 rounded-none hover:bg-blue-100"
      >
        任何时候
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="date"
        value={value || ""}
        onChange={e => onChange(clampYear(e.target.value))}
        autoFocus={editing}
        className="inline-block border-0 border-b-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-medium text-sm px-1 rounded-none focus:outline-none focus:border-blue-600"
        style={{ width: "140px" }}
      />
      {value && (
        <button type="button" onClick={() => { onChange(""); setEditing(false); }}
          className="text-blue-400 hover:text-blue-600 text-xs">×</button>
      )}
    </span>
  );
}

export default function UserNotifyShipmentModal({ order, orders, onClose, onSuccess }) {
  const targetOrders = orders || (order ? [order] : []);
  const isMulti = targetOrders.length > 1;

  const [method, setMethod] = useState(targetOrders[0]?.shipping_method || "");
  const [consolidation, setConsolidation] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [minWeight, setMinWeight] = useState("2000");
  const [consMethod, setConsMethod] = useState(""); // consolidation-specific method (optional)
  const [consMethodFallback, setConsMethodFallback] = useState(""); // secondary method fallback
  const [timeoutAction, setTimeoutAction] = useState("ship_individually");
  const [timeoutMethod, setTimeoutMethod] = useState(""); // if timeout=ship_individually, which method
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState("");

  useEffect(() => {
    base44.auth.me().then(async u => {
      const prefs = await base44.entities.UserPreference.filter({ user_email: u.email });
      if (prefs.length > 0 && prefs[0].saved_addresses) {
        setSavedAddresses(prefs[0].saved_addresses);
      }
    }).catch(() => {});
  }, []);

  const handleAddressSelect = (val) => {
    setSelectedAddress(val);
    if (val) {
      const addr = savedAddresses.find(a => a.id === val);
      if (addr) setNote(addr.full_text || "");
    }
  };

  const hasConsolidationConditions = consolidation && (deadline || minWeight);

  const handleSubmit = async () => {
    if (!method) return;
    setSubmitting(true);

    // Effective method for consolidation: consMethod if set, else method
    const effectiveConsMethod = consMethod || method;

    const updates = {
      shipping_method: method,
      consolidation_requested: consolidation,
      order_status: "notified_shipment",
      ...(consolidation && deadline ? { consolidation_deadline: deadline } : {}),
      ...(consolidation && minWeight ? { consolidation_min_weight_g: parseFloat(minWeight) } : {}),
      ...(hasConsolidationConditions ? { consolidation_timeout_action: timeoutAction } : {}),
    };

    await Promise.all(
      targetOrders.map(o =>
        base44.entities.Order.update(o.id, {
          ...updates,
          user_note: [o.user_note, note ? `发货备注：${note}` : ""].filter(Boolean).join("\n"),
        })
      )
    );
    onSuccess?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">通知发货</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isMulti
                ? `已选择 ${targetOrders.length} 个订单`
                : targetOrders[0]?.product_name}
            </p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Multi-order list */}
          {isMulti && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 max-h-28 overflow-y-auto">
              {targetOrders.map(o => (
                <div key={o.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{o.product_name}</span>
                  <span className="text-gray-400 flex-shrink-0">{o.weight_g || 100}g</span>
                </div>
              ))}
            </div>
          )}

          {/* Shipping method */}
          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">发货方式</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="请选择发货方式" /></SelectTrigger>
              <SelectContent>
                {SHIPPING_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Consolidation toggle */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
            <Checkbox
              checked={consolidation}
              onCheckedChange={setConsolidation}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">申请拼邮</div>
              <p className="text-xs text-gray-400 mt-0.5">与其他用户合并发货，可降低运费</p>
            </div>
          </label>

          {/* Natural-language consolidation config */}
          {consolidation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">拼邮配置</p>

              {/* Deadline sentence */}
              <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                <span>在</span>
                <DeadlineToken value={deadline} onChange={setDeadline} />
                <span>前拼邮发出，</span>
              </div>

              {/* Shipping method - always show "任何运输方式" as default */}
              <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                <span>使用</span>
                <Select value={consMethod} onValueChange={v => { setConsMethod(v); setConsMethodFallback(""); }}>
                  <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-blue-400 rounded-none bg-blue-50 text-blue-700 font-medium text-sm px-2 w-auto min-w-[120px] focus:ring-0 focus:border-blue-600">
                    <SelectValue placeholder="任何运输方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">任何运输方式</SelectItem>
                    {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Only show "or [method]" if a specific method was chosen */}
                {consMethod && consMethod !== "any" && (
                  <>
                    <span className="text-gray-400">或</span>
                    <Select value={consMethodFallback} onValueChange={setConsMethodFallback}>
                      <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-gray-300 rounded-none bg-gray-50 text-gray-500 font-medium text-sm px-2 w-auto min-w-[100px] focus:ring-0">
                        <SelectValue placeholder="可留空" />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIPPING_METHODS.filter(m => m.value !== consMethod).map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <span>，</span>
              </div>

              {/* Min weight */}
              <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                <span>凑满</span>
                <Token
                  type="number"
                  value={minWeight}
                  onChange={setMinWeight}
                  placeholder="2000"
                  suffix="g"
                />
                <span>时发货。</span>
              </div>

              {/* Timeout condition */}
              {hasConsolidationConditions && (
                <div className="space-y-2 pt-1 border-t border-blue-100">
                  <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5">
                    <span className="text-gray-500">若条件未达成，则</span>
                    <Token
                      value={timeoutAction}
                      onChange={setTimeoutAction}
                      options={TIMEOUT_ACTIONS}
                    />
                    <span>。</span>
                  </div>
                  {/* If "单独发货" is selected, show method picker */}
                  {timeoutAction === "ship_individually" && (
                    <div className="text-sm text-gray-700 leading-8 flex flex-wrap items-center gap-x-1.5 pl-2">
                      <span className="text-gray-500">单独发货方式：</span>
                      <Select value={timeoutMethod} onValueChange={setTimeoutMethod}>
                        <SelectTrigger className="inline-flex h-7 border-0 border-b-2 border-dashed border-blue-400 rounded-none bg-blue-50 text-blue-700 font-medium text-sm px-2 w-auto min-w-[120px] focus:ring-0">
                          <SelectValue placeholder="请选择" />
                        </SelectTrigger>
                        <SelectContent>
                          {SHIPPING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Saved address picker */}
          {savedAddresses.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />收货地址
              </label>
              <Select value={selectedAddress} onValueChange={handleAddressSelect}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="选择已保存的收货地址（可选）" />
                </SelectTrigger>
                <SelectContent>
                  {savedAddresses.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">备注 / 收货地址（可选）</label>
            <Textarea
              rows={3}
              placeholder="收件地址或特殊要求..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleSubmit}
            disabled={!method || submitting}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "提交中..." : isMulti ? `确认通知发货 (${targetOrders.length})` : "确认通知发货"}
          </Button>
        </div>
      </div>
    </div>
  );
}