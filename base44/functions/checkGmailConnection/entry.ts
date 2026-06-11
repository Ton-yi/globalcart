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

    // Gmail 连接器已授权，accessToken 可用
    // 由于 scope 只有 gmail.send，不测试具体 API，由 sendEmailViaGmail 函数实际测试
    return Response.json({
      success: true,
      connected: true,
      message: 'Gmail 连接器已授权'
    });

  } catch (error) {
    console.error('[checkGmailConnection] error:', error);
    return Response.json({ 
      success: false, 
      connected: false,
      error: error.message 
    }, { status: 500 });
  }
});