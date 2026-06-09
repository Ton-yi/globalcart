/**
 * AdminTransitWorkPanel - Admin view of all transit location work
 * Shows all transit pools across all locations, grouped by location
 * Route: /AdminTransitWorkPanel
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { 
  Package, CheckCircle, Truck, MapPin, Loader2, RefreshCw, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCountry } from "@/lib/countries";
import TransitPoolCard from "@/components/transit/TransitPoolCard";

const STATUS_TABS = [
  { key: "in_transit", label: "在途（日本已发）" },
  { key: "arrived", label: "中转地已收货" },
  { key: "forwarded", label: "已转发" },
];

export default function AdminTransitWorkPanel() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [pools, setPools] = useState([]);
  const [activeTab, setActiveTab] = useState("in_transit");
  const [selectedLocation, setSelectedLocation] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('getAdminShippingPoolPageData', {});
      const data = r.data || {};
      setLocations(data.locations || []);
      // Only transit-type pools
      setPools((data.pools || []).filter(p => p.consolidation_type === "transit"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const categorize = (pool) => {
    if (pool.transit_shipped_date) return "forwarded";
    if (pool.transit_arrival_confirmed_at) return "arrived";
    if (pool.status === "shipped" && pool.tracking_number) return "in_transit";
    return null;
  };

  const filteredPools = pools.filter(p => {
    const cat = categorize(p);
    if (cat !== activeTab) return false;
    if (selectedLocation !== "all" && p.transit_location_id !== selectedLocation) return false;
    return true;
  });

  // Count by tab
  const countByTab = {};
  STATUS_TABS.forEach(t => {
    countByTab[t.key] = pools.filter(p => {
      const cat = categorize(p);
      if (cat !== t.key) return false;
      if (selectedLocation !== "all" && p.transit_location_id !== selectedLocation) return false;
      return true;
    }).length;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">中转地工作面板（全局）</h1>
          <p className="text-sm text-gray-400 mt-0.5">所有中转地的在途包裹、收货及转发状态</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
        </Button>
      </div>

      {/* Location filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">中转地筛选：</span>
        <button
          onClick={() => setSelectedLocation("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            selectedLocation === "all"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          全部 ({pools.length})
        </button>
        {locations.filter(l => l.is_active !== false).map(loc => {
          const cnt = pools.filter(p => p.transit_location_id === loc.id).length;
          return (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(loc.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedLocation === loc.id
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              <MapPin className="w-2.5 h-2.5 inline mr-1" />
              {loc.name} ({cnt})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            {STATUS_TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
                {countByTab[tab.key] > 0 && (
                  <span className="ml-1.5 text-xs bg-white/30 px-1.5 py-0.5 rounded-full">
                    {countByTab[tab.key]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map(tab => (
            <TabsContent key={tab.key} value={tab.key} className="space-y-4 mt-4">
              {filteredPools.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-gray-400">
                  <Package className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">暂无数据</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredPools.map(pool => (
                    <div key={pool.id} className="space-y-1">
                      {/* Location label */}
                      {selectedLocation === "all" && pool.transit_location_name && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 px-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {pool.transit_location_name}
                        </div>
                      )}
                      <TransitPoolCard
                        pool={pool}
                        transitStatus={tab.key}
                        onClick={tab.key !== "forwarded" ? () => navigate(`/TransitPoolWork/${pool.id}`) : () => {}}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}