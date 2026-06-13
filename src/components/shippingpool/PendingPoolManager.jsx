/**
 * PendingPoolManager
 * Admin panel for managing 待拼邮看板 (Pending Pools).
 * Displayed as a settings panel within the official kanban view.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, Check, X, AlertCircle, Info, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PendingPoolManager({ shippingMethods = [], onClose, onSuccess }) {
  const [pendingPools, setPendingPools] = useState([]);
  const [maxPools, setMaxPools] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", shipping_method_code: "" });
  const [error, setError] = useState("");

  // Official-pool-allowed shipping methods
  const officialMethods = shippingMethods.filter(m => m.enabled_for_official_pool !== false && m.is_active !== false);

  const fetchPools = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("managePendingPools", { action: "list" });
    const data = res.data || {};
    setPendingPools(data.pendingPools || []);
    setMaxPools(data.maxPendingPools || 1);
    setLoading(false);
  };

  useEffect(() => { fetchPools(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    const res = await base44.functions.invoke("managePendingPools", {
      action: "create",
      title: "待拼邮",
      shipping_method_code: "",
    });
    const data = res.data || {};
    if (data.error) { setError(data.error); setSaving(false); return; }
    await fetchPools();
    setSaving(false);
    onSuccess?.();
  };

  const handleDelete = async (poolId) => {
    if (!confirm("确认删除此待拼邮看板？其中的订单将被解除关联。")) return;
    setSaving(true);
    setError("");
    const res = await base44.functions.invoke("managePendingPools", { action: "delete", pool_id: poolId });
    const data = res.data || {};
    if (data.error) { setError(data.error); setSaving(false); return; }
    await fetchPools();
    setSaving(false);
    onSuccess?.();
  };

  const handleSaveEdit = async (poolId) => {
    setSaving(true);
    setError("");
    const res = await base44.functions.invoke("managePendingPools", {
      action: "update",
      pool_id: poolId,
      title: editForm.title,
      shipping_method_code: editForm.shipping_method_code,
    });
    const data = res.data || {};
    if (data.error) { setError(data.error); setSaving(false); return; }
    setEditingId(null);
    await fetchPools();
    setSaving(false);
    onSuccess?.();
  };

  const startEdit = (pool) => {
    setEditingId(pool.id);
    setEditForm({
      title: pool.title || "",
      shipping_method_code: pool.pending_pool_shipping_method || "",
    });
  };

  // Check for duplicate method bindings (multiple default pools)
  const defaultPools = pendingPools.filter(p => !p.pending_pool_shipping_method);
  const hasMultipleDefaults = defaultPools.length > 1;

  // Check for method binding conflicts
  const methodCounts = {};
  pendingPools.forEach(p => {
    if (p.pending_pool_shipping_method) {
      methodCounts[p.pending_pool_shipping_method] = (methodCounts[p.pending_pool_shipping_method] || 0) + 1;
    }
  });
  const hasDuplicateMethod = Object.values(methodCounts).some(c => c > 1);

  const canCreate = pendingPools.length < maxPools;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">管理待拼邮看板</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              最多可创建 {maxPools} 个待拼邮看板（当前 {pendingPools.length} 个）
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warnings */}
        {(hasMultipleDefaults || hasDuplicateMethod) && (
          <div className="mx-5 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-700 space-y-1">
                {hasMultipleDefaults && (
                  <p>当前存在 {defaultPools.length} 个默认看板（未绑定运输方式）。预出货订单将优先分配至创建时间最早的默认看板。</p>
                )}
                {hasDuplicateMethod && (
                  <p>存在重复绑定同一运输方式的看板，可能导致匹配不稳定，建议整理。</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mx-5 mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600">
              预出货订单提交后，系统自动按运输方式匹配对应待拼邮看板；无匹配则进入最早创建的默认看板。至少保留一个待拼邮看板。
            </p>
          </div>
        </div>

        {/* Pool List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-xs">加载中...</p>
            </div>
          ) : pendingPools.length === 0 ? (
            <div className="text-center py-8 text-gray-300 text-xs">
              <Package className="w-6 h-6 mx-auto mb-1 opacity-40" />
              暂无待拼邮看板
            </div>
          ) : (
            pendingPools.map((pool, idx) => (
              <div key={pool.id} className="border border-gray-200 rounded-xl p-3 bg-white">
                {editingId === pool.id ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">标题</p>
                      <Input
                        className="h-8 text-sm"
                        value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="待拼邮看板标题"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">绑定运输方式（空=默认看板）</p>
                      <Select
                        value={editForm.shipping_method_code || "__none__"}
                        onValueChange={v => setEditForm(f => ({ ...f, shipping_method_code: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="不指定（默认看板）" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">不指定（默认看板）</SelectItem>
                          {officialMethods.map(m => (
                            <SelectItem key={m.id} value={m.code || m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={saving}>取消</Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSaveEdit(pool.id)} disabled={saving}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{pool.title || "待拼邮"}</span>
                        <span className="text-xs font-mono text-gray-400">{pool.pool_code}</span>
                        {pool.pending_pool_shipping_method ? (
                          <Badge className="text-xs bg-blue-100 text-blue-700">
                            {officialMethods.find(m => (m.code || m.id) === pool.pending_pool_shipping_method)?.name || pool.pending_pool_shipping_method}
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-100 text-gray-500">默认看板</Badge>
                        )}
                        {idx === 0 && !pool.pending_pool_shipping_method && (
                          <Badge className="text-xs bg-green-100 text-green-700">⭐ 首选默认</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(pool.order_ids || []).length} 个订单
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(pool)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pool.id)}
                        disabled={pendingPools.length <= 1}
                        title={pendingPools.length <= 1 ? "至少保留一个待拼邮看板" : "删除"}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!canCreate || saving}
            onClick={handleCreate}
            title={!canCreate ? `已达上限（${maxPools}个）` : "新增待拼邮看板"}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            新增待拼邮看板
            {!canCreate && <span className="ml-1 text-xs opacity-70">（已达上限）</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}