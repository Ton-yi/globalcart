import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { mergeNavTree, DEFAULT_NAV_TREES } from "@/lib/navRegistry";
import { invalidateTenantConfigCache } from "@/lib/configCache";
import NavbarSettingsManager from "@/components/admin/NavbarSettingsManager";
import NavbarExchangeRateManager from "@/components/admin/NavbarExchangeRateManager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, RotateCcw, Navigation, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function AdminNavbarSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminTree, setAdminTree] = useState([]);
  const [userTree, setUserTree] = useState([]);
  const [settings, setSettings] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke("manageNavbarSettings", { action: "get" }),
      base44.functions.invoke("getTenantSettings", {}),
    ]).then(([navRes, settingsRes]) => {
      const s = navRes.data?.settings;
      setAdminTree(mergeNavTree(s?.admin_nav, "admin"));
      setUserTree(mergeNavTree(s?.user_nav, "user"));
      setSettings(settingsRes.data?.raw || []);
      setLoading(false);
    }).catch(() => {
      toast.error("加载导航设置失败");
      setLoading(false);
    });
  }, []);

  const handleReload = async () => {
    const settingsRes = await base44.functions.invoke("getTenantSettings", {});
    setSettings(settingsRes.data?.raw || []);
    invalidateTenantConfigCache();
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
          <NavbarExchangeRateManager settings={settings} onReload={handleReload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}