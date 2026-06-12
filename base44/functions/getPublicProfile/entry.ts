import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// 同一访问者 1 小时内重复访问不重复计数（防刷）
const VIEW_DEDUP_WINDOW_MS = 60 * 60 * 1000;

// ===== 基础防护：访问限速 + 不存在 handle 风控（内存级，按访问者邮箱） =====
const RATE_LIMIT = 30;                    // 每分钟最多 30 次资料页请求
const RATE_WINDOW_MS = 60 * 1000;
const MISS_LIMIT = 10;                    // 10 分钟内访问 10 个不存在的 handle 触发风控
const MISS_WINDOW_MS = 10 * 60 * 1000;
const MISS_BLOCK_MS = 10 * 60 * 1000;     // 触发后封锁 10 分钟（对访问者表现为统一 404）
const rateMap = new Map();
const missMap = new Map();

function checkRateLimit(email) {
  const now = Date.now();
  const rec = rateMap.get(email);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    rateMap.set(email, { count: 1, windowStart: now });
    return true;
  }
  rec.count++;
  return rec.count <= RATE_LIMIT;
}

function isMissBlocked(email) {
  const rec = missMap.get(email);
  return !!(rec && rec.blockedUntil && Date.now() < rec.blockedUntil);
}

function recordMiss(email) {
  const now = Date.now();
  const rec = missMap.get(email);
  if (!rec || now - rec.windowStart > MISS_WINDOW_MS) {
    missMap.set(email, { count: 1, windowStart: now });
    return;
  }
  rec.count++;
  if (rec.count >= MISS_LIMIT) rec.blockedUntil = now + MISS_BLOCK_MS;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 访问限速
    if (!checkRateLimit(currentUser.email)) {
      return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    const { handle } = await req.json();
    if (!handle) return Response.json({ error: 'Handle is required' }, { status: 400 });

    // 统一返回：不存在 / 未公开 / 无权限 / 被风控 均为同一结果，不区分
    const notFound = () => Response.json({ error: '用户不存在或不可访问' }, { status: 404 });

    // 风控：短时间内大量访问不存在的 handle → 暂时封锁（表现与正常未命中完全一致）
    if (isMissBlocked(currentUser.email)) return notFound();

    const normalizedHandle = String(handle).toLowerCase().trim();
    const targetUsers = await base44.asServiceRole.entities.User.filter({ handle: normalizedHandle });

    if (!targetUsers || targetUsers.length === 0) {
      recordMiss(currentUser.email);
      return notFound();
    }

    const targetUser = targetUsers[0];
    if (!targetUser.public_profile_enabled) return notFound();

    const viewerRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role];
    const isViewerAdmin = viewerRoles.includes('platform_admin') || viewerRoles.includes('tenant_admin');
    const isOwner = currentUser.email === targetUser.email;
    const isSameTenant = currentUser.tenant_id === targetUser.tenant_id;

    if (!isViewerAdmin && !isOwner && !isSameTenant) return notFound();

    // ===== 展示次数统计 =====
    // 规则：管理员访问不计入；本人访问默认不计入（可由租户设置 public_profile_count_self_views 开启）；同一访问者 1 小时内去重
    let shouldCount = !isViewerAdmin && !isOwner;
    if (!isViewerAdmin && isOwner) {
      const selfViewSettings = await base44.asServiceRole.entities.SiteSettings.filter({
        tenant_id: targetUser.tenant_id,
        key: 'public_profile_count_self_views'
      });
      shouldCount = selfViewSettings[0]?.value === 'true';
    }
    if (shouldCount) {
      const logs = await base44.asServiceRole.entities.ProfileViewLog.filter({
        profile_user_id: targetUser.id,
        viewer_email: currentUser.email
      });
      const nowIso = new Date().toISOString();

      if (logs.length === 0) {
        // 首次访问：total +1, unique +1
        await base44.asServiceRole.entities.ProfileViewLog.create({
          tenant_id: targetUser.tenant_id,
          profile_user_id: targetUser.id,
          viewer_email: currentUser.email,
          view_count: 1,
          last_counted_at: nowIso
        });
        await base44.asServiceRole.entities.User.update(targetUser.id, {
          public_profile_views_total: (targetUser.public_profile_views_total || 0) + 1,
          public_profile_views_unique: (targetUser.public_profile_views_unique || 0) + 1,
          public_profile_last_viewed_at: nowIso
        });
      } else {
        const log = logs[0];
        const lastCounted = log.last_counted_at ? new Date(log.last_counted_at).getTime() : 0;
        if (Date.now() - lastCounted > VIEW_DEDUP_WINDOW_MS) {
          await base44.asServiceRole.entities.ProfileViewLog.update(log.id, {
            view_count: (log.view_count || 0) + 1,
            last_counted_at: nowIso
          });
          await base44.asServiceRole.entities.User.update(targetUser.id, {
            public_profile_views_total: (targetUser.public_profile_views_total || 0) + 1,
            public_profile_last_viewed_at: nowIso
          });
        }
      }
    }

    // ===== 组装白名单字段（绝不返回 email / UID 之外的内部数据） =====
    const showStats = targetUser.privacy_show_stats !== false;
    const showOrders = targetUser.privacy_show_orders === true;
    const showCountry = targetUser.privacy_show_country === true;

    let stats = null;
    let recentOrders = null;

    if (showStats || showOrders) {
      const orders = await base44.asServiceRole.entities.Order.filter(
        { tenant_id: targetUser.tenant_id, user_email: targetUser.email },
        '-created_date',
        500
      );
      const validOrders = orders.filter(o => !['cancelled', 'expired'].includes(o.order_status));

      if (showStats) {
        stats = {
          totalOrders: validOrders.length,
          totalPaidJpy: validOrders.reduce((s, o) => s + (o.order_stage_payment_jpy || o.paid_amount || 0), 0),
          totalGoodsJpy: validOrders.reduce((s, o) => s + (o.estimated_jpy || 0), 0),
          totalServiceFeeJpy: validOrders.reduce((s, o) => s + (o.service_fee_amount || 0), 0),
          lastOrderDate: validOrders[0]?.created_date || null
        };
      }

      if (showOrders) {
        recentOrders = validOrders.slice(0, 10).map(o => ({
          id: o.id,
          product_name: o.product_name,
          created_date: o.created_date,
          order_status: o.order_status,
          paid_amount: o.order_stage_payment_jpy || o.paid_amount || 0
        }));
      }
    }

    let country = null;
    if (showCountry) {
      const prefs = await base44.asServiceRole.entities.UserPreference.filter({
        tenant_id: targetUser.tenant_id,
        user_email: targetUser.email
      });
      const pref = prefs[0];
      if (pref?.saved_addresses?.length) {
        const defaultAddr = pref.saved_addresses.find(a => a.id === pref.default_address_id) || pref.saved_addresses[0];
        country = defaultAddr?.country || null;
      }
    }

    return Response.json({
      handle: targetUser.handle,
      display_name: targetUser.display_name || targetUser.full_name,
      avatar_url: targetUser.avatar_url || null,
      member_tier_name: targetUser.privacy_show_role_badges !== false ? (targetUser.member_tier_name || null) : null,
      roles: targetUser.privacy_show_role_badges !== false ? (targetUser.roles || null) : null,
      created_date: targetUser.privacy_show_registered_date !== false ? targetUser.created_date : null,
      bio: targetUser.privacy_show_bio !== false ? (targetUser.public_profile_bio || null) : null,
      bio_image_url: targetUser.privacy_show_bio !== false ? (targetUser.public_profile_bio_image_url || null) : null,
      last_login_at: targetUser.privacy_show_last_login === true ? (targetUser.last_login_at || null) : null,
      country,
      stats,
      recentOrders
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});