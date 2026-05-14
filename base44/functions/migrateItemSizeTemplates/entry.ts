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
      return Response.json({ success: true, updated: 0, message: '无模板需要迁移' });
    }

    // Check and update templates that don't have image_url field
    let updated = 0;
    for (const template of templates) {
      // If image_url field is missing or undefined, add it
      if (!template.image_url || template.image_url === undefined) {
        const { id, tenant_id, created_date, updated_date, created_by, ...data } = template;
        await base44.entities.ItemSizeTemplate.update(id, { ...data, image_url: "" });
        updated++;
      }
    }

    return Response.json({ 
      success: true, 
      updated, 
      total: templates.length,
      message: `迁移完成：${updated}/${templates.length} 个模板已更新` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});