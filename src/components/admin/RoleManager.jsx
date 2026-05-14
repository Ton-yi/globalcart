import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Edit2, Download, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function RoleManager() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_role_id: '',
    direct_permissions: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        base44.functions.invoke('manageRoles', { action: 'listRoles' }),
        base44.functions.invoke('managePermissions', { action: 'listPermissions' })
      ]);
      setRoles(rolesRes.data.roles || []);
      setPermissions(permsRes.data.permissions || []);
    } catch (err) {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.description) {
      toast.error('请填写必填字段');
      return;
    }

    try {
      await base44.functions.invoke('manageRoles', {
        action: 'create',
        data: formData
      });
      toast.success('角色创建成功');
      setFormData({ name: '', description: '', parent_role_id: '', direct_permissions: [] });
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除此角色吗？')) return;

    try {
      await base44.functions.invoke('manageRoles', {
        action: 'delete',
        data: { role_id: id }
      });
      toast.success('角色删除成功');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleExport = async (roleId) => {
    try {
      const res = await base44.functions.invoke('exportImportRoles', {
        action: 'exportRole',
        data: { role_id: roleId }
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `role-${res.data.role.name}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('角色导出成功');
    } catch (err) {
      toast.error('导出失败');
    }
  };

  const handleExportTenantRoles = async () => {
    try {
      const res = await base44.functions.invoke('exportImportRoles', {
        action: 'exportTenantRoles'
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-roles-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('租户角色导出成功');
    } catch (err) {
      toast.error('导出失败');
    }
  };

  const getPermissionName = (id) => {
    return permissions.find(p => p.id === id)?.name || id;
  };

  if (loading) return <div className="p-4 text-center">加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">角色管理</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportTenantRoles()}
          >
            <Download className="w-4 h-4 mr-1" />
            导出所有角色
          </Button>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            创建角色
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Input
            placeholder="角色名称"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Input
            placeholder="角色描述"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          
          <div>
            <label className="text-sm font-medium">继承自父角色（可选）</label>
            <select
              value={formData.parent_role_id}
              onChange={(e) => setFormData({ ...formData, parent_role_id: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            >
              <option value="">不继承</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">直接权限</label>
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1 border rounded p-2">
              {permissions.map(perm => (
                <label key={perm.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.direct_permissions.includes(perm.id)}
                    onChange={(e) => {
                      const perms = e.target.checked
                        ? [...formData.direct_permissions, perm.id]
                        : formData.direct_permissions.filter(p => p !== perm.id);
                      setFormData({ ...formData, direct_permissions: perms });
                    }}
                  />
                  <span>{perm.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>保存</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {roles.map((role) => (
          <Card key={role.id} className="p-3">
            <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}>
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {role.name}
                  {role.is_global && <Badge variant="outline" className="text-xs">全局</Badge>}
                </div>
                <div className="text-sm text-gray-600">{role.description}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleExport(role.id)}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(role.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedId === role.id ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {expandedId === role.id && (
              <div className="mt-3 pt-3 border-t space-y-2">
                {role.parent_role_id && (
                  <div>
                    <span className="text-sm font-medium">父角色：</span>
                    <span className="text-sm">{roles.find(r => r.id === role.parent_role_id)?.name || '已删除'}</span>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium">直接权限：</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(role.direct_permissions || []).map(permId => (
                      <Badge key={permId} variant="secondary" className="text-xs">
                        {getPermissionName(permId)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}