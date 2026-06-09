/**
 * TransitPoolWork - Single pool work page for transit location managers
 * Route: /TransitPoolWork/:pool_id
 * Manager can process shipping for a specific pool
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { timePage } from "@/lib/timing";
import {
  ArrowLeft, Package, CheckCircle, Clock, Truck, MapPin,
  Image as ImageIcon, AlertCircle, Upload, Loader2, ChevronDown,
  ChevronUp, Edit2, X, Save, Send, User, Calendar, Phone,
  FileText, Box, ClipboardList, Home } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCountry } from "@/lib/countries";
import PoolDetailHeader from "@/components/transit/PoolDetailHeader";
import UserGroupCard from "@/components/transit/UserGroupCard";
import ShippingRequestPanel from "@/components/transit/ShippingRequestPanel";
import TransitShippingForm from "@/components/transit/TransitShippingForm";
import AddressChangeCard from "@/components/transit/AddressChangeCard";
import PickupScheduler from "@/components/transit/PickupScheduler";
import StorageManagementCard from "@/components/transit/StorageManagementCard";
import { toast } from "sonner";

export default function TransitPoolWork() {
  const { pool_code } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState(null);
  const [orders, setOrders] = useState([]);
  const [location, setLocation] = useState(null);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [activeRequests, setActiveRequests] = useState([]);
  const [inTransitRequests, setInTransitRequests] = useState([]);
  const [saving, setSaving] = useState(false);

  // Transit methods state
  const [transitMethods, setTransitMethods] = useState([]);
  const [preferredTransitMethodId, setPreferredTransitMethodId] = useState(null);

  // Expanded user groups
  const [expandedGroups, setExpandedGroups] = useState([]);



  useEffect(() => {
    if (!user || !pool_code) return;

    const fetchData = async () => {
      setLoading(true);
      const t = timePage('TransitPoolWork');
      try {
        console.log('[TransitPoolWork] Fetching data for pool_code:', pool_code);
        const r = await base44.functions.invoke('getTransitPoolWorkData', {
          pool_code
        });
        const data = r.data || {};

        console.log('[TransitPoolWork] Received data:', {
          pool_code: data.pool?.pool_code,
          pool_id: data.pool?.id,
          order_ids_count: data.pool?.order_ids?.length,
          orders_count: data.orders?.length,
          location_name: data.location?.name,
          transitMethods_count: data.transitMethods?.length,
          debug: data.debug,
          full_data: data
        });

        if (!data.pool) {
          console.error('[TransitPoolWork] No pool data received, navigating back');
          navigate("/AdminTransitWork");
          return;
        }

        setPool(data.pool);
        setOrders(data.orders || []);
        setLocation(data.location);
        setTransitMethods(data.transitMethods || []);
        setPreferredTransitMethodId(data.preferredTransitMethodId || null);

        // Fetch all pools for this transit location for the panel using backend function
        const panelData = await base44.functions.invoke('getTransitWorkPanelData', {});
        const allPools = (panelData.data?.pools || []).filter((p) => p.transit_location_id === data.location.id);

        console.log('[TransitPoolWork] Fetched', allPools?.length || 0, 'pools for transit location', data.location.name);
        const arrived = allPools.filter((p) => p.transit_arrival_confirmed_at && !p.transit_shipped_date);
        const inTransit = allPools.filter((p) => p.status === "shipped" && !p.transit_arrival_confirmed_at && p.tracking_number);
        console.log('[TransitPoolWork] Arrived:', arrived?.length || 0);
        console.log('[TransitPoolWork] In transit:', inTransit?.length || 0);

        setActiveRequests(arrived);
        setInTransitRequests(inTransit);

        t.done('data ready');
      } catch (error) {
        console.error('Failed to fetch pool data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, pool_code]);

  // Use per_user_groups directly (contains order_entries)
  const userGroups = pool?.per_user_groups || [];

  // State for showing address in right panel
  const [showingAddress, setShowingAddress] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleToggleGroup = (groupKey) => (e) => {
    e.stopPropagation();
    setExpandedGroups((prev) =>
      prev.includes(groupKey) ?
        prev.filter((k) => k !== groupKey) :
        [...prev, groupKey]
    );
  };

  const handleOrderSelect = (orderId, orderEntry, address) => {
    // 点击订单时显示订单详情和地址
    setSelectedOrder({ orderId, orderEntry, address });
    if (address) {
      setShowingAddress({ address, orders: [orderEntry] });
    }
  };

  const handleShowAddress = (address, orders) => {
    setShowingAddress({ address, orders });
    setSelectedOrder(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>);

  }

  if (!pool) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Header with back button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}>
            
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {pool.pool_code || '发货申请'} - 单箱工作
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              中转地：{location?.name || pool.transit_location_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={pool.transit_arrival_confirmed_at ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
            {pool.transit_arrival_confirmed_at ? "已收货" : "待收货"}
          </Badge>
          {pool.transit_shipped_date &&
          <Badge className="bg-gray-100 text-gray-700">已发货</Badge>
          }
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRequestPanel(!showRequestPanel)}
            className="relative">
            
            <ClipboardList className="w-4 h-4 mr-1" />
            发货申请
            {activeRequests.length > 0 &&
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeRequests.length}
              </span>
            }
          </Button>
        </div>
      </div>

      {/* Pool Detail Summary */}
      <PoolDetailHeader
        pool={pool}
        location={location}
        orderCount={orders.length} />
      

      {/* Main Content */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: User Groups */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="py-6 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                用户订单分组
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userGroups.length > 0 ?
              userGroups.map((userGroup) => {
                const groupKey = `${userGroup.user_email}__${userGroup.transit_shipping_method_id || 'none'}`;
                return (
                <UserGroupCard
                  key={groupKey}
                  userEntry={userGroup}
                  pool={pool}
                  isExpanded={expandedGroups.includes(groupKey)}
                  onExpand={handleToggleGroup(groupKey)}
                  onOrderClick={(orderId) => {
                    console.log('Order clicked:', orderId);
                  }}
                  onOrderSelect={handleOrderSelect}
                  onShowAddress={handleShowAddress}
                  selectedOrderIds={[]} />
                );
              }) :

              <div className="text-center text-gray-400 py-8">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无订单分组</p>
                </div>
              }
            </CardContent>
          </Card>
        </div>

        {/* Right: Management Cards */}
        <div className="space-y-4">
          {/* Address Display Card (shown when user clicks "View Address" or selects an order) */}
          {showingAddress && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="py-4 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    最终收货地址
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setShowingAddress(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-xs space-y-2">
                {showingAddress.address && (
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <User className="w-3 h-3 text-gray-400 mt-0.5" />
                      <span>收件人：{showingAddress.address.recipient_name || '未填写'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-3 h-3 text-gray-400 mt-0.5" />
                      <span>电话：{showingAddress.address.phone || '未填写'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Home className="w-3 h-3 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-700">国家/地区：{getCountry(showingAddress.address.country)?.name || showingAddress.address.country || '未填写'}</p>
                        {showingAddress.address.addr1 && <p>地址 1：{showingAddress.address.addr1}</p>}
                        {showingAddress.address.addr2 && <p>地址 2：{showingAddress.address.addr2}</p>}
                        {showingAddress.address.addr3 && <p>地址 3：{showingAddress.address.addr3}</p>}
                        {showingAddress.address.state && <p>州/省：{showingAddress.address.state}</p>}
                        {showingAddress.address.postal_code && <p>邮编：{showingAddress.address.postal_code}</p>}
                      </div>
                    </div>
                    {showingAddress.orders && showingAddress.orders.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="font-medium text-gray-700 mb-1">相关订单（{showingAddress.orders.length}个）</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {showingAddress.orders.map((order, idx) => (
                            <div key={order.order_id || idx} className="flex items-start gap-1.5">
                              <Package className="w-3 h-3 text-gray-400 mt-0.5" />
                              <span className="truncate">{order.product_name || order.note || `订单 ${order.order_id?.slice(-6) || idx + 1}`}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transit Shipping Form */}
          <TransitShippingForm
            pool={pool}
            transitMethods={transitMethods}
            preferredTransitMethodId={preferredTransitMethodId}
            onSubmit={async (data) => {
              await base44.functions.invoke('updateTransitPoolShipment', {
                pool_id: pool.id,
                ...data
              });
              alert('发货信息已保存并提交');
              navigate(-1);
            }}
            loading={saving} />
          

          {/* Address Change */}
          <AddressChangeCard
            pool={pool}
            onUpdate={() => {
              // Refresh data
              window.location.reload();
            }} />
          

          {/* Pickup Scheduling - Only show if pool has pickup enabled */}
          {location?.allow_pickup && pool?.transit_pickup_enabled && (
            <PickupScheduler
              pool={pool}
              isAdmin={user.role === 'admin' || user.role === 'platform_admin' || user.email === location.manager_email}
              onUpdate={() => {
                window.location.reload();
              }} />
          )}

          {/* Storage Management - Only show if pool has storage enabled */}
          {location?.allow_storage && pool?.transit_storage_enabled && (
            <StorageManagementCard
              pool={pool}
              isAdmin={user.role === 'admin' || user.role === 'platform_admin' || user.email === location.manager_email}
              onUpdate={() => {
                window.location.reload();
              }} />
          )}
        </div>
      </div>

      {/* Shipping Request Panel (Slide-over) */}
      {showRequestPanel &&
      <ShippingRequestPanel
        arrivedRequests={activeRequests}
        inTransitRequests={inTransitRequests}
        currentPoolId={pool.id}
        onClose={() => setShowRequestPanel(false)}
        onNavigate={(requestPoolId) => {
          navigate(`/TransitPoolWork/${requestPoolId}`);
        }} />

      }

    </div>);

}