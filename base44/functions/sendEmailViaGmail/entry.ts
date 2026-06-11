/**
 * sendEmailViaGmail - 使用 Gmail 连接器发送邮件
 * 支持 HTML 内容和自定义发件人名称
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const {
      to,
      subject,
      body,
      body_type = 'html',
      from_name,
      tenant_id
    } = data;

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required parameters: to, subject, body' }, { status: 400 });
    }

    // 获取租户的 Gmail 连接
    const { accessToken, connectionConfig } = await base44.asServiceRole.connectors.getConnection('gmail');

    if (!accessToken) {
      return Response.json({ error: 'Gmail connector not configured for this tenant' }, { status: 400 });
    }

    // 构建 MIME 邮件消息
    const mimeMessage = buildMimeMessage({
      to,
      subject,
      body,
      body_type,
      from_name: from_name || connectionConfig?.sender_name || '通知中心',
      from_email: connectionConfig?.sender_email || null
    });

    // 使用 Gmail API 发送邮件
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: mimeMessage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Gmail API Error]:', errorData);
      throw new Error(errorData.error?.message || `Gmail API error: ${response.status}`);
    }

    const result = await response.json();
    
    return Response.json({
      success: true,
      message_id: result.id,
      thread_id: result.threadId,
    });

  } catch (error) {
    console.error('[sendEmailViaGmail] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * 构建 RFC 2822 格式的 MIME 邮件消息
 * 使用 Base64 URL-safe encoding
 */
function buildMimeMessage({ to, subject, body, body_type, from_name, from_email }) {
  const boundary = '----=_Part_' + Math.random().toString(16).slice(2);
  
  // 构建邮件头
  let headers = [];
  
  // From header
  if (from_email) {
    headers.push(`From: ${encodeHeader(from_name)} <${from_email}>`);
  } else {
    headers.push(`From: ${encodeHeader(from_name)}`);
  }
  
  headers.push(`To: ${to}`);
  headers.push(`Subject: ${encodeHeader(subject)}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`MIME-Version: 1.0`);
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  // 构建邮件体
  const textPart = body_type === 'html' ? stripHtml(body) : body;
  
  const message = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(textPart).replace(/=/g, ''),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(body).replace(/=/g, ''),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');

  // Base64 URL-safe encoding
  return btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 编码邮件头中的非 ASCII 字符（RFC 2047）
 */
function encodeHeader(text) {
  if (!text) return '';
  // 简单处理：如果有非 ASCII 字符，使用 UTF-8 base64 编码
  if (/[\u0080-\uFFFF]/.test(text)) {
    const encoded = btoa(unescape(encodeURIComponent(text)));
    return `=?UTF-8?B?${encoded}?=`;
  }
  return text;
}

/**
 * 从 HTML 中提取纯文本
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}