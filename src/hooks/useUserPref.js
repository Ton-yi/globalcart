/**
 * useUserPref — 当前用户 UserPreference 记录的共享加载/保存 hook
 * 供个人档案页各设置模块（联系方式/地址管理/偏好设置）独立读写自己的字段切片
 */
import { useState, useEffect, useCallback } from "react";
import { userPrefApi } from "@/lib/tenantApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function useUserPref() {
  const { user } = useCurrentUser();
  const [pref, setPref] = useState(null);     // 主记录（最近更新）
  const [prefs, setPrefs] = useState([]);     // 全部记录（用于地址合并去重）
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    userPrefApi.list({ user_email: user.email }).then(rows => {
      const sorted = [...(rows || [])].sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
      setPrefs(sorted);
      setPref(sorted[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.email]);

  const savePref = useCallback(async (data) => {
    const payload = { ...data, user_email: user.email };
    if (pref) {
      await userPrefApi.update(pref.id, payload);
      setPref(p => ({ ...p, ...payload }));
    } else {
      const created = await userPrefApi.create(payload);
      setPref(created);
    }
  }, [pref, user?.email]);

  return { user, pref, prefs, loading, savePref };
}