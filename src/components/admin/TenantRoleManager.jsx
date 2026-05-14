import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TenantRoleManager({ tenants = [] }) {
  const [expandedTenant, setExpandedTenant] = useState(null);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState({});
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState({});
  const [newRole, setNewRole] = useState({});

  useEffect(() => {
    // Initialize empty role states for all tenants
    const init = {};
    tenants.forEach(t => {
      init[t.id] = [];
    });
    setRoles(init);
  }, [tenants]);

  const loadRoles = async (tenantId) => {
    setLoading(l => ({ ...l, [tenantId]: true }));
    try {
      const r = await base44.functions.invoke('manageRoles', { 
        action: 'list',
        tenant_id: tenantId
      });
      setRoles(prev => ({ ...prev, [tenantId]: r.data?.roles || [] }));
    } catch (err) {
      setMsg(m => ({ ...m, [tenantId]: { type: 'error', text: err.message } }));
    }
    setLoading(l => ({ ...l, [tenantId]: false }));
  };

  const handleAddRole = async (tenantId) => {
    const nr = newRole[tenantId];
    if (!nr?.name || !nr?.description) {
      setMsg(m => ({ ...m, [tenantId]: { type: 'error', text: '角色名称和描述不能为空' } }));
      return;
    }

    setSaving(s => ({ ...s, [tenantId]: true }));
    setMsg(m => ({ ...m, [tenantId]: null }));

    try {
      await base44.functions.invoke('manageRoles', {
        action: 'create',
        tenant_id: tenantId,
        name: nr.name,
        description: nr.description
      });
      setNewRole(p => ({ ...p, [tenantId]: { name: '', description: '' } }));
      await loadRoles(tenantId);
      setMsg(m => ({ ...m, [tenantId]: { type: 'success', text: '角色已创建' } }));
      setTimeout(() => setMsg(m => ({ ...m, [tenantId]: null })), 2000);
    } catch (err) {
      setMsg(m => ({ ...m, [tenantId]: { type: 'error', text: err.message } }));
    }
    setSaving(s => ({ ...s, [tenantId]: false }));
  };

  const handleDeleteRole = async (tenantId, roleId) => {
    setSaving(s => ({ ...s, [tenantId]: true }));
    setMsg(m => ({ ...m, [tenantId]: null }));

    try {
      await base44.functions.invoke('manageRoles', {
        action: 'delete',
        tenant_id: tenantId,
        role_id: roleId
      });
      await loadRoles(tenantId);
      setMsg(m => ({ ...m, [tenantId]: { type: 'success', text: '角色已删除' } }));
      setTimeout(() => setMsg(m => ({ ...m, [tenantId]: null })), 2000);
    } catch (err) {
      setMsg(m => ({ ...m, [tenantId]: { type: 'error', text: err.message } }));
    }
    setSaving(s => ({ ...s, [tenantId]: false }));
  };

  const toggleExpand = (tenantId) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
    } else {
      setExpandedTenant(tenantId);
      if (!roles[tenantId] || roles[tenantId].length === 0) {
        loadRoles(tenantId);
      }
    }
  };

  return (
    <div className="space-y-3">
      {tenants.map(tenant => (
        <Card key={tenant.id} className="border-gray-200">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => toggleExpand(tenant.id)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.branding_name} className="h-6 w-auto object-contain flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tenant.theme_color || '#dc2626' }}>
                  <span className="text-white text-xs font-bold">{(tenant.branding_name || tenant.name || '?').slice(0, 1)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span>{tenant.branding_name || tenant.name}</span>
                <Badge className="ml-2 text-xs bg-gray-100 text-gray-600">{roles[tenant.id]?.length || 0} 个角色</Badge>
              </div>
            </div>
            {expandedTenant === tenant.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedTenant === tenant.id && (
            <CardContent className="border-t border-gray-100 pt-4 space-y-4">
              {loading[tenant.id] ? (
                <p className="text-xs text-gray-400">加载中...</p>
              ) : (
                <>
                  {/* Existing roles */}
                  {(roles[tenant.id] || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">已有角色</p>
                      {roles[tenant.id].map(role => (
                        <div key={role.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{role.name}</p>
                            <p className="text-xs text-gray-400">{role.description}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-red-400 flex-shrink-0"
                            onClick={() => handleDeleteRole(tenant.id, role.id)}
                            disabled={saving[tenant.id]}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new role */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600">添加新角色</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-gray-500">角色名称</Label>
                        <Input
                          className="mt-0.5 h-8 text-sm"
                          placeholder="如：审计员、财务管理"
                          value={newRole[tenant.id]?.name || ''}
                          onChange={e => setNewRole(p => ({ ...p, [tenant.id]: { ...p[tenant.id], name: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">描述</Label>
                        <Input
                          className="mt-0.5 h-8 text-sm"
                          placeholder="此角色的权限描述"
                          value={newRole[tenant.id]?.description || ''}
                          onChange={e => setNewRole(p => ({ ...p, [tenant.id]: { ...p[tenant.id], description: e.target.value } }))}
                        />
                      </div>
                      {msg[tenant.id] && (
                        <p className={`text-xs px-2 py-1 rounded ${msg[tenant.id].type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                          {msg[tenant.id].text}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleAddRole(tenant.id)}
                        disabled={saving[tenant.id] || !newRole[tenant.id]?.name}
                      >
                        <Plus className="w-3 h-3 mr-1" />{saving[tenant.id] ? '创建中...' : '创建角色'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}