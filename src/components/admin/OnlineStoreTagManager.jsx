import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { Plus, Trash2, Edit2, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OnlineStoreTagManager() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newRule, setNewRule] = useState({ keyword: "", tag_label: "", tag_color: "bg-gray-100 text-gray-700", priority: 0 });

const COLOR_PRESETS = [
  { value: "bg-gray-100 text-gray-700", label: "灰色" },
  { value: "bg-blue-100 text-blue-700", label: "蓝色" },
  { value: "bg-red-100 text-red-700", label: "红色" },
  { value: "bg-green-100 text-green-700", label: "绿色" },
  { value: "bg-yellow-100 text-yellow-700", label: "黄色" },
  { value: "bg-purple-100 text-purple-700", label: "紫色" },
  { value: "bg-orange-100 text-orange-700", label: "橙色" },
  { value: "bg-pink-100 text-pink-700", label: "粉色" },
];

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const data = await base44.entities.OnlineStoreTagRule.list("-priority", 100);
    setRules(data);
    setLoading(false);
  };

  const handleAddRule = async () => {
    if (!newRule.keyword || !newRule.tag_label) return;
    await base44.entities.OnlineStoreTagRule.create({
      keyword: newRule.keyword,
      tag_label: newRule.tag_label,
      tag_color: newRule.tag_color || "bg-gray-100 text-gray-700",
      priority: parseInt(newRule.priority) || 0,
      is_active: true
    });
    setNewRule({ keyword: "", tag_label: "", tag_color: "bg-gray-100 text-gray-700", priority: 0 });
    await loadRules();
  };

  const handleDeleteRule = async (id) => {
    await base44.entities.OnlineStoreTagRule.delete(id);
    await loadRules();
  };

  const handleStartEdit = (rule) => {
    setEditingId(rule.id);
    setEditForm(rule);
  };

  const handleSaveEdit = async () => {
    await base44.entities.OnlineStoreTagRule.update(editingId, {
      keyword: editForm.keyword,
      tag_label: editForm.tag_label,
      tag_color: editForm.tag_color || "bg-gray-100 text-gray-700",
      priority: parseInt(editForm.priority) || 0
    });
    setEditingId(null);
    await loadRules();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleToggleActive = async (rule) => {
    await base44.entities.OnlineStoreTagRule.update(rule.id, {
      is_active: !rule.is_active
    });
    await loadRules();
  };

  const handleMovePriority = async (rule, direction) => {
    const newPriority = rule.priority + (direction === "up" ? 1 : -1);
    await base44.entities.OnlineStoreTagRule.update(rule.id, { priority: newPriority });
    await loadRules();
  };

  if (loading) return <p className="text-gray-400 text-sm">加载中...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">商城标签识别规则</h3>
        <p className="text-xs text-gray-400 mb-3">根据商品URL中的关键词自动识别商城，为订单分配标签</p>
      </div>

      {/* Rules list */}
      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-lg border ${editingId === rule.id ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
              {editingId === rule.id ? (
                <>
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">关键词</Label>
                      <Input
                        className="h-7 text-sm"
                        value={editForm.keyword}
                        onChange={e => setEditForm(p => ({ ...p, keyword: e.target.value }))}
                        placeholder="e.g., www.suruga-ya.jp"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500 block mb-1">标签</Label>
                        <Input
                          className="h-7 text-sm"
                          value={editForm.tag_label}
                          onChange={e => setEditForm(p => ({ ...p, tag_label: e.target.value }))}
                          placeholder="e.g., 駿河屋"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 block mb-1">优先级</Label>
                        <Input
                          type="number"
                          className="h-7 text-sm"
                          value={editForm.priority}
                          onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-2">显示颜色</Label>
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_PRESETS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => setEditForm(p => ({ ...p, tag_color: c.value }))}
                            className={`px-2 py-1 rounded text-xs border-2 transition-colors ${editForm.tag_color === c.value ? "border-blue-400 shadow-sm" : "border-transparent"}`}
                            title={c.label}
                          >
                            <Badge className={`text-xs ${c.value}`}>{c.label}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                      onClick={handleSaveEdit}
                    >
                      <Save className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={handleCancelEdit}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">{rule.keyword}</code>
                      <Badge className={`text-xs ${rule.tag_color || "bg-gray-100 text-gray-700"}`}>{rule.tag_label}</Badge>
                      <span className="text-xs text-gray-400">优先级: {rule.priority || 0}</span>
                      {!rule.is_active && <Badge className="bg-gray-100 text-gray-400 text-xs">已禁用</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-blue-600"
                      onClick={() => handleMovePriority(rule, "up")}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-blue-600"
                      onClick={() => handleMovePriority(rule, "down")}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-blue-600"
                      onClick={() => handleStartEdit(rule)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red-400"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && !loading && (
        <p className="text-xs text-gray-400 text-center py-4">暂无规则，在下方添加新规则</p>
      )}

      {/* Add new rule */}
      <Card className="border-dashed border-gray-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2">
            <Plus className="w-4 h-4" />新增规则
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">关键词 *</Label>
            <Input
              className="mt-1 h-8 text-sm"
              placeholder="www.amazon.co.jp 或 rakuten.co.jp"
              value={newRule.keyword}
              onChange={e => setNewRule(p => ({ ...p, keyword: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">标签标签 *</Label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="駿河屋"
                value={newRule.tag_label}
                onChange={e => setNewRule(p => ({ ...p, tag_label: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">优先级</Label>
              <Input
                type="number"
                className="mt-1 h-8 text-sm"
                value={newRule.priority}
                onChange={e => setNewRule(p => ({ ...p, priority: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500 block mb-2">显示颜色</Label>
            <div className="flex gap-1 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setNewRule(p => ({ ...p, tag_color: c.value }))}
                  className={`px-2 py-1 rounded text-xs border-2 transition-colors ${newRule.tag_color === c.value ? "border-blue-400 shadow-sm" : "border-transparent"}`}
                  title={c.label}
                >
                  <Badge className={`text-xs ${c.value}`}>{c.label}</Badge>
                </button>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddRule}
            disabled={!newRule.keyword || !newRule.tag_label}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />添加规则
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}