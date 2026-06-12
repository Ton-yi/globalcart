import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// 同一访问者 1 小时内重复访问不重复计数（防刷）
const VIEW_DEDUP_WINDOW_MS = 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle } = await req.json();
    if (!handle) return Response.json({ error: 'Handle is required' }, { status: 400 });

    const normalizedHandle = String(handle).toLowerCase().trim();
    const targetUsers = await base44.asServiceRole.entities.User.filter({ handle: normalizedHandle });

    // 统一返回：不存在 / 未公开 / 无权限 均为同一结果，不区分
    const notFound = () => Response.json({ error: '用户不存在或不可访问' }, { status: 404 });

    if (!targetUsers || targetUsers.length === 0) return notFound();

    const targetUser = targetUsers[0];
    if (!targetUser.public_profile_enabled) return notFound();

    const viewerRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role];
    const isViewerAdmin = viewerRoles.includes('platform_admin') || viewerRoles.includes('tenant_admin');
    const isOwner = currentUser.email === targetUser.email;
    const isSameTenant = currentUser.tenant_id === targetUser.tenant_id;

    if (!isViewerAdmin && !isOwner && !isSameTenant) return notFound();

    // ===== 展示次数统计 =====
    // 规则：本人访问不计入、管理员访问不计入、同一访问者 1 小时内去重
    if (!isOwner && !isViewerAdmin) {
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