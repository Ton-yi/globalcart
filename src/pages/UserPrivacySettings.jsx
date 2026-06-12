/**
 * UserPrivacySettings — 独立隐私设置页（与个人档案页"隐私设置"Tab 共用同一组件）
 */
import PrivacySettingsTab from "@/components/profile/PrivacySettingsTab";

export default function UserPrivacySettings() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8 px-4">
      <h1 className="text-2xl font-bold">隐私设置</h1>
      <PrivacySettingsTab />
    </div>
  );
}