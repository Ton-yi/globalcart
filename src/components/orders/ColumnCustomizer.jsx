/**
 * ColumnCustomizer
 * Drag-and-drop column visibility and order management.
 * Image columns get an extra width size control.
 * Uses @hello-pangea/dnd for drag support.
 */
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Eye, EyeOff, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const IMAGE_WIDTHS = [40, 64, 96, 128];

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

  const setImageWidth = (key, width) => {
    onChange(columns.map(c => c.key === key ? { ...c, imageWidth: width } : c));
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(!open)}>
        <Settings2 className="w-3.5 h-3.5" />
        自定义列
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 p-3">
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
                          className={`rounded-lg text-xs select-none transition-colors ${
                            snapshot.isDragging ? "bg-blue-50 shadow-md" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 px-2 py-1.5">
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
                          {col.isImage && col.visible && (
                            <div className="flex items-center gap-1 px-2 pb-1.5 ml-5">
                              <span className="text-gray-400 mr-1 text-[11px]">缩略图宽:</span>
                              {IMAGE_WIDTHS.map(w => (
                                <button
                                  key={w}
                                  onClick={() => setImageWidth(col.key, w)}
                                  className={`px-1.5 py-0.5 rounded text-[11px] border transition-colors ${
                                    (col.imageWidth || 40) === w
                                      ? "bg-gray-800 text-white border-gray-800"
                                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                                  }`}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          )}
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