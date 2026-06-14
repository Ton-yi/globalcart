import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Ticket } from "lucide-react";
import { DEFAULT_TICKET_CONFIG, TICKET_FIELDS, TICKETING_METHODS } from "@/lib/ticketConfig";

const VIS_OPTIONS = [
  { value: "required", label: "必填" },
  { value: "optional", label: "选填" },
  { value: "hidden", label: "隐藏" },
];

function Toggle({ enabled, onToggle, color = "bg-violet-600" }) {
  return (
    <button type="button" onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? color : "bg-gray-200"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

/**
 * 票务功能设置面板（设置驱动，存于 SiteSettings.key = 'ticket_order_config'）
 * 包含：总开关、席种预设、字段可见性、独立预付配置、各发券方式最低追加料金。
 */
export default function TicketOrderSettings({ settings, onReload }) {
  const existing = settings.find(s => s.key === "ticket_order_config");
  const [config, setConfig] = useState(DEFAULT_TICKET_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSeat, setNewSeat] = useState("");

  useEffect(() => {
    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value);
        setConfig({ ...DEFAULT_TICKET_CONFIG, ...parsed,
          field_visibility: { ...DEFAULT_TICKET_CONFIG.field_visibility, ...(parsed.field_visibility || {}) },
          min_additional_fee: { ...DEFAULT_TICKET_CONFIG.min_additional_fee, ...(parsed.min_additional_fee || {}) },
        });
      } catch { /* keep default */ }
    }
  }, [existing?.value]);

  const save = async () => {
    setSaving(true);
    try {
      const value = JSON.stringify(config);
      if (existing) {
        await tenantEntity.update("SiteSettings", existing.id, { value });
      } else {
        await tenantEntity.create("SiteSettings", {
          key: "ticket_order_config", value, description: "票务购买需求模块配置", category: "general",
        });
      }
      await onReload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const set = (patch) => setConfig(prev => ({ ...prev, ...patch }));
  const setVis = (key, v) => set({ field_visibility: { ...config.field_visibility, [key]: v } });
  const setMinFee = (m, v) => set({ min_additional_fee: { ...config.min_additional_fee, [m]: parseFloat(v) || 0 } });

  return (
    <div className="space-y-4">
      {/* 总开关 */}
      <Card className="border-violet-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-violet-500" />票务购买需求功能
            </CardTitle>
            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700" onClick={save} disabled={saving}>
              <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存全部"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">模块化功能：关闭后现有一切流程不受影响，用户端不显示票务入口。</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">开启票务购买需求功能</Label>
              <p className="text-xs text-gray-400 mt-0.5">允许用户提交演出票务代购需求，进入独立的票务订单流程</p>
            </div>
            <Toggle enabled={config.enabled} onToggle={() => set({ enabled: !config.enabled })} />
          </div>
        </CardContent>
      </Card>

      {config.enabled && (
        <>
          {/* 席种预设 */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">席种预设列表</CardTitle>
              <p className="text-xs text-gray-400 mt-1">用户下单时可从此列表快速选取席种，也可自行输入。</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(config.seat_types || []).map((st, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-xs px-2 py-1 rounded">
                    {st}
                    <button onClick={() => set({ seat_types: config.seat_types.filter((_, idx) => idx !== i) })}>
                      <Trash2 className="w-3 h-3 text-violet-400 hover:text-red-500" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input className="h-8 text-sm" placeholder="新增席种名称" value={newSeat}
                  onChange={e => setNewSeat(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newSeat.trim()) { set({ seat_types: [...(config.seat_types || []), newSeat.trim()] }); setNewSeat(""); } }} />
                <Button size="sm" variant="outline" className="h-8 text-xs"
                  onClick={() => { if (newSeat.trim()) { set({ seat_types: [...(config.seat_types || []), newSeat.trim()] }); setNewSeat(""); } }}>
                  <Plus className="w-3 h-3 mr-1" />添加
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 字段可见性 */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">字段可见性</CardTitle>
              <p className="text-xs text-gray-400 mt-1">为票的每个属性设置 必填 / 选填 / 隐藏。</p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {TICKET_FIELDS.map(f => (
                <div key={f.key} className="flex items-center justify-between py-1">
                  <Label className="text-sm text-gray-600">{f.label}</Label>
                  <Select value={config.field_visibility?.[f.key] || "optional"} onValueChange={v => setVis(f.key, v)}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VIS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 独立预付配置 */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">票务预付与汇率设置</CardTitle>
              <p className="text-xs text-gray-400 mt-1">票务订单独立于普通订单的预付配置。预付金额 = 数量 × 料金 × 账户数 × 预付比例。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">开启票务预付款</Label>
                <Toggle enabled={config.prepay_enabled} onToggle={() => set({ prepay_enabled: !config.prepay_enabled })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">预付比例（%）</Label>
                  <Input type="number" className="mt-1 h-8 text-sm" value={config.prepay_rate}
                    onChange={e => set({ prepay_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">JPY→CNY 汇率增益</Label>
                  <Input type="number" step="0.0001" className="mt-1 h-8 text-sm" value={config.jpy_cny_increment}
                    onChange={e => set({ jpy_cny_increment: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">JPY→USD 汇率增益</Label>
                  <Input type="number" step="0.0001" className="mt-1 h-8 text-sm" value={config.jpy_usd_increment}
                    onChange={e => set({ jpy_usd_increment: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 最低追加料金 */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">追加料金最低额（JPY）</CardTitle>
              <p className="text-xs text-gray-400 mt-1">用户自行输入预期追加报酬，但不得低于以下设定值。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {TICKETING_METHODS.map(m => (
                  <div key={m.value}>
                    <Label className="text-xs text-gray-500">{m.label}</Label>
                    <Input type="number" className="mt-1 h-8 text-sm"
                      value={config.min_additional_fee?.[m.value] ?? ""}
                      onChange={e => setMinFee(m.value, e.target.value)} />
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-xs text-gray-500">抽中追加报酬最低额（抽選販売）</Label>
                <Input type="number" className="mt-1 h-8 text-sm w-40"
                  value={config.min_lottery_win_bonus ?? 0}
                  onChange={e => set({ min_lottery_win_bonus: parseFloat(e.target.value) || 0 })} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}