/**
 * Shared constants for shipping pool / notify shipment forms.
 *
 * IMPORTANT: Both UserNotifyShipmentModal and CreateShippingPoolModal (Step 2)
 * use these constants. Any changes here are automatically reflected in both.
 * Do NOT duplicate these lists inside those files.
 */

export const SHIPPING_METHODS = [
  { value: "EMS", label: "EMS空运" },
  { value: "surface", label: "海运" },
  { value: "small_packet_air", label: "小型包装物空运" },
];

export const CONSOLIDATION_TIMEOUT_ACTIONS = [
  { value: "ship_individually", label: "单独发货" },
  { value: "next_consolidation", label: "加入下一次最快发出的拼邮" },
  { value: "return_to_storage", label: "退回仓库暂存" },
];