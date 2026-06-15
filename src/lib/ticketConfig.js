/**
 * 票务模块共享常量与工具
 * 设置驱动：管理员可在后台覆盖席种预设、字段可见性、预付配置、各发券方式最低追加费。
 * 内部金额一律 JPY。
 */

// ─── 预设席种 ────────────────────────────────────────────────
export const DEFAULT_SEAT_TYPES = [
  "スタンディング", "P席", "A席", "S席", "SS席", "スペシャル",
];

// ─── 販売方法 ────────────────────────────────────────────────
export const SALES_METHODS = [
  { value: "first_come", label: "先着販売" },
  { value: "lottery", label: "抽選販売" },
  { value: "other", label: "他" },
];
export const salesMethodLabel = (v) => SALES_METHODS.find(m => m.value === v)?.label || v || "—";

// ─── 発券方式 ────────────────────────────────────────────────
export const TICKETING_METHODS = [
  { value: "paper", label: "紙チケット" },
  { value: "electronic", label: "電子チケット" },
  { value: "ticket_number", label: "発券番号" },
];
export const ticketingMethodLabel = (v) => TICKETING_METHODS.find(m => m.value === v)?.label || v || "—";

// ─── 票务订单状态：统一枚举 + 双向显示别名 ────────────────────
// 同一状态在用户端与管理员端显示不同文案。抽選販売部分状态文案也不同。
export const TICKET_STATUSES = [
  "pending_confirmation",
  "accepted",
  "awaiting_lottery_result",
  "purchased_pending_warehouse",
  "in_warehouse",
  "shipped",
  "delivered",
  "lottery_lost",
  "cancelled",
];

/**
 * 获取票务状态显示文案
 * @param {string} status 统一状态枚举
 * @param {'user'|'admin'} side 显示端
 * @param {boolean} isLottery 是否抽選販売（影响部分文案）
 */
export function ticketStatusLabel(status, side = "user", isLottery = false) {
  const map = {
    pending_confirmation: { user: "待受理", admin: "待确认" },
    accepted: {
      user: isLottery ? "待开始抽选" : "待受理",
      admin: isLottery ? "待开始抽选" : "待开票",
    },
    awaiting_lottery_result: { user: "等待抽选结果", admin: "等待抽选结果" },
    purchased_pending_warehouse: {
      user: isLottery ? "已抽中待入库" : "已购买待入库",
      admin: isLottery ? "已抽中待入库" : "已购买待入库",
    },
    in_warehouse: { user: "待发货", admin: "已入库" },
    shipped: { user: "已发货", admin: "已发货" },
    delivered: { user: "已收货", admin: "已收货" },
    lottery_lost: { user: "未中选", admin: "未中选" },
    cancelled: { user: "已取消", admin: "已取消" },
  };
  return map[status]?.[side] || status;
}

export const TICKET_STATUS_COLORS = {
  pending_confirmation: "bg-yellow-100 text-yellow-700",
  accepted: "bg-blue-100 text-blue-700",
  awaiting_lottery_result: "bg-purple-100 text-purple-700",
  purchased_pending_warehouse: "bg-teal-100 text-teal-700",
  in_warehouse: "bg-orange-100 text-orange-700",
  shipped: "bg-green-100 text-green-700",
  delivered: "bg-gray-100 text-gray-700",
  lottery_lost: "bg-gray-200 text-gray-800",
  cancelled: "bg-red-100 text-red-700",
};

// ─── 取消理由快速选取 ────────────────────────────────────────
export const TICKET_CANCEL_REASONS = ["未抽中", "未抢到"];

// ─── 可配置字段（管理员可设 必填/选填/隐藏）────────────────────
// key 对应 ticket_data 下的字段；visibility: 'required' | 'optional' | 'hidden'
export const TICKET_FIELDS = [
  { key: "prefecture", label: "都道府県" },
  { key: "performance_datetime", label: "開演日時" },
  { key: "sales_method", label: "販売方法" },
  { key: "sales_start_time", label: "販売開始時間" },
  { key: "sales_end_time", label: "販売終了時間" },
  { key: "lottery_result_time", label: "結果発表時間（抽選のみ）" },
  { key: "ticketing_method", label: "発券方式" },
  { key: "seats", label: "席種·数量·料金" },
  { key: "account_count", label: "期望账户数/抢票人数" },
  { key: "additional_fee_jpy", label: "追加料金" },
  { key: "lottery_win_bonus_jpy", label: "抽中追加报酬（抽選のみ）" },
  { key: "performance_name", label: "演出名" },
  { key: "purchase_link", label: "购买/演出信息链接" },
];

// ─── 默认票务配置（SiteSettings.ticket_order_config 的初始值）────
export const DEFAULT_TICKET_CONFIG = {
  enabled: false,
  seat_types: DEFAULT_SEAT_TYPES,
  // 字段可见性：默认全部 optional，部分核心字段 required
  field_visibility: {
    prefecture: "optional",
    performance_datetime: "optional",
    sales_method: "required",
    sales_start_time: "required",
    sales_end_time: "required",
    lottery_result_time: "optional",
    ticketing_method: "required",
    seats: "required",
    account_count: "required",
    additional_fee_jpy: "optional",
    lottery_win_bonus_jpy: "optional",
    performance_name: "optional",
    purchase_link: "optional",
  },
  // 独立预付设置（覆盖普通订单的预付配置）
  prepay_enabled: true,
  prepay_rate: 100,          // 票务默认全额预付（数量×料金×账户数）
  // 兜底服务费设置（未配置票务专用规则时使用）
  fallback_service_fee_rate: 0,   // 服务费比例（%），基于票务货款总额
  fallback_service_fee_fixed: 0,  // 固定服务费（JPY）
  // 各发券方式最低追加料金（JPY）
  min_additional_fee: { paper: 0, electronic: 0, ticket_number: 0 },
  // 抽中追加报酬最低额（JPY）
  min_lottery_win_bonus: 0,
};

/**
 * 计算票务预付总额（JPY）
 * = Σ(席种数量 × 单价) × 账户数 + 追加料金
 * 注意：抽中追加报酬（lottery_win_bonus）在抽中后才收取，不计入下单预付。
 */
export function calcTicketPrepaidTotal(ticketData) {
  const seats = ticketData?.seats || [];
  const accountCount = parseFloat(ticketData?.account_count) || 1;
  const seatTotal = seats.reduce(
    (sum, s) => sum + (parseFloat(s.quantity) || 0) * (parseFloat(s.price_jpy) || 0),
    0
  );
  const additional = parseFloat(ticketData?.additional_fee_jpy) || 0;
  return Math.round(seatTotal * accountCount + additional);
}

/**
 * 计算退差价（JPY）
 * = Σ((预付票数 − 实际票数) × 单价) × 账户数
 */
export function calcTicketRefund(ticketData) {
  const seats = ticketData?.seats || [];
  const accountCount = parseFloat(ticketData?.account_count) || 1;
  const diffTotal = seats.reduce((sum, s) => {
    const expected = parseFloat(s.quantity) || 0;
    const actual = s.actual_quantity == null ? expected : (parseFloat(s.actual_quantity) || 0);
    const diff = Math.max(0, expected - actual);
    return sum + diff * (parseFloat(s.price_jpy) || 0);
  }, 0);
  return Math.round(diffTotal * accountCount);
}