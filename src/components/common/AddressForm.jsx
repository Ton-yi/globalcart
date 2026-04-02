/**
 * AddressForm - 标准化收货信息填写表单
 * 字段规范：
 *   受取人お名前（收件人名）         recipient_name  必填
 *   受取人国名（收件国家）           country         必填
 *   住所1 部屋番号、マンション名（房间号码，公寓名）  addr1   必填
 *   住所2 ○番－○号 町名、○丁目（详细地址）         addr2   必填
 *   住所3 区市町村名（市，区）                       addr3   非必填
 *   州名など（省等）                 state           必填
 *   連絡先電話番号（联系方式）        phone           必填
 *
 * Props:
 *   value: { recipient_name, country, addr1, addr2, addr3, state, phone }
 *   onChange: (updatedValue) => void
 *   className?: string
 */
import CountrySelect from "@/components/common/CountrySelect";
import { Input } from "@/components/ui/input";
import { getCountryCallingCode } from "@/lib/countries";

function FieldLabel({ jp, zh, required = true }) {
  return (
    <label className="block mb-1">
      <span className="text-xs font-semibold text-gray-700">{jp}</span>
      <span className="text-xs text-gray-400 ml-1">（{zh}）</span>
      {!required && <span className="text-xs text-gray-300 ml-1">任意</span>}
    </label>
  );
}

export const EMPTY_ADDRESS_FORM = {
  recipient_name: "",
  country: "",
  addr1: "",
  addr2: "",
  addr3: "",
  state: "",
  phone: "",
};

/**
 * Serialize structured address fields into a readable full_text string for display/storage.
 */
export function serializeAddressToText(v) {
  return [
    v.recipient_name,
    v.phone,
    v.country,
    v.state,
    v.addr3,
    v.addr2,
    v.addr1,
  ].filter(Boolean).join("\n");
}

/**
 * Check if all required fields are filled.
 */
export function isAddressFormValid(v) {
  return !!(v.recipient_name?.trim() && v.country?.trim() && v.addr1?.trim() && v.addr2?.trim() && v.state?.trim() && v.phone?.trim());
}

export default function AddressForm({ value, onChange, className = "" }) {
  const f = (k, v) => onChange({ ...value, [k]: v });
  
  const handleCountryChange = (countryCode) => {
    f("country", countryCode);
    // Auto-fill phone with country calling code if phone is empty
    if (!value.phone || !value.phone.trim()) {
      const callingCode = getCountryCallingCode(countryCode);
      f("phone", callingCode);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 受取人お名前 */}
      <div>
        <FieldLabel jp="受取人お名前" zh="收件人名" required />
        <Input
          className="h-8 text-sm bg-white"
          placeholder="例：山田 太郎 / 张三"
          value={value.recipient_name || ""}
          onChange={e => f("recipient_name", e.target.value)}
        />
      </div>

      {/* 受取人国名 */}
      <div>
        <FieldLabel jp="受取人国名" zh="收件国家" required />
        <CountrySelect
          value={value.country || ""}
          onChange={handleCountryChange}
          placeholder="选择国家"
          className=""
        />
      </div>

      {/* 住所1 */}
      <div>
        <FieldLabel jp="住所1　部屋番号、マンション名" zh="房间号码，公寓名" required />
        <Input
          className="h-8 text-sm bg-white"
          placeholder="例：201号室、グリーンマンション"
          value={value.addr1 || ""}
          onChange={e => f("addr1", e.target.value)}
        />
      </div>

      {/* 住所2 */}
      <div>
        <FieldLabel jp="住所2　○番－○号　町名、○丁目" zh="详细地址" required />
        <Input
          className="h-8 text-sm bg-white"
          placeholder="例：1番2号 渋谷1丁目 / 建国路88号"
          value={value.addr2 || ""}
          onChange={e => f("addr2", e.target.value)}
        />
      </div>

      {/* 住所3 */}
      <div>
        <FieldLabel jp="住所3　区市町村名" zh="市，区" required={false} />
        <Input
          className="h-8 text-sm bg-white"
          placeholder="例：渋谷区 / 朝阳区（可不填）"
          value={value.addr3 || ""}
          onChange={e => f("addr3", e.target.value)}
        />
      </div>

      {/* 州名など */}
      <div>
        <FieldLabel jp="州名など" zh="省等" required />
        <Input
          className="h-8 text-sm bg-white"
          placeholder="例：東京都 / 北京市 / California"
          value={value.state || ""}
          onChange={e => f("state", e.target.value)}
        />
      </div>

      {/* 連絡先電話番号 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <FieldLabel jp="連絡先電話番号" zh="联系方式" required />
          {value.country && value.phone && value.phone.startsWith(getCountryCallingCode(value.country)) && (
            <span className="text-xs text-green-600 font-medium">✓ 已自动添加国码</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {value.country && (
            <span className="text-sm font-mono font-medium text-gray-600 px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex-shrink-0">
              {getCountryCallingCode(value.country)}
            </span>
          )}
          <Input
            className="h-8 text-sm bg-white flex-1"
            placeholder={value.country ? "请输入电话号码" : "例：138 0000 0000"}
            value={value.phone || ""}
            onChange={e => f("phone", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}