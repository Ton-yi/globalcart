/**
 * CountrySettingsManager
 * Allows admin to:
 *  - Enable/disable countries (disabled countries are hidden from user-facing selectors)
 *  - Reorder countries via drag-and-drop (top = shown first in selectors)
 * Saved to SiteSettings key="tenant_countries_config" as a JSON array.
 */
import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Save, Search, ToggleLeft, ToggleRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_COUNTRIES } from "@/lib/countries";
import { tenantEntity } from "@/lib/tenantApi";
import { invalidateTenantCountriesCache } from "@/hooks/useTenantCountries";

export default function CountrySettingsManager({ initialConfig, settingId, onReload }) {
  // rows: [{ code, name, nameJa, enabled }]
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initialConfig && initialConfig.length > 0) {
      // Merge config with ALL_COUNTRIES to get display names
      const configCodes = initialConfig.map(c => c.code);
      const inConfig = initialConfig.map(c => {
        const info = ALL_COUNTRIES.find(ac => ac.code === c.code);
        return info ? { ...info, enabled: c.enabled !== false } : null;
      }).filter(Boolean);
      const rest = ALL_COUNTRIES
        .filter(c => !configCodes.includes(c.code))
        .map(c => ({ ...c, enabled: true }));
      setRows([...inConfig, ...rest]);
    } else {
      setRows(ALL_COUNTRIES.map(c => ({ ...c, enabled: true })));
    }
  }, [initialConfig]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const newRows = Array.from(rows);
    const [removed] = newRows.splice(result.source.index, 1);
    newRows.splice(result.destination.index, 0, removed);
    setRows(newRows);
  };

  const toggleEnabled = (code) => {
    setRows(prev => prev.map(r => r.code === code ? { ...r, enabled: !r.enabled } : r));
  };

  const handleReset = () => {
    setRows(ALL_COUNTRIES.map(c => ({ ...c, enabled: true })));
  };

  const handleSave = async () => {
    setSaving(true);
    const config = rows.map(r => ({ code: r.code, enabled: r.enabled }));
    const value = JSON.stringify(config);
    if (settingId) {
      await tenantEntity.update('SiteSettings', settingId, { value });
    } else {
      await tenantEntity.create('SiteSettings', {
        key: 'tenant_countries_config',
        value,
        description: '租户国家列表配置（排序+启用状态）',
        category: 'general',
      });
    }
    invalidateTenantCountriesCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await onReload();
  };

  const enabledCount = rows.filter(r => r.enabled).length;

  // For display: if searching, show filtered flat list; otherwise show full ordered list
  const displayRows = search.trim()
    ? rows.filter(r =>
        r.name.includes(search) ||
        r.nameJa?.includes(search) ||
        r.code.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          已启用 <span className="font-medium text-blue-600">{enabledCount}</span> / {rows.length} 个国家·地区
          <span className="ml-1 text-gray-400">（拖拽行可调整顺序，置顶的国家在选择框中优先显示）</span>
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" />恢复默认
          </Button>
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索国家..."
          className="h-8 text-sm pl-8"
        />
      </div>

      {search.trim() ? (
        // Search mode: simple list, no drag
        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
          {displayRows.length === 0 && (
            <div className="py-4 text-center text-xs text-gray-400">未找到匹配国家</div>
          )}
          {displayRows.map(row => (
            <div key={row.code} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{row.name}</span>
                <span className="text-xs text-gray-400">{row.nameJa}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1 rounded">{row.code}</span>
              </div>
              <button type="button" onClick={() => toggleEnabled(row.code)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${row.enabled ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                {row.enabled
                  ? <><ToggleRight className="w-3.5 h-3.5" />启用</>
                  : <><ToggleLeft className="w-3.5 h-3.5" />禁用</>}
              </button>
            </div>
          ))}
        </div>
      ) : (
        // Normal mode: drag-and-drop list
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="countries">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto"
              >
                {rows.map((row, index) => (
                  <Draggable key={row.code} draggableId={row.code} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 ${
                          snapshot.isDragging ? 'bg-blue-50 shadow-sm' : row.enabled ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 opacity-60'
                        }`}
                      >
                        <div {...provided.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab flex-shrink-0">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">{index + 1}</span>
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span className={`text-sm ${row.enabled ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                            {row.name}
                          </span>
                          <span className="text-xs text-gray-400 hidden sm:inline">{row.nameJa}</span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-1 rounded flex-shrink-0">{row.code}</span>
                        </div>
                        <button type="button" onClick={() => toggleEnabled(row.code)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors flex-shrink-0 ${
                            row.enabled ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}>
                          {row.enabled
                            ? <><ToggleRight className="w-3.5 h-3.5" />启用</>
                            : <><ToggleLeft className="w-3.5 h-3.5" />禁用</>}
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
      )}

      <p className="text-xs text-gray-400">
        提示：禁用的国家将从所有面向用户的下拉框中隐藏，但已有记录不受影响。排序变更后需点击「保存」才生效。
      </p>
    </div>
  );
}