/**
 * ShippingPool - User view
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShippingPoolCard from "@/components/shippingpool/ShippingPoolCard";
import ShippingPoolDetailModal from "@/components/shippingpool/ShippingPoolDetailModal";
import CreateShippingPoolModal from "@/components/shippingpool/CreateShippingPoolModal";

const STATUS_FILTERS = [
  { v: "all", l: "全部状态" },
  { v: "pending", l: "待处理" },
  { v: "processing", l: "处理中" },
  { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已签收" },
];

export default function ShippingPool() {
  const [user, setUser] = useState(null);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPool, setSelectedPool] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = async (u) => {
    setLoading(true);
    const data = await base44.entities.ShippingPool.filter({ creator_email: u.email }, "-created_date", 100);
    setPools(data);
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchData(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const filtered = pools.filter(p => statusFilter === "all" || p.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">发货申请</h1>
          <p className="text-sm text-gray-400 mt-0.5">管理您的发货请求</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => user && fetchData(user)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />创建发货申请
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <Truck className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">暂无发货申请</p>
          <p className="text-xs mt-1">点击右上角"创建发货申请"开始</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(pool => (
            <ShippingPoolCard key={pool.id} pool={pool} onClick={setSelectedPool} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateShippingPoolModal
          isAdmin={false}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            if (user) fetchData(user);
          }}
        />
      )}

      {selectedPool && user && (
        <ShippingPoolDetailModal
          pool={selectedPool}
          isAdmin={false}
          currentUser={user}
          onClose={() => setSelectedPool(null)}
          onUpdated={() => {
            setSelectedPool(null);
            if (user) fetchData(user);
          }}
        />
      )}
    </div>
  );
}