/**
 * CustomDashboardView — 自定义看板的主画布
 * 支持拖拽排序（@hello-pangea/dnd）、添加/编辑/删除 widget
 */
import React, { useState, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Pencil, Trash2, Save, Loader2, LayoutDashboard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import WidgetRenderer from "./WidgetRenderer.jsx";
import WidgetEditModal from "./WidgetEditModal.jsx";

function nanoid() {
    return Math.random().toString(36).slice(2, 10);
}

export default function CustomDashboardView({ dashboard, reportData, dimension, onSaved }) {
    const [widgets,    setWidgets]    = useState(dashboard?.widgets || []);
    const [editWidget, setEditWidget] = useState(null);
    const [addOpen,    setAddOpen]    = useState(false);
    const [saving,     setSaving]     = useState(false);
    const [dirty,      setDirty]      = useState(false);

    // 当 dashboard 切换时重置
    useEffect(() => {
        setWidgets(dashboard?.widgets || []);
        setDirty(false);
    }, [dashboard?.id]);

    const markDirty = (newWidgets) => {
        setWidgets(newWidgets);
        setDirty(true);
    };

    const handleDragEnd = useCallback((result) => {
        if (!result.destination) return;
        const items = Array.from(widgets);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        markDirty(items);
    }, [widgets]);

    // 没有 dashboard 时显示提示（在所有 hooks 之后）
    if (!dashboard) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <LayoutDashboard className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">请先选择或新建一个看板</p>
            </div>
        );
    }

    const handleAddWidget = (partial) => {
        const newWidget = { id: nanoid(), ...partial };
        markDirty([...widgets, newWidget]);
        setAddOpen(false);
    };

    const handleEditWidget = (idx, partial) => {
        const updated = widgets.map((w, i) => i === idx ? { ...w, ...partial } : w);
        markDirty(updated);
        setEditWidget(null);
    };

    const handleDeleteWidget = (idx) => {
        markDirty(widgets.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!dashboard?.id) return;
        setSaving(true);
        const res = await base44.functions.invoke('manageCustomDashboard', {
            action: 'update',
            id: dashboard.id,
            data: { widgets },
        });
        setSaving(false);
        if (res?.data?.success) {
            toast.success('看板已保存');
            setDirty(false);
            onSaved?.();
        } else {
            toast.error('保存失败');
        }
    };

    return (
        <div className="space-y-4">
            {/* 工具栏 */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {widgets.length} 个组件 · 拖拽调整顺序
                </p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                        onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5" />添加组件
                    </Button>
                    {dirty && (
                        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            保存看板
                        </Button>
                    )}
                </div>
            </div>

            {/* 空状态 */}
            {widgets.length === 0 && (
                <div className="border-2 border-dashed rounded-lg py-20 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted/20">
                    <LayoutDashboard className="w-10 h-10 opacity-20" />
                    <div className="text-center space-y-1">
                        <p className="text-sm font-medium">看板还没有组件</p>
                        <p className="text-xs opacity-70">添加指标卡片、趋势图等组件来定制您的数据看板</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />添加第一个组件
                    </Button>
                </div>
            )}

            {/* 拖拽画布 */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="dashboard-widgets">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                            {widgets.map((widget, idx) => (
                                <Draggable key={widget.id} draggableId={widget.id} index={idx}>
                                    {(drag, snapshot) => (
                                        <div
                                            ref={drag.innerRef}
                                            {...drag.draggableProps}
                                            className={`relative group transition-shadow ${snapshot.isDragging ? 'shadow-lg' : ''}`}>
                                            {/* 控制条 */}
                                            <div className="absolute top-2 right-2 z-10 hidden group-hover:flex items-center gap-1 bg-white border rounded-md shadow-sm px-1 py-0.5">
                                                <div {...drag.dragHandleProps} className="cursor-grab p-1 text-gray-400 hover:text-gray-700">
                                                    <GripVertical className="w-3.5 h-3.5" />
                                                </div>
                                                <button className="p-1 text-gray-400 hover:text-blue-600"
                                                    onClick={() => setEditWidget({ index: idx, widget })}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button className="p-1 text-gray-400 hover:text-red-600"
                                                    onClick={() => handleDeleteWidget(idx)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Widget 内容 */}
                                            <WidgetRenderer
                                                widget={widget}
                                                reportData={reportData}
                                                dimension={dimension}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            {/* 添加弹窗 */}
            <WidgetEditModal
                open={addOpen}
                widget={null}
                onSave={handleAddWidget}
                onClose={() => setAddOpen(false)}
            />

            {/* 编辑弹窗 */}
            {editWidget && (
                <WidgetEditModal
                    open={!!editWidget}
                    widget={editWidget.widget}
                    onSave={(partial) => handleEditWidget(editWidget.index, partial)}
                    onClose={() => setEditWidget(null)}
                />
            )}
        </div>
    );
}