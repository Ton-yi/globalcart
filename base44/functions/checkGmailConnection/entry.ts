/**
 * checkGmailConnection - 检查 Gmail 连接器是否已授权
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查 Gmail 连接器是否已授权
    const connection = await base44.asServiceRole.connectors.getConnection('gmail');
    
    if (!connection || !connection.accessToken) {
      return Response.json({
        success: false,
        connected: false,
        message: 'Gmail 连接器未授权'
      });
    }

    // 测试 Gmail API 是否可以访问
    const testResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`
      }
    });

    if (testResponse.ok) {
      const profile = await testResponse.json();
      return Response.json({
        success: true,
        connected: true,
        email: profile.emailAddress,
        message: 'Gmail 连接器已授权并可正常使用'
      });
    } else {
      return Response.json({
        success: false,
        connected: false,
        message: 'Gmail API 访问失败'
      });
    }

  } catch (error) {
    console.error('[checkGmailConnection] error:', error);
    return Response.json({ 
      success: false, 
      connected: false,
      error: error.message 
    }, { status: 500 });
  }
});