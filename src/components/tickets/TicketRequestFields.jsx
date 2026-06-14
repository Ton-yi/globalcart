import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SALES_METHODS, TICKETING_METHODS } from "@/lib/ticketConfig";
import TicketSeatRows from "./TicketSeatRows";

/**
 * 票务需求字段表单（设置驱动可见性：required/optional/hidden）
 * data: ticket_data；onChange(patch) 更新
 */
export default function TicketRequestFields({ data, onChange, config }) {
  const vis = config?.field_visibility || {};
  const show = (key) => vis[key] !== "hidden";
  const req = (key) => vis[key] === "required";
  const set = (patch) => onChange(patch);
  const isLottery = data.sales_method === "lottery";

  const L = ({ k, children }) => (
    <Label className="text-sm font-medium">{children}{req(k) && <span className="text-red-500 ml-0.5">*</span>}</Label>
  );

  return (
    <div className="space-y-4">
      {/* 公演日程 */}
      {(show("prefecture") || show("performance_datetime")) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {show("prefecture") && (
            <div>
              <L k="prefecture">都道府県</L>
              <Input className="mt-1 text-sm" placeholder="如 東京都" required={req("prefecture")}
                value={data.prefecture || ""} onChange={e => set({ prefecture: e.target.value })} />
            </div>
          )}
          {show("performance_datetime") && (
            <div>
              <L k="performance_datetime">開演日時</L>
              <Input type="datetime-local" className="mt-1 text-sm" required={req("performance_datetime")}
                value={data.performance_datetime || ""} onChange={e => set({ performance_datetime: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {/* 販売方法 */}
      {show("sales_method") && (
        <div>
          <L k="sales_method">販売方法</L>
          <Select value={data.sales_method || ""} onValueChange={v => set({ sales_method: v })}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="选择販売方法" /></SelectTrigger>
            <SelectContent>
              {SALES_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 販売時期 */}
      {(show("sales_start_time") || show("sales_end_time") || (show("lottery_result_time") && isLottery)) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {show("sales_start_time") && (
            <div>
              <L k="sales_start_time">販売開始</L>
              <Input type="datetime-local" className="mt-1 text-sm" required={req("sales_start_time")}
                value={data.sales_start_time || ""} onChange={e => set({ sales_start_time: e.target.value })} />
            </div>
          )}
          {show("sales_end_time") && (
            <div>
              <L k="sales_end_time">販売終了</L>
              <Input type="datetime-local" className="mt-1 text-sm" required={req("sales_end_time")}
                value={data.sales_end_time || ""} onChange={e => set({ sales_end_time: e.target.value })} />
            </div>
          )}
          {show("lottery_result_time") && isLottery && (
            <div>
              <L k="lottery_result_time">結果発表</L>
              <Input type="datetime-local" className="mt-1 text-sm" required={req("lottery_result_time")}
                value={data.lottery_result_time || ""} onChange={e => set({ lottery_result_time: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {/* 発券方式 */}
      {show("ticketing_method") && (
        <div>
          <L k="ticketing_method">発券方式</L>
          <Select value={data.ticketing_method || ""} onValueChange={v => set({ ticketing_method: v })}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="选择発券方式" /></SelectTrigger>
            <SelectContent>
              {TICKETING_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 席种明细 */}
      {show("seats") && (
        <TicketSeatRows seats={data.seats || []} seatPresets={config?.seat_types || []}
          required={req("seats")} onChange={seats => set({ seats })} />
      )}

      {/* 账户数 / 抢票人数 */}
      {show("account_count") && (
        <div>
          <L k="account_count">{isLottery ? "期望抽票账户数" : "期望抢票人数"}</L>
          <Input type="number" min="1" className="mt-1 text-sm w-40" required={req("account_count")}
            value={data.account_count ?? 1} onChange={e => set({ account_count: e.target.value })} />
        </div>
      )}

      {/* 追加料金 */}
      {show("additional_fee_jpy") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <L k="additional_fee_jpy">追加料金（¥，自愿提供的额外报酬）</L>
            <Input type="number" min="0" className="mt-1 text-sm" required={req("additional_fee_jpy")}
              value={data.additional_fee_jpy ?? ""} onChange={e => set({ additional_fee_jpy: e.target.value })} />
          </div>
          {show("lottery_win_bonus_jpy") && isLottery && (
            <div>
              <L k="lottery_win_bonus_jpy">抽中追加报酬（¥）</L>
              <Input type="number" min="0" className="mt-1 text-sm" required={req("lottery_win_bonus_jpy")}
                value={data.lottery_win_bonus_jpy ?? ""} onChange={e => set({ lottery_win_bonus_jpy: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {/* 演出名 / 链接 */}
      {show("performance_name") && (
        <div>
          <L k="performance_name">演出名</L>
          <Input className="mt-1 text-sm" required={req("performance_name")}
            value={data.performance_name || ""} onChange={e => set({ performance_name: e.target.value })} />
        </div>
      )}
      {show("purchase_link") && (
        <div>
          <L k="purchase_link">购买链接 / 演出信息链接</L>
          <Input className="mt-1 text-sm" required={req("purchase_link")}
            value={data.purchase_link || ""} onChange={e => set({ purchase_link: e.target.value })} />
        </div>
      )}
    </div>
  );
}