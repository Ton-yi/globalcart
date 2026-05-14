import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PermissionManager() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', resource_type: '', action: '' });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const res = await base44.functions.invoke('managePermissions', {
        action: 'listPermissions'
      });
      setPermissions(res.data.permissions || []);
    } catch (err) {
      toast.error('加载权限失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.resource_type || !formData.action) {
      toast.error('请填写所有必填字段');
      return;
    }

    try {
      await base44.functions.invoke('managePermissions', {
        action: 'create',
        data: {
          ...formData,
          description: formData.description || formData.name
        }
      });
      toast.success('权限创建成功');
      setFormData({ name: '', description: '', resource_type: '', action: '' });
      setShowForm(false);
      loadPermissions();
    } catch (err) {
      toast.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除此权限吗？')) return;

    try {
      await base44.functions.invoke('managePermissions', {
        action: 'delete',
        data: { permission_id: id }
      });
      toast.success('权限删除成功');
      loadPermissions();
    } catch (err) {
      toast.error(err.response?.data?.error || '删除失败');
    }
  };

  if (loading) return <div className="p-4 text-center">加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">权限管理</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          创建权限
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <Input
            placeholder="权限名称 (如 order:read)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Input
            placeholder="描述"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex gap-2">
            <Input
              placeholder="资源类型 (如 Order)"
              value={formData.resource_type}
              onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
              className="flex-1"
            />
            <Input
              placeholder="操作 (如 read)"
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>保存</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {permissions.map((perm) => (
          <Card key={perm.id} className="p-3 flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium">{perm.name}</div>
              <div className="text-sm text-gray-600">{perm.description}</div>
              <div className="flex gap-2 mt-2">
                {perm.is_global && <Badge variant="outline">全局</Badge>}
                <Badge variant="secondary">{perm.resource_type}</Badge>
                <Badge variant="secondary">{perm.action}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(perm.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}