import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PermissionManager from '@/components/admin/PermissionManager';
import RoleManager from '@/components/admin/RoleManager';
import { Shield, Lock } from 'lucide-react';

export default function AdminRoleManagement() {
  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8" />
            角色和权限管理
          </h1>
          <p className="text-gray-600 mt-2">创建、管理和配置系统角色和权限，支持权限继承和粒度控制</p>
        </div>

        <Tabs defaultValue="permissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              权限管理
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              角色管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="mt-6">
            <div className="bg-white rounded-lg shadow p-6">
              <PermissionManager />
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-6">
            <div className="bg-white rounded-lg shadow p-6">
              <RoleManager />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900">系统说明</h3>
          <ul className="text-sm text-blue-800 mt-2 space-y-1">
            <li>• 创建权限定义系统中的具体操作（如 order:read, shipping_pool:update）</li>
            <li>• 创建角色并关联权限，支持单一继承（子角色继承父角色权限）</li>
            <li>• 子角色可以继承父角色的权限，也可以选择性地移除或新增权限</li>
            <li>• 导出和导入功能可以复用角色配置到其他租户或备份</li>
            <li>• 平台管理员可以创建全局权限和角色供所有租户使用</li>
          </ul>
        </div>
      </div>
    </div>
  );
}