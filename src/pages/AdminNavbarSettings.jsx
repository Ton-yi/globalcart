import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { mergeNavTree, DEFAULT_NAV_TREES } from "@/lib/navRegistry";
import { invalidateTenantConfigCache } from "@/lib/configCache";
import NavbarSettingsManager from "@/components/admin/NavbarSettingsManager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Save, Loader2, RotateCcw, Navigation, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const ALL_CURRENCIES = [
  { code: "CNY", label: "人民币 (CNY)" },
  { code: "USD", label: "美元 (USD)" },
  { code: "EUR", label: "欧元 (EUR)" },
  { code: "TWD", label: "新台币 (TWD)" },
  { code: "HKD", label: "港币 (HKD)" },
  { code: "SGD", label: "新加坡元 (SGD)" },
  { code: "KRW", label: "韩元 (KRW)" },
  { code: "GBP", label: "英镑 (GBP)" },
  { code: "AUD", label: "澳元 (AUD)" },
  { code: "CAD", label: "加元 (CAD)" },
  { code: "THB", label: "泰铢 (THB)" },
  { code: "MYR", label: "林吉特 (MYR)" },
];

export default function AdminNavbarSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminTree, setAdminTree] = useState([]);
  const [userTree, setUserTree] = useState([]);

  // Navbar rate widget config: { enabled, currencies: [] }
  const [rateSettingId, setRateSettingId] = useState(null);
  const [rateForm, setRateForm] = useState({ enabled: false, currencies: [] });
  const [rateSaving, setRateSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke("manageNavbarSettings", { action: "get" }),
      base44.functions.invoke("getTenantSettings", {}),
    ]).then(([navRes, settingsRes]) => {
      const s = navRes.data?.settings;
      setAdminTree(mergeNavTree(s?.admin_nav, "admin"));
      setUserTree(mergeNavTree(s?.user_nav, "user"));

      const allSettings = settingsRes.data?.settings || [];
      const rateSetting = allSettings.find(s => s.key === "navbar_exchange_rate_config");
      if (rateSetting) {
        setRateSettingId(rateSetting.id);
        try { setRateForm({ enabled: false, currencies: [], ...JSON.parse(rateSetting.value) }); } catch { /* noop */ }
      }
      setLoading(false);
    }).catch((e) => {
      toast.error("加载导航设置失败");
      setLoading(false);
    });
  }, []);

  const handleRateSave = async () => {
    setRateSaving(true);
    const value = JSON.stringify(rateForm);
    try {
      if (rateSettingId) {
        await tenantEntity.update("SiteSettings", rateSettingId, { value });
      } else {
        const rec = await tenantEntity.create("SiteSettings", {
          key: "navbar_exchange_rate_config", value,
          description: "导航栏汇率显示配置（JSON）", category: "general",
        });
        setRateSettingId(rec.id);
      }
      invalidateTenantConfigCache();
      toast.success("导航栏汇率设置已保存，刷新页面后生效");
    } catch (e) {
      toast.error("保存失败");
    }
    setRateSaving(false);
  };

  const toggleRateCurrency = (code) => {
    setRateForm(prev => {
      const cur = prev.currencies || [];
      if (cur.includes(code)) return { ...prev, currencies: cur.filter(c => c !== code) };
      if (cur.length >= 4) return prev;
      return { ...prev, currencies: [...cur, code] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageNavbarSettings", {
        action: "save",
        admin_nav: adminTree,
        user_nav: userTree,
      });
      if (res.data?.success) {
        invalidateTenantConfigCache();
        toast.success("导航栏设置已保存，刷新页面后生效");
      } else {
        toast.error(res.data?.error || "保存失败");
      }
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
    setSaving(false);
  };

  const handleReset = (group) => {
    const def = JSON.parse(JSON.stringify(DEFAULT_NAV_TREES[group]));
    if (group === "admin") setAdminTree(def);
    else setUserTree(def);
    toast.info("已恢复默认布局（尚未保存）");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">导航栏布局设置</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          保存设置
        </Button>
      </div>
      <p className="text-sm text-gray-500">
        可隐藏入口、修改显示文字、调整顺序，并通过「设为上一项的子级」建立次级菜单（最多三层）。权限不足的用户仍然不会看到对应入口。
      </p>

      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="admin">管理员导航</TabsTrigger>
          <TabsTrigger value="user">普通用户导航</TabsTrigger>
          <TabsTrigger value="rate">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />导航栏汇率显示
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">管理员导航入口</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleReset("admin")}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />恢复默认
              </Button>
            </CardHeader>
            <CardContent>
              <NavbarSettingsManager group="admin" tree={adminTree} onChange={setAdminTree} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">普通用户导航入口</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleReset("user")}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />恢复默认
              </Button>
            </CardHeader>
            <CardContent>
              <NavbarSettingsManager group="user" tree={userTree} onChange={setUserTree} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  导航栏汇率显示设置
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">在导航栏中内嵌实时日元汇率小组件，最多显示 4 个币种。</p>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700" size="sm" onClick={handleRateSave} disabled={rateSaving}>
                {rateSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                保存
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 总开关 */}
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRateForm(p => ({ ...p, enabled: !p.enabled }))}>
                <Checkbox checked={!!rateForm.enabled} onCheckedChange={v => setRateForm(p => ({ ...p, enabled: !!v }))} />
                <Label className="text-sm cursor-pointer select-none">在导航栏显示汇率</Label>
              </div>

              {rateForm.enabled && (
                <div>
                  <Label className="text-xs text-gray-500 block mb-2">
                    显示币种（最多 4 个，已选 {rateForm.currencies?.length || 0}/4）
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_CURRENCIES.map(c => {
                      const checked = (rateForm.currencies || []).includes(c.code);
                      const disabled = !checked && (rateForm.currencies || []).length >= 4;
                      return (
                        <div
                          key={c.code}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                            checked ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
                            disabled ? "opacity-40 cursor-not-allowed border-gray-200" :
                            "border-gray-200 hover:border-gray-300 text-gray-700"
                          }`}
                          onClick={() => !disabled && toggleRateCurrency(c.code)}
                        >
                          <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => !disabled && toggleRateCurrency(c.code)} />
                          <span>{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-400 mb-1.5">预览效果（实际汇率实时更新）</p>
                    <div className="flex flex-wrap gap-2">
                      {(rateForm.currencies || []).map(code => (
                        <span key={code} className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                          <TrendingUp className="w-3 h-3" />
                          100¥=--{code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}