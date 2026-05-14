import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all ItemSizeTemplate records
    const templates = await base44.entities.ItemSizeTemplate.list();

    if (!templates || templates.length === 0) {
      return Response.json({ success: true, deleted: 0, message: '无旧数据需要清空' });
    }

    // Delete all old templates (清空旧数据)
    let deleted = 0;
    for (const template of templates) {
      await base44.entities.ItemSizeTemplate.delete(template.id);
      deleted++;
    }

    return Response.json({ 
      success: true, 
      deleted,
      message: `已清空 ${deleted} 个旧模板数据，请创建新模板` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});