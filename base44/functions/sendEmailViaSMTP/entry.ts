import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import nodemailer from 'npm:nodemailer@6.9.7';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, subject, body, from_name, from_email } = await req.json();

        if (!to || !subject || !body) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 获取租户邮箱设置
        const settingsList = await base44.entities.TenantEmailSettings.filter({
            tenant_id: user.tenant_id
        });

        const settings = settingsList && settingsList.length > 0 ? settingsList[0] : null;

        // 如果没有配置或使用平台默认
        if (!settings || settings.email_provider === 'platform') {
            // 使用平台默认发送（调用 Core.SendEmail）
            const emailData = {
                to,
                subject,
                body,
                from_name: from_name || settings?.sender_name || undefined,
                from_email: from_email || settings?.sender_email || undefined
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
                    clientId: process.env.GMAIL_CLIENT_ID,
                    clientSecret: process.env.GMAIL_CLIENT_SECRET,
                    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                    accessToken: accessToken,
                    user: settings.smtp_from_email || settings.sender_email || user.email
                }
            });

            const mailOptions = {
                from: `"${from_name || settings.sender_name || '通知中心'}" <${from_email || settings.sender_email || user.email}>`,
                to,
                subject,
                html: body
            };

            await transporter.sendMail(mailOptions);
            return Response.json({ success: true, provider: 'gmail' });
        }

        // 使用 SMTP
        if (settings.email_provider === 'smtp' && settings.smtp_enabled) {
            if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
                return Response.json({ 
                    error: 'SMTP 配置不完整',
                    success: false 
                }, { status: 400 });
            }

            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port || 587,
                secure: settings.smtp_secure || false,
                auth: {
                    user: settings.smtp_username,
                    pass: settings.smtp_password
                }
            });

            const mailOptions = {
                from: `"${from_name || settings.smtp_from_name || settings.sender_name || '通知中心'}" <${from_email || settings.smtp_from_email || settings.sender_email || settings.smtp_username}>`,
                to,
                subject,
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