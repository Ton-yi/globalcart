import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import nodemailer from 'npm:nodemailer@6.9.7';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 权限验证：仅管理员可发送邮件
        if (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { to, subject, body, from_name, from_email } = await req.json();

        // 参数验证
        if (!to || !subject || !body) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return Response.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // 防止邮件注入：过滤危险字符
        const sanitizeHeader = (str) => {
            if (!str) return str;
            return str.replace(/[\r\n\t]/g, '').trim();
        };

        const safeTo = sanitizeHeader(to);
        const safeSubject = sanitizeHeader(subject);
        const safeFromName = sanitizeHeader(from_name);
        const safeFromEmail = sanitizeHeader(from_email);

        // 获取租户邮箱设置（使用 service role 确保数据完整性）
        const settingsList = await base44.asServiceRole.entities.TenantEmailSettings.filter({
            tenant_id: user.tenant_id
        });

        const settings = settingsList && settingsList.length > 0 ? settingsList[0] : null;

        // 如果没有配置或使用平台默认
        if (!settings || settings.email_provider === 'platform') {
            const emailData = {
                to: safeTo,
                subject: safeSubject,
                body,
                from_name: safeFromName || settings?.sender_name || undefined,
                from_email: safeFromEmail || settings?.sender_email || undefined
            };
            
            const result = await base44.asServiceRole.integrations.Core.SendEmail(emailData);
            return Response.json({ success: true, provider: 'platform', ...result });
        }

        // 使用 Gmail
        if (settings.email_provider === 'gmail' && settings.gmail_connection_enabled) {
            const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
            
            const oauth2Client = new nodemailer.OAuth2Client();
            oauth2Client.setCredentials({
                access_token: accessToken
            });

            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    type: 'OAuth2',
                    user: settings.sender_email || user.email
                }
            });

            const mailOptions = {
                from: `"${safeFromName || settings.sender_name || '通知中心'}" <${safeFromEmail || settings.sender_email || user.email}>`,
                to: safeTo,
                subject: safeSubject,
                html: body
            };

            await transporter.sendMail(mailOptions);
            return Response.json({ success: true, provider: 'gmail' });
        }

        // 使用 SMTP
        if (settings.email_provider === 'smtp' && settings.smtp_enabled) {
            // 验证 SMTP 配置完整性
            if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
                return Response.json({ 
                    error: 'SMTP 配置不完整',
                    success: false 
                }, { status: 400 });
            }

            // 端口白名单验证
            const allowedPorts = [25, 465, 587, 2525];
            const smtpPort = settings.smtp_port || 587;
            if (!allowedPorts.includes(smtpPort)) {
                return Response.json({ 
                    error: '不支持的 SMTP 端口',
                    success: false 
                }, { status: 400 });
            }

            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: smtpPort,
                secure: smtpPort === 465 || settings.smtp_secure,
                auth: {
                    user: settings.smtp_username,
                    pass: settings.smtp_password
                },
                tls: {
                    rejectUnauthorized: true
                }
            });

            const mailOptions = {
                from: `"${safeFromName || settings.smtp_from_name || settings.sender_name || '通知中心'}" <${safeFromEmail || settings.smtp_from_email || settings.sender_email || settings.smtp_username}>`,
                to: safeTo,
                subject: safeSubject,
                html: body
            };

            await transporter.sendMail(mailOptions);
            return Response.json({ success: true, provider: 'smtp' });
        }

        return Response.json({ 
            error: '未配置有效的邮件发送方式',
            success: false 
        }, { status: 400 });

    } catch (error) {
        console.error('[sendEmailViaSMTP] error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});