import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle } from "lucide-react";
import { SALES_METHODS, TICKETING_METHODS } from "@/lib/ticketConfig";
import TicketSeatRows from "./TicketSeatRows";
import RichTextInput from "@/components/common/RichTextInput";

/**
 * 票务需求字段表单（设置驱动可见性：required/optional/hidden）
 * data: ticket_data；onChange(patch) 更新
 * timeErrors: { sales_start_time, sales_end_time, lottery_result_time, performance_datetime } 时间校验错误
 */
export default function TicketRequestFields({ data, onChange, config, timeErrors = {} }) {
  const vis = config?.field_visibility || {};
  const show = (key) => vis[key] !== "hidden";
  const req = (key) => vis[key] === "required";
  const set = (patch) => onChange(patch);
  const isLottery = data.sales_method === "lottery";

  // 最小时间：当前时间（精确到分钟，step=900s 即15min）
  const nowMin = (() => {
    const d = new Date();
    // round up to next 15-min slot
    const ms = 15 * 60 * 1000;
    const rounded = new Date(Math.ceil(d.getTime() / ms) * ms);
    return rounded.toISOString().slice(0, 16);
  })();

  const L = ({ k, children }) => (
    <Label className="text-sm font-medium">{children}{req(k) && <span className="text-red-500 ml-0.5">*</span>}</Label>
  );

  const DateField = ({ fieldKey, label, value, minOverride }) => {
    const error = timeErrors[fieldKey];
    return (
      <div>
        <L k={fieldKey}>{label}</L>
        <Input
          type="datetime-local"
          step={900}
          className={`mt-1 text-sm ${error ? "border-red-400 focus:ring-red-400" : ""}`}
          required={req(fieldKey)}
          min={minOverride || nowMin}
          value={value || ""}
          onChange={e => set({ [fieldKey]: e.target.value })}
        />
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 演出名（最上方） */}
      {show("performance_name") && (
        <div>
          <L k="performance_name">演出名</L>
          <Input className="mt-1 text-sm" required={req("performance_name")}
            placeholder="演出名称"
            value={data.performance_name || ""} onChange={e => set({ performance_name: e.target.value })} />
        </div>
      )}

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
            <DateField
              fieldKey="performance_datetime"
              label="開演日時"
              value={data.performance_datetime}
            />
          )}
        </div>
      )}

      {/* 販売方法 + 発券方式 同行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>

      {/* 販売時期 */}
      {(show("sales_start_time") || show("sales_end_time") || (show("lottery_result_time") && isLottery)) && (
        <div className={`grid grid-cols-1 gap-3 ${(show("lottery_result_time") && isLottery) ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {show("sales_start_time") && (
            <DateField
              fieldKey="sales_start_time"
              label={isLottery ? "抽選開始" : "販売開始"}
              value={data.sales_start_time}
            />
          )}
          {show("sales_end_time") && (
            <DateField
              fieldKey="sales_end_time"
              label={isLottery ? "抽選終了" : "販売終了"}
              value={data.sales_end_time}
              minOverride={data.sales_start_time || nowMin}
            />
          )}
          {show("lottery_result_time") && isLottery && (
            <DateField
              fieldKey="lottery_result_time"
              label="結果発表"
              value={data.lottery_result_time}
              minOverride={data.sales_end_time || data.sales_start_time || nowMin}
            />
          )}
        </div>
      )}

      {/* 席种明细 + 账户数/抢票人数（标题行内联） */}
      {show("seats") && (
        <TicketSeatRows
          seats={data.seats || []}
          seatPresets={config?.seat_types || []}
          required={req("seats")}
          onChange={seats => set({ seats })}
          accountCount={data.account_count ?? 1}
          onAccountCountChange={show("account_count") ? (v) => set({ account_count: v }) : null}
          isLottery={isLottery}
          showAccountCount={show("account_count")}
        />
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

      {/* 演出信息链接（RichTextInput，图片作为商品图） */}
      {show("purchase_link") && (
        <div>
          <L k="purchase_link">购买链接 / 演出信息链接</L>
          <div className="mt-1">
            <RichTextInput
              value={data.purchase_link || ""}
              onChange={(text) => set({ purchase_link: text })}
              imageUrls={data.product_image_url ? [data.product_image_url] : []}
              onImageUrls={(urls) => set({ product_image_url: urls[0] || null })}
              placeholder="填写购买链接或演出信息链接，可上传演出海报图片"
              maxImages={1}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}