import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { Package, Truck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, getLocale } from "@/lib/i18n";

export default function Login() {
  const { tenant } = useTenantBranding();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [locale, setLocale] = useState(getLocale());

  useEffect(() => {
    const handler = (e) => setLocale(e.detail?.locale || getLocale());
    window.addEventListener('localeChanged', handler);
    return () => window.removeEventListener('localeChanged', handler);
  }, []);

  useEffect(() => {
    // 如果已登录，直接跳转首页
    base44.auth.isAuthenticated().then(ok => {
      if (ok) window.location.href = "/";
    });
  }, []);

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.origin);
  };

  const features = [
    { icon: Package, title: t("日本代购", locale), desc: t("一站式采购，安心托付", locale) },
    { icon: Truck, title: t("国际物流", locale), desc: t("拼邮发货，节省运费", locale) },
    { icon: Shield, title: t("安全可靠", locale), desc: t("实时状态，全程透明", locale) },
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      {/* Logo & Brand */}
      <div className="text-center mb-8">
        {tenant?.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.branding_name} className="h-12 w-auto object-contain mx-auto mb-4" />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: tenant?.theme_color || '#dc2626' }}
          >
            <span className="text-white text-lg font-bold">
              {(tenant?.branding_name || "同一").slice(0, 2)}
            </span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          {tenant?.branding_name || "同一物流"}
        </h1>
        {tenant?.login_subtitle && (
          <p className="text-sm text-gray-500 mt-1">{tenant.login_subtitle}</p>
        )}
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8 w-full max-w-sm">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="text-center p-3 bg-white border border-gray-100 rounded-lg">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Icon className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-xs font-medium text-gray-800">{title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
          </div>
        ))}
      </div>

      {/* Phone & Code Inputs */}
      <div className="w-full max-w-xs space-y-3">
        {/* 手机号 */}
        <div className="flex gap-2">
          <Input
            placeholder={t("手机号", locale)}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 text-xs px-3"
            onClick={() => {}}
          >
            {t("发送验证码", locale)}
          </Button>
        </div>
        {/* 验证码 */}
        <Input
          placeholder={t("验证码", locale)}
          value={code}
          onChange={e => setCode(e.target.value)}
        />
        {/* Login Button */}
        <Button
          className="w-full bg-red-600 hover:bg-red-700 text-white h-10"
          onClick={handleLogin}
        >
          {t("登录 / 注册", locale)}
        </Button>
        {tenant?.contact_info && (
          <p className="text-center text-xs text-gray-400">{tenant.contact_info}</p>
        )}
      </div>
    </div>
  );
}