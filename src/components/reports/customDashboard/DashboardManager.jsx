/**
 * DashboardManager — 看板切换、新建、重命名、删除工具栏
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function DashboardManager({ dashboards, activeDashboardId, onSelect, onRefresh }) {
    const [createOpen, setCreateOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [nameInput,  setNameInput]  = useState('');

    const activeDashboard = dashboards.find(d => d.id === activeDashboardId);

    const handleCreate = async () => {
        if (!nameInput.trim()) return;
        try {
            const res = await base44.functions.invoke('manageCustomDashboard', {
                action: 'create',
                data: { name: nameInput.trim(), widgets: [] },
            });
            // 兼容 SDK 可能的嵌套结构：res.data.data 或 res.data
            const result = res?.data?.data ?? res?.data;
            console.log('[DashboardManager.create] response:', res, 'result:', result);
            if (result?.success && result?.dashboard) {
                toast.success('看板已创建');
                setCreateOpen(false);
                setNameInput('');
                // 先选中新看板，再刷新列表（避免刷新时覆盖选择）
                onSelect(result.dashboard.id);
                await onRefresh();
            } else {
                console.error('[DashboardManager.create] failed:', result);
                toast.error(result?.error || '创建失败');
            }
        } catch (err) {
            console.error('[DashboardManager.create] error:', err);
            toast.error(err.message || '创建失败');
        }
    };

    const handleRename = async () => {
        if (!nameInput.trim() || !activeDashboardId) return;
        try {
            const res = await base44.functions.invoke('manageCustomDashboard', {
                action: 'update',
                id: activeDashboardId,
                data: { name: nameInput.trim() },
            });
            const result = res?.data?.data ?? res?.data;
            console.log('[DashboardManager.rename] result:', result);
            if (result?.success) {
                toast.success('已重命名');
                setRenameOpen(false);
                setNameInput('');
                onRefresh();
            } else {
                toast.error(result?.error || '重命名失败');
            }
        } catch (err) {
            toast.error(err.message || '重命名失败');
        }
    };

    const handleDelete = async () => {
        if (!activeDashboardId) return;
        if (!window.confirm(`确认删除看板「${activeDashboard?.name}」？`)) return;
        try {
            const res = await base44.functions.invoke('manageCustomDashboard', {
                action: 'delete',
                id: activeDashboardId,
            });
            const result = res?.data?.data ?? res?.data;
            console.log('[DashboardManager.delete] result:', result);
            if (result?.success) {
                toast.success('看板已删除');
                onSelect(null);
                await onRefresh();
            } else {
                toast.error(result?.error || '删除失败');
            }
        } catch (err) {
            toast.error(err.message || '删除失败');
        }
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* 看板切换下拉 */}
            {dashboards.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs max-w-[180px] truncate">
                            <span className="truncate">{activeDashboard?.name || '选择看板'}</span>
                            <ChevronDown className="w-3 h-3 flex-shrink-0" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {dashboards.map(d => (
                            <DropdownMenuItem key={d.id} onClick={() => onSelect(d.id)}
                                className={d.id === activeDashboardId ? 'font-medium' : ''}>
                                {d.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* 新建 */}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => { setNameInput(''); setCreateOpen(true); }}>
                <Plus className="w-3 h-3" />新建
            </Button>

            {/* 重命名 / 删除（有激活看板时显示） */}
            {activeDashboard && (
                <>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground"
                        onClick={() => { setNameInput(activeDashboard.name); setRenameOpen(true); }}>
                        <Pencil className="w-3 h-3" />重命名
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-500 hover:text-red-600"
                        onClick={handleDelete}>
                        <Trash2 className="w-3 h-3" />删除
                    </Button>
                </>
            )}

            {/* 新建对话框 */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>新建看板</DialogTitle></DialogHeader>
                    <Input value={nameInput} onChange={e => setNameInput(e.target.value)}
                        placeholder="看板名称..." onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
                        <Button onClick={handleCreate} disabled={!nameInput.trim()}>创建</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 重命名对话框 */}
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>重命名看板</DialogTitle></DialogHeader>
                    <Input value={nameInput} onChange={e => setNameInput(e.target.value)}
                        placeholder="新名称..." onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameOpen(false)}>取消</Button>
                        <Button onClick={handleRename} disabled={!nameInput.trim()}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}