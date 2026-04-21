/**
 * manageCreditApplication
 * Actions:
 *   - apply: user submits a new credit application (apply or adjust)
 *   - list: admin lists all pending applications for tenant
 *   - review: admin approves or rejects an application
 *   - get_user_credit: get current user's credit status
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    const emailHint = extractEmailFromJwt(req);
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const userRecord = userRecords[0];
    const tenantId = userRecord.tenant_id;

    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';

    // === USER: submit application ===
    if (action === 'apply') {
      const { application_type, requested_cycle, requested_limit_jpy, reason } = body;
      if (!application_type || !requested_cycle) {
        return Response.json({ error: '申请类型和结帐周期为必填项' }, { status: 400 });
      }

      // Check for existing pending application
      const existing = await base44.asServiceRole.entities.CreditApplication.filter({
        user_email: user.email,
        status: 'pending'
      });
      if (existing.length > 0) {
        return Response.json({ error: '您已有待审核的申请，请等待管理员处理后再提交新申请' }, { status: 400 });
      }

      const application = await base44.asServiceRole.entities.CreditApplication.create({
        tenant_id: tenantId,
        user_email: user.email,
        user_name: user.full_name || user.display_name || user.email,
        application_type,
        requested_cycle,
        requested_limit_jpy: parseFloat(requested_limit_jpy) || 0,
        reason: reason || '',
        status: 'pending',
      });

      return Response.json({ application });
    }

    // === ADMIN: list applications ===
    if (action === 'list') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const filter = user.role === 'platform_admin' ? {} : { tenant_id: tenantId };
      const applications = await base44.asServiceRole.entities.CreditApplication.filter(filter);
      // Sort by created_date desc
      applications.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      return Response.json({ applications });
    }

    // === ADMIN: review (approve / reject) ===
    if (action === 'review') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const { application_id, decision, admin_note, override_limit_jpy, override_cycle } = body;
      if (!application_id || !decision) {
        return Response.json({ error: 'application_id and decision required' }, { status: 400 });
      }

      const apps = await base44.asServiceRole.entities.CreditApplication.filter({ id: application_id });
      if (!apps || apps.length === 0) return Response.json({ error: 'Application not found' }, { status: 404 });
      const app = apps[0];

      // Update application status
      const reviewedAt = new Date().toISOString();
      await base44.asServiceRole.entities.CreditApplication.update(application_id, {
        status: decision,
        admin_note: admin_note || '',
        reviewed_by: user.email,
        reviewed_at: reviewedAt,
      });

      // If approved, update the user's credit settings
      if (decision === 'approved') {
        const targetUsers = await base44.asServiceRole.entities.User.filter({ email: app.user_email });
        if (targetUsers && targetUsers.length > 0) {
          const targetUser = targetUsers[0];
          const cycle = override_cycle || app.requested_cycle;
          const limitJpy = parseFloat(override_limit_jpy) || parseFloat(app.requested_limit_jpy) || 0;

          // Calculate next due date based on cycle
          const now = new Date();
          let nextDue;
          if (cycle === 'weekly') {
            // Next Monday
            const day = now.getDay();
            const daysUntilMonday = day === 0 ? 1 : 8 - day;
            nextDue = new Date(now);
            nextDue.setDate(now.getDate() + daysUntilMonday);
          } else {
            // First of next month
            nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          }

          const updateData = {
            credit_enabled: true,
            credit_cycle: cycle,
            credit_limit_jpy: limitJpy,
          };

          // Only set start_date on first approval
          if (!targetUser.credit_enabled && app.application_type === 'apply') {
            updateData.credit_start_date = now.toISOString().slice(0, 10);
            updateData.credit_next_due_date = nextDue.toISOString().slice(0, 10);
            updateData.credit_balance_jpy = targetUser.credit_balance_jpy || 0;
          } else if (app.application_type === 'adjust') {
            // Update next due date for new cycle
            updateData.credit_next_due_date = nextDue.toISOString().slice(0, 10);
          }

          await base44.asServiceRole.entities.User.update(targetUser.id, updateData);
        }
      }

      return Response.json({ success: true });
    }

    // === USER: get own credit status ===
    if (action === 'get_user_credit') {
      const pendingApps = await base44.asServiceRole.entities.CreditApplication.filter({
        user_email: user.email,
        status: 'pending'
      });
      const allMyApps = await base44.asServiceRole.entities.CreditApplication.filter({
        user_email: user.email,
      });
      allMyApps.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      return Response.json({
        credit_enabled: userRecord.credit_enabled || false,
        credit_limit_jpy: userRecord.credit_limit_jpy || 0,
        credit_cycle: userRecord.credit_cycle || null,
        credit_balance_jpy: userRecord.credit_balance_jpy || 0,
        credit_start_date: userRecord.credit_start_date || null,
        credit_next_due_date: userRecord.credit_next_due_date || null,
        member_tier_id: userRecord.member_tier_id || null,
        member_tier_name: userRecord.member_tier_name || null,
        pending_application: pendingApps.length > 0 ? pendingApps[0] : null,
        recent_applications: allMyApps.slice(0, 5),
      });
    }

    // === ADMIN: update user credit settings directly ===
    if (action === 'admin_update_user_credit') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const { target_user_id, member_tier_id, member_tier_name, credit_enabled, credit_limit_jpy, credit_cycle } = body;
      if (!target_user_id) return Response.json({ error: 'target_user_id required' }, { status: 400 });

      const updateData = {};
      if (member_tier_id !== undefined) updateData.member_tier_id = member_tier_id;
      if (member_tier_name !== undefined) updateData.member_tier_name = member_tier_name;
      if (credit_enabled !== undefined) updateData.credit_enabled = credit_enabled;
      if (credit_limit_jpy !== undefined) updateData.credit_limit_jpy = parseFloat(credit_limit_jpy) || 0;
      if (credit_cycle !== undefined) updateData.credit_cycle = credit_cycle;

      // If enabling credit for the first time, set start date
      if (credit_enabled === true) {
        const targetUsers = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
        if (targetUsers && targetUsers.length > 0 && !targetUsers[0].credit_enabled) {
          const now = new Date();
          updateData.credit_start_date = now.toISOString().slice(0, 10);
          const cycle = credit_cycle || targetUsers[0].credit_cycle;
          if (cycle) {
            let nextDue;
            if (cycle === 'weekly') {
              const day = now.getDay();
              const daysUntilMonday = day === 0 ? 1 : 8 - day;
              nextDue = new Date(now);
              nextDue.setDate(now.getDate() + daysUntilMonday);
            } else {
              nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            }
            updateData.credit_next_due_date = nextDue.toISOString().slice(0, 10);
          }
          updateData.credit_balance_jpy = 0;
        }
      }

      await base44.asServiceRole.entities.User.update(target_user_id, updateData);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('manageCreditApplication error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});