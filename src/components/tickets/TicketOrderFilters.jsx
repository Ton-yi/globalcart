/**
 * TicketOrderFilters
 * 票务订单筛选组件
 */
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import DateRangeFilter from "@/components/orders/DateRangeFilter";

export default function TicketOrderFilters({
  filters,
  onFilterChange,
  onClearFilters,
}) {
  const {
    search,
    statusFilter,
    orderAmountFilter,
    customOrderAmount,
    salesMethodFilter,
    ticketingMethodFilter,
    performanceDateRange,
    salesStartDateRange,
    salesEndDateRange,
    submitDateRange,
    lotteryResultDateRange,
    additionalFeeFilter,
    customAdditionalFee,
    lotteryBonusFilter,
    customLotteryBonus,
  } = filters;

  const hasActiveFilters = 
    statusFilter !== "all" ||
    search ||
    orderAmountFilter !== "all" ||
    salesMethodFilter !== "all" ||
    ticketingMethodFilter !== "all" ||
    performanceDateRange ||
    salesStartDateRange ||
    salesEndDateRange ||
    submitDateRange ||
    lotteryResultDateRange ||
    additionalFeeFilter !== "all" ||
    lotteryBonusFilter !== "all";

  return (
    <div className="flex flex-wrap gap-2 items-center w-full">
      {/* 搜索框 - 灵活适配 */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input 
          placeholder="搜索订单/演出/用户..." 
          className="pl-8 h-8 text-sm w-full"
          value={search} 
          onChange={e => onFilterChange('search', e.target.value)} 
        />
      </div>

      {/* 订单状态 - 固定宽度 */}
      <Select value={statusFilter} onValueChange={v => onFilterChange('statusFilter', v)}>
        <SelectTrigger className="w-36 h-8 text-xs shrink-0">
          <SelectValue placeholder="所有状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">所有状态</SelectItem>
          <SelectItem value="pending_confirmation">待确认</SelectItem>
          <SelectItem value="accepted">已受理</SelectItem>
          <SelectItem value="awaiting_lottery_result">待抽选结果</SelectItem>
          <SelectItem value="purchased_pending_warehouse">已购买待入库</SelectItem>
          <SelectItem value="in_warehouse">已入库</SelectItem>
          <SelectItem value="shipped">已发货</SelectItem>
          <SelectItem value="delivered">已收货</SelectItem>
          <SelectItem value="cancelled">已取消</SelectItem>
        </SelectContent>
      </Select>

      {/* 订单金额 - 固定宽度 */}
      <Select value={orderAmountFilter} onValueChange={v => onFilterChange('orderAmountFilter', v)}>
        <SelectTrigger className="w-32 h-8 text-xs shrink-0">
          <SelectValue placeholder="订单金额" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">订单金额</SelectItem>
          <SelectItem value="0-5000">0–5,000</SelectItem>
          <SelectItem value="5000-10000">5,000–10,000</SelectItem>
          <SelectItem value="10000-50000">10,000–50,000</SelectItem>
          <SelectItem value="50000+">50,000+</SelectItem>
          <SelectItem value="custom">自定义</SelectItem>
        </SelectContent>
      </Select>

      {orderAmountFilter === "custom" && (
        <>
          <Input
            type="number"
            placeholder="最小"
            className="w-24 h-8 text-xs shrink-0"
            value={customOrderAmount.min}
            onChange={e => onFilterChange('customOrderAmount', { ...customOrderAmount, min: e.target.value })}
          />
          <Input
            type="number"
            placeholder="最大"
            className="w-24 h-8 text-xs shrink-0"
            value={customOrderAmount.max}
            onChange={e => onFilterChange('customOrderAmount', { ...customOrderAmount, max: e.target.value })}
          />
        </>
      )}

      {/* 销售方式 - 固定宽度 */}
      <Select value={salesMethodFilter} onValueChange={v => onFilterChange('salesMethodFilter', v)}>
        <SelectTrigger className="w-28 h-8 text-xs shrink-0">
          <SelectValue placeholder="销售方式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">销售方式</SelectItem>
          <SelectItem value="first_come">先着</SelectItem>
          <SelectItem value="lottery">抽选</SelectItem>
          <SelectItem value="other">其它</SelectItem>
        </SelectContent>
      </Select>

      {/* 发券方式 - 固定宽度 */}
      <Select value={ticketingMethodFilter} onValueChange={v => onFilterChange('ticketingMethodFilter', v)}>
        <SelectTrigger className="w-28 h-8 text-xs shrink-0">
          <SelectValue placeholder="发券方式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">发券方式</SelectItem>
          <SelectItem value="paper">纸质票</SelectItem>
          <SelectItem value="electronic">电子票</SelectItem>
          <SelectItem value="ticket_number">票号</SelectItem>
        </SelectContent>
      </Select>

      {/* 開演日 - 固定宽度 */}
      <div className="shrink-0">
        <DateRangeFilter 
          value={performanceDateRange} 
          onChange={v => onFilterChange('performanceDateRange', v)}
          label="開演日"
        />
      </div>

      {/* 販売開始日 - 固定宽度 */}
      <div className="shrink-0">
        <DateRangeFilter 
          value={salesStartDateRange} 
          onChange={v => onFilterChange('salesStartDateRange', v)}
          label="販売開始日"
        />
      </div>

      {/* 販売終了日 - 固定宽度 */}
      <div className="shrink-0">
        <DateRangeFilter 
          value={salesEndDateRange} 
          onChange={v => onFilterChange('salesEndDateRange', v)}
          label="販売終了日"
        />
      </div>

      {/* 订单提交日 - 固定宽度 */}
      <div className="shrink-0">
        <DateRangeFilter 
          value={submitDateRange} 
          onChange={v => onFilterChange('submitDateRange', v)}
          label="订单提交日"
        />
      </div>

      {/* 結果発表日 - 固定宽度 */}
      <div className="shrink-0">
        <DateRangeFilter 
          value={lotteryResultDateRange} 
          onChange={v => onFilterChange('lotteryResultDateRange', v)}
          label="結果発表日"
        />
      </div>

      {/* 用户追加料金 - 固定宽度 */}
      <Select value={additionalFeeFilter} onValueChange={v => onFilterChange('additionalFeeFilter', v)}>
        <SelectTrigger className="w-32 h-8 text-xs shrink-0">
          <SelectValue placeholder="追加料金" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">追加料金</SelectItem>
          <SelectItem value="0-1000">0–1,000</SelectItem>
          <SelectItem value="1000-3000">1,000–3,000</SelectItem>
          <SelectItem value="3000-10000">3,000–10,000</SelectItem>
          <SelectItem value="10000+">10,000+</SelectItem>
          <SelectItem value="custom">自定义</SelectItem>
        </SelectContent>
      </Select>

      {additionalFeeFilter === "custom" && (
        <>
          <Input
            type="number"
            placeholder="最小"
            className="w-24 h-8 text-xs shrink-0"
            value={customAdditionalFee.min}
            onChange={e => onFilterChange('customAdditionalFee', { ...customAdditionalFee, min: e.target.value })}
          />
          <Input
            type="number"
            placeholder="最大"
            className="w-24 h-8 text-xs shrink-0"
            value={customAdditionalFee.max}
            onChange={e => onFilterChange('customAdditionalFee', { ...customAdditionalFee, max: e.target.value })}
          />
        </>
      )}

      {/* 抽中追加报酬 - 固定宽度 */}
      <Select value={lotteryBonusFilter} onValueChange={v => onFilterChange('lotteryBonusFilter', v)}>
        <SelectTrigger className="w-32 h-8 text-xs shrink-0">
          <SelectValue placeholder="抽中追加报酬" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">抽中追加报酬</SelectItem>
          <SelectItem value="0-1000">0–1,000</SelectItem>
          <SelectItem value="1000-3000">1,000–3,000</SelectItem>
          <SelectItem value="3000-10000">3,000–10,000</SelectItem>
          <SelectItem value="10000+">10,000+</SelectItem>
          <SelectItem value="custom">自定义</SelectItem>
        </SelectContent>
      </Select>

      {lotteryBonusFilter === "custom" && (
        <>
          <Input
            type="number"
            placeholder="最小"
            className="w-24 h-8 text-xs shrink-0"
            value={customLotteryBonus.min}
            onChange={e => onFilterChange('customLotteryBonus', { ...customLotteryBonus, min: e.target.value })}
          />
          <Input
            type="number"
            placeholder="最大"
            className="w-24 h-8 text-xs shrink-0"
            value={customLotteryBonus.max}
            onChange={e => onFilterChange('customLotteryBonus', { ...customLotteryBonus, max: e.target.value })}
          />
        </>
      )}

      {/* 清除筛选 */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 h-8 px-1 shrink-0"
        >
          <X className="w-3 h-3" />清除
        </button>
      )}
    </div>
  );
}