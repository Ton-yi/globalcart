/**
 * ColumnCustomizer
 * Drag-and-drop column visibility and order management.
 * Uses @hello-pangea/dnd for drag support.
 */
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Eye, EyeOff, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ColumnCustomizer({ columns, onChange }) {
  const [open, setOpen] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(columns);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    onChange(reordered);
  };

  const toggleVisible = (key) => {
    onChange(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(!open)}>
        <Settings2 className="w-3.5 h-3.5" />
        自定义列
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-64 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">拖拽排序 · 点击切换显示</span>
            <button onClick={() => setOpen(false)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                  {columns.map((col, index) => (
                    <Draggable key={col.key} draggableId={col.key} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs select-none transition-colors ${
                            snapshot.isDragging ? "bg-blue-50 shadow-md" : "hover:bg-gray-50"
                          }`}
                        >
                          <span {...provided.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          <span className={`flex-1 ${col.visible ? "text-gray-800" : "text-gray-400 line-through"}`}>
                            {col.label}
                          </span>
                          <button onClick={() => toggleVisible(col.key)} className="text-gray-400 hover:text-gray-700">
                            {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}