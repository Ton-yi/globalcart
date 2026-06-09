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
  FileText, Box, ClipboardList
} from "lucide-react";
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

export default function TransitPoolWork() {
  const { pool_id } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState(null);
  const [orders, setOrders] = useState([]);
  const [location, setLocation] = useState(null);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [activeRequests, setActiveRequests] = useState([]);
  const [inTransitRequests, setInTransitRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [transitShippingMethod, setTransitShippingMethod] = useState("");
  const [transitShippingMethodCustom, setTransitShippingMethodCustom] = useState("");
  const [transitTrackingNumber, setTransitTrackingNumber] = useState("");
  const [transitFeeJpy, setTransitFeeJpy] = useState("");
  const [transitNote, setTransitNote] = useState("");
  const [transitImages, setTransitImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Expanded user groups
  const [expandedGroups, setExpandedGroups] = useState([]);

  useEffect(() => {
    if (!user || !pool_id) return;
    
    const fetchData = async () => {
      setLoading(true);
      const t = timePage('TransitPoolWork');
      try {
        const r = await base44.functions.invoke('getTransitPoolWorkData', { 
          pool_id 
        });
        const data = r.data || {};
        
        console.log('[TransitPoolWork] Received data:', {
          pool_code: data.pool?.pool_code,
          order_ids_count: data.pool?.order_ids?.length,
          orders_count: data.orders?.length,
          debug: data.debug
        });
        
        if (!data.pool) {
          navigate("/TransitLocationWork");
          return;
        }
        
        setPool(data.pool);
        setOrders(data.orders || []);
        setLocation(data.location);
        setShippingMethods(data.shippingMethods || []);
        
        // Set default shipping method from pool
        if (data.pool.transit_shipping_method_name) {
          setTransitShippingMethod(data.pool.transit_shipping_method_name);
        }
        
        // Fetch all pools for this transit location for the panel using backend function
        const panelData = await base44.functions.invoke('getTransitWorkPanelData', {});
        const allPools = (panelData.data?.pools || []).filter(p => p.transit_location_id === data.location.id);
        
        console.log('[TransitPoolWork] Fetched', allPools?.length || 0, 'pools for transit location', data.location.name);
        const arrived = allPools.filter(p => p.transit_arrival_confirmed_at && !p.transit_shipped_date);
        const inTransit = allPools.filter(p => p.status === "shipped" && !p.transit_arrival_confirmed_at && p.tracking_number);
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
  }, [user, pool_id]);

  // Use per_user_groups directly (contains order_entries)
  const userGroups = pool?.per_user_groups || [];

  const handleToggleGroup = (email) => {
    setExpandedGroups(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const handleUserShippingFormChange = async (userEmail, addressGroupIdx, shippingData) => {
    // Debounce or save immediately based on your preference
    // For now, we'll save immediately
    try {
      await base44.functions.invoke('updateUserTransitShipping', {
        pool_id,
        user_email: userEmail,
        address_group_idx: addressGroupIdx,
        shipping_data: shippingData
      });
    } catch (error) {
      console.error('Failed to save shipping info:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file }).then(r => r.file_url)
      );
      const urls = await Promise.all(uploadPromises);
      setTransitImages(prev => [...prev, ...urls]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上传失败：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (url) => {
    setTransitImages(prev => prev.filter(u => u !== url));
  };

  const handleSubmit = async () => {
    if (!transitShippingMethod && !transitShippingMethodCustom) {
      alert('请填写中转运输方式');
      return;
    }
    
    setSaving(true);
    try {
      await base44.functions.invoke('updateTransitPoolShipment', {
        pool_id,
        transit_shipping_method: transitShippingMethod || transitShippingMethodCustom,
        transit_tracking_number: transitTrackingNumber,
        transit_fee_jpy: transitFeeJpy ? parseFloat(transitFeeJpy) : 0,
        transit_note: transitNote,
        transit_image_urls: transitImages
      });
      
      alert('发货信息已保存并提交');
      // Navigate back with refresh flag
      navigate(`/TransitLocationWork/${location?.id}`, { state: { refresh: true } });
    } catch (error) {
      console.error('Submit failed:', error);
      alert('提交失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
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
            onClick={() => navigate(-1)}
          >
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
          {pool.transit_shipped_date && (
            <Badge className="bg-gray-100 text-gray-700">已发货</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRequestPanel(!showRequestPanel)}
            className="relative"
          >
            <ClipboardList className="w-4 h-4 mr-1" />
            发货申请
            {activeRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeRequests.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Pool Detail Summary */}
      <PoolDetailHeader 
        pool={pool} 
        location={location}
        orderCount={orders.length}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: User Groups */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                用户订单分组
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userGroups.length > 0 ? (
                userGroups.map(userGroup => (
                  <UserGroupCard
                    key={userGroup.user_email}
                    userEntry={userGroup}
                    pool={pool}
                    isExpanded={expandedGroups.includes(userGroup.user_email)}
                    onExpand={() => handleToggleGroup(userGroup.user_email)}
                    onOrderClick={(orderId) => {
                      console.log('Order clicked:', orderId);
                    }}
                    showShippingForm={true}
                    onShippingFormChange={handleUserShippingFormChange}
                  />
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无订单分组</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Management Cards */}
        <div className="space-y-4">
          {/* Transit Shipping Form */}
          <TransitShippingForm
            pool={pool}
            shippingMethods={shippingMethods}
            onSubmit={async (data) => {
              await base44.functions.invoke('updateTransitPoolShipment', {
                pool_id,
                ...data
              });
              alert('发货信息已保存并提交');
              navigate(-1);
            }}
            loading={saving}
          />

          {/* Address Change */}
          <AddressChangeCard
            pool={pool}
            onUpdate={() => {
              // Refresh data
              window.location.reload();
            }}
          />

          {/* Pickup Scheduling */}
          {location?.allow_pickup && (
            <PickupScheduler
              pool={pool}
              isAdmin={user.role === 'admin' || user.role === 'platform_admin' || user.email === location.manager_email}
              onUpdate={() => {
                window.location.reload();
              }}
            />
          )}

          {/* Storage Management */}
          {location?.allow_storage && (
            <StorageManagementCard
              pool={pool}
              isAdmin={user.role === 'admin' || user.role === 'platform_admin' || user.email === location.manager_email}
              onUpdate={() => {
                window.location.reload();
              }}
            />
          )}
        </div>
      </div>

      {/* Shipping Request Panel (Slide-over) */}
      {showRequestPanel && (
        <ShippingRequestPanel
        arrivedRequests={activeRequests}
        inTransitRequests={inTransitRequests}
        currentPoolId={pool.id}
        onClose={() => setShowRequestPanel(false)}
        onNavigate={(requestPoolId) => {
          navigate(`/TransitPoolWork/${requestPoolId}`);
        }}
        />
      )}
    </div>
  );
}