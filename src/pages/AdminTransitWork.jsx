/**
 * AdminTransitWork - Admin overview of all transit location work panels
 * Shows all transit locations with their pending work (pools) without filtering by location
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  MapPin, Package, CheckCircle, Truck, Loader2, ChevronRight, AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TransitPoolCard from "@/components/transit/TransitPoolCard";

export default function AdminTransitWork() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [poolsByLocation, setPoolsByLocation] = useState({});

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const r = await base44.functions.invoke('getAllTransitWorkData', {});
        const data = r.data || {};
        setLocations(data.locations || []);
        setPoolsByLocation(data.poolsByLocation || {});
      } catch (err) {
        console.error('AdminTransitWork fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const getPoolsByStatus = (pools) => ({
    arrived: pools.filter(p => p.transit_arrival_confirmed_at && !p.transit_shipped_date),
    in_transit: pools.filter(p => p.status === "shipped" && !p.transit_arrival_confirmed_at && p.tracking_number),
    forwarded: pools.filter(p => p.transit_shipped_date),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeLocations = locations.filter(loc => loc.is_active !== false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">中转地工作面板（总览）</h1>
          <p className="text-sm text-gray-400 mt-0.5">所有中转地的待处理包裹，点击包裹卡片可进入操作</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/AdminShippingPool?tab=locations")}>
          <MapPin className="w-3.5 h-3.5 mr-1.5" />
          中转地管理
        </Button>
      </div>

      {activeLocations.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <MapPin className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">暂无启用的中转地</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeLocations.map(loc => {
            const pools = poolsByLocation[loc.id] || [];
            const byStatus = getPoolsByStatus(pools);
            const pendingCount = byStatus.arrived.length + byStatus.in_transit.length;

            return (
              <div key={loc.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Location Header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => window.open(`${window.location.origin}/TransitLocationWork/${loc.id}`, '_blank')}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 text-sm">{loc.name}</span>
                    {loc.code_prefix && (
                      <Badge className="text-xs bg-purple-100 text-purple-700 font-mono">{loc.code_prefix}</Badge>
                    )}
                    {loc.manager_email && (
                      <span className="text-xs text-gray-400">负责人：{loc.manager_email}</span>
                    )}
                    {!loc.manager_email && (
                      <Badge className="text-xs bg-orange-100 text-orange-700">
                        <AlertCircle className="w-2.5 h-2.5 mr-1 inline" />未分配负责人
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                      <Badge className="bg-red-100 text-red-700 text-xs">{pendingCount} 待处理</Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* In Transit */}
                  {byStatus.in_transit.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Truck className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-blue-700">在途 ({byStatus.in_transit.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {byStatus.in_transit.map(pool => (
                          <TransitPoolCard
                            key={pool.id}
                            pool={pool}
                            transitStatus="in_transit"
                            onClick={() => navigate(`/TransitPoolWork/${pool.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arrived */}
                  {byStatus.arrived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs font-medium text-green-700">已收货待转发 ({byStatus.arrived.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {byStatus.arrived.map(pool => (
                          <TransitPoolCard
                            key={pool.id}
                            pool={pool}
                            transitStatus="arrived"
                            onClick={() => navigate(`/TransitPoolWork/${pool.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Forwarded */}
                  {byStatus.forwarded.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-500">已转发 ({byStatus.forwarded.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {byStatus.forwarded.map(pool => (
                          <TransitPoolCard
                            key={pool.id}
                            pool={pool}
                            transitStatus="forwarded"
                            onClick={() => {}}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {pools.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">暂无包裹</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}