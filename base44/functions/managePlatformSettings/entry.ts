/**
 * 平台级全局设置管理（仅 platform_admin）
 * - get_exchange_settings: 读取全局汇率查询 API 与查询频率
 * - set_exchange_settings: 保存全局汇率查询 API 与查询频率
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: 仅平台管理员可访问' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;
    const pick = arr => (arr || []).find(s => !s.tenant_id || s.tenant_id === '');

    if (action === 'get_exchange_settings') {
      const [urlS, freqS, cacheS] = await Promise.all([
        base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_api_url' }),
        base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_refresh_minutes' }),
        base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_cache' }),
      ]);
      let last_fetched_at = null;
      try { last_fetched_at = JSON.parse(pick(cacheS)?.value || 'null')?.fetched_at || null; } catch { /* ignore */ }
      return Response.json({
        api_url: pick(urlS)?.value || '',
        refresh_minutes: parseFloat(pick(freqS)?.value) || 60,
        last_fetched_at,
      });
    }

    if (action === 'set_exchange_settings') {
      const apiUrl = (body.api_url || '').trim();
      if (apiUrl && !/^https:\/\//i.test(apiUrl)) {
        return Response.json({ error: 'API 地址必须以 https:// 开头' }, { status: 400 });
      }
      const refresh = Math.max(5, parseInt(body.refresh_minutes) || 60);

      const upsert = async (key, value, description) => {
        const all = await base44.asServiceRole.entities.SiteSettings.filter({ key });
        const existing = pick(all);
        if (existing) {
          await base44.asServiceRole.entities.SiteSettings.update(existing.id, { value });
        } else {
          await base44.asServiceRole.entities.SiteSettings.create({ key, value, description, category: 'general', tenant_id: '' });
        }
      };
      await upsert('exchange_rate_api_url', apiUrl, '全局汇率查询 API 地址');
      await upsert('exchange_rate_refresh_minutes', String(refresh), '全局汇率查询频率（分钟）');
      return Response.json({ success: true, api_url: apiUrl, refresh_minutes: refresh });
    }

    // 读取平台级增量设置
    if (action === 'get_platform_rate_increments') {
      const RATE_KEYS = ['jpy_usd', 'jpy_cny', 'jpy_eur', 'jpy_gbp', 'jpy_aud', 'jpy_sgd', 'jpy_hkd', 'jpy_twd'];
      const allSettings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: '' });
      const incMap = {};
      (allSettings || []).forEach(s => { incMap[s.key] = s.value; });
      const result = {};
      RATE_KEYS.forEach(k => { result[`${k}_increment`] = parseFloat(incMap[`${k}_increment`]) || 0; });
      return Response.json(result);
    }

    // 保存平台级增量设置（tenant_id = ''）
    if (action === 'set_platform_rate_increments') {
      const RATE_KEYS = ['jpy_usd', 'jpy_cny', 'jpy_eur', 'jpy_gbp', 'jpy_aud', 'jpy_sgd', 'jpy_hkd', 'jpy_twd'];
      const upsertPlatform = async (key, value, description) => {
        const all = await base44.asServiceRole.entities.SiteSettings.filter({ key });
        const existing = pick(all);
        if (existing) {
          await base44.asServiceRole.entities.SiteSettings.update(existing.id, { value: String(value) });
        } else {
          await base44.asServiceRole.entities.SiteSettings.create({ key, value: String(value), description, category: 'fee', tenant_id: '' });
        }
      };
      const updates = [];
      for (const k of RATE_KEYS) {
        const incKey = `${k}_increment`;
        if (body[incKey] !== undefined) {
          const val = parseFloat(body[incKey]) || 0;
          updates.push(upsertPlatform(incKey, val, `平台级汇率增量 ${k}`));
        }
      }
      await Promise.all(updates);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});