import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 验证是管理员或服务角色调用
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 权限验证：仅管理员可触发同步
        if (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { order_id } = await req.json();
        if (!order_id) {
            return Response.json({ error: 'order_id required' }, { status: 400 });
        }

        // 获取订单数据（确保是租户订单）
        const order = await base44.asServiceRole.entities.Order.get(order_id);
        if (!order) {
            return Response.json({ error: 'Order not found' }, { status: 404 });
        }

        // 验证订单属于当前租户
        if (order.tenant_id !== user.tenant_id) {
            return Response.json({ error: 'Order does not belong to your tenant' }, { status: 403 });
        }

        // 检查功能开关
        const settings = await base44.asServiceRole.entities.SiteSettings.filter({
            tenant_id: user.tenant_id,
            key: 'google_sheets_enabled'
        });
        const isEnabled = settings && settings.length > 0 && settings[0].value === 'true';
        
        if (!isEnabled) {
            return Response.json({ 
                error: 'Google Sheets 同步功能未启用',
                success: false 
            }, { status: 400 });
        }

        // 获取 Google Sheets 连接器
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

        // 准备订单数据行
        const rowData = [
            order.order_number || '',
            order.user_email || '',
            order.user_name || '',
            order.product_name || '',
            order.quantity?.toString() || '1',
            order.estimated_jpy?.toString() || '0',
            order.service_fee_amount?.toString() || '0',
            order.shipping_fee_amount?.toString() || '0',
            order.order_stage_payment_jpy?.toString() || '0',
            order.order_stage_profit_jpy?.toString() || '0',
            order.destination_country || '',
            order.shipping_method || '',
            order.order_status || '',
            order.tracking_number || '',
            order.shipped_date || '',
            new Date().toISOString().split('T')[0] // 同步日期
        ];

        // 查找或创建归档表格
        const spreadsheetId = await findOrCreateSpreadsheet(accessToken, '订单归档表');

        // 追加数据到第一张工作表
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1:append`;
        const appendResponse = await fetch(appendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [rowData],
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS'
            })
        });

        if (!appendResponse.ok) {
            const errorData = await appendResponse.json();
            throw new Error('Google Sheets API error: ' + JSON.stringify(errorData));
        }

        return Response.json({ 
            success: true, 
            message: '订单已同步到 Google Sheets',
            spreadsheet_id: spreadsheetId
        });

    } catch (error) {
        console.error('同步订单到 Google Sheets 失败:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// 查找或创建订单归档表格
async function findOrCreateSpreadsheet(accessToken, title) {
    // 搜索现有表格
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${title}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const searchResponse = await fetch(searchUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!searchResponse.ok) {
        throw new Error('搜索表格失败');
    }

    const searchData = await searchResponse.json();
    
    // 如果找到现有表格，返回其 ID
    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

    // 创建新表格
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            properties: {
                title: title
            },
            sheets: [{
                properties: {
                    title: 'Sheet1',
                    gridProperties: {
                        rowCount: 1000,
                        columnCount: 20
                    }
                }
            }]
        })
    });

    if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error('创建表格失败：' + JSON.stringify(errorData));
    }

    const createData = await createResponse.json();
    const spreadsheetId = createData.spreadsheetId;

    // 写入表头
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1:append`;
    await fetch(headerUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: [[
                '订单编号',
                '用户邮箱',
                '用户姓名',
                '商品名称',
                '数量',
                '估算日元',
                '服务费',
                '运费',
                '订单支付金额',
                '订单利润',
                '目的地国家',
                '运输方式',
                '订单状态',
                '运单号',
                '发货日期',
                '同步日期'
            ]],
            valueInputOption: 'RAW'
        })
    });

    return spreadsheetId;
}