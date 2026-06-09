/**
 * TransitPoolWork - 单箱工作面板（基于拼邮申请数据）
 * Route: /Trworkon/:request_id
 * 此页面提供中转地发货工作流：用户分组、地址管理、打包图片、中转地发货信息填写
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { 
  Package, CheckCircle, Clock, Truck, Calendar, 
  MapPin, Scale, Image as ImageIcon, AlertCircle,
  Loader2, ChevronRight, X, Edit2, Save, ArrowLeft,
  Users, DollarSign, ClipboardCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import UserGroupCard from "@/components/transit/UserGroupCard";
import TransitShippingForm from "@/components/transit/TransitShippingForm";

export default function TransitPoolWork() {
  const { request_id } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [entries, setEntries] = useState([]);
  const [location, setLocation] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [transitMethods, setTransitMethods] = useState([]);
  const [addonOptions, setAddonOptions] = useState([]);
  
  // Transit shipping form state
  const [showTransitForm, setShowTransitForm] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getTransitPoolWorkData', { request_id });
      
      if (!res.data?.request) {
        navigate("/Home");
        return;
      }
      
      setRequest(res.data.request);
      setEditData(res.data.request);
      setEntries(res.data.entries || []);
      setLocation(res.data.location);
      setTransitMethods(res.data.transitMethods || []);
      setAddonOptions(res.data.addonOptions || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('加载失败：' + error.message);
      navigate("/Home");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !request_id) return;
    fetchData();
  }, [user, request_id]);

  const handleSaveRequest = async () => {
    setSaving(true);
    try {
      const allowedFields = ['deadline', 'on_deadline_action', 'admin_note'];
      const updateData = {};
      allowedFields.forEach(field => {
        if (editData[field] !== undefined) {
          updateData[field] = editData[field];
        }
      });
      
      await base44.functions.invoke('manageGroupBuy', {
        action: 'update_request',
        request_id: request.id,
        ...updateData
      });
      
      setRequest({ ...request, ...updateData });
      setEditing(false);
      alert('保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransitShippingSubmit = async (formData) => {
    setSaving(true);
    try {
      // Update request with transit shipping info
      await base44.functions.invoke('updateTransitPoolShipment', {
        request_id: request.id,
        ...formData,
      });

      alert('中转地发货信息已保存');
      setShowTransitForm(false);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Failed to submit transit shipping:', error);
      throw error; // Re-throw for component to handle
    } finally {
      setSaving(false);
    }
  };

  const handleAddressUpdate = async (entryId, newAddress) => {
    try {
      await base44.functions.invoke('manageGroupBuy', {
        action: 'update_entry_address',
        entry_id: entryId,
        final_address: newAddress
      });
      alert('地址已更新');
      fetchData();
    } catch (error) {
      throw error;
    }
  };

  const handlePackingImageUpload = async (entryId, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke('manageGroupBuy', {
        action: 'add_entry_packing_image',
        entry_id: entryId,
        image_url: file_url
      });
      alert('图片已上传');
      fetchData();
    } catch (error) {
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  const activeEntries = entries.filter(e => e.status === 'active');
  const completedEntries = entries.filter(e => e.status === 'completed');
  const totalAmount = activeEntries.reduce((sum, e) => sum + (e.estimated_jpy || 0), 0);
  const totalWeight = activeEntries.reduce((sum, e) => sum + (e.weight_g || 0), 0);

  // Group entries by user
  const userGroups = activeEntries.reduce((groups, entry) => {
    const key = entry.user_email;
    if (!groups[key]) {
      groups[key] = {
        user_email: entry.user_email,
        user_name: entry.user_name,
        entries: [],
        final_address: entry.final_address,
        packing_image_urls: entry.packing_image_urls || [],
        estimated_jpy: 0,
      };
    }
    groups[key].entries.push(entry);
    groups[key].estimated_jpy += entry.estimated_jpy || 0;
    return groups;
  }, {});

  const userGroupList = Object.values(userGroups);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              {request.title}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {request.template_name} · 创建者：{request.creator_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={
            request.status === 'completed' ? 'bg-green-100 text-green-700' :
            request.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }>
            {request.status === 'completed' ? '已完成' :
             request.status === 'cancelled' ? '已取消' : '招募中'}
          </Badge>
          {location && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="w-3 h-3 mr-1" />
              {location.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">拼单信息</CardTitle>
            {(user?.role === 'admin' || user?.role === 'tenant_admin') && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setEditing(!editing)}
                className="h-7 text-xs"
              >
                {editing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                {editing ? '取消' : '编辑'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div>
                <Label className="text-xs text-gray-500">截止日期</Label>
                <Input 
                  type="date" 
                  value={editData.deadline || ''}
                  onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">到期处理</Label>
                <select
                  value={editData.on_deadline_action || 'cancel'}
                  onChange={(e) => setEditData({ ...editData, on_deadline_action: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="cancel">取消订单</option>
                  <option value="proceed">继续单独下单</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleSaveRequest}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
                >
                  {saving ? <span className="animate-spin">⏳</span> : <Save className="w-3 h-3 mr-1" />}
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(false)}
                  className="text-xs h-8"
                >
                  取消
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500">参团人数</p>
                  <p className="text-sm font-semibold">{userGroupList.length} 人</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500">订单数量</p>
                  <p className="text-sm font-semibold">{activeEntries.length} 个</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500">总金额</p>
                  <p className="text-sm font-semibold">¥{Math.round(totalAmount).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500">总重量</p>
                  <p className="text-sm font-semibold">{(totalWeight / 1000).toFixed(2)} kg</p>
                </div>
              </div>
            </div>
          )}
          
          {request.admin_note && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
              <strong>管理员备注：</strong>{request.admin_note}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transit Shipping Form */}
      {location && (user?.role === 'admin' || user?.role === 'tenant_admin' || location.manager_email === user.email) && (
        <div>
          {!showTransitForm && !request.transit_shipped_date && (
            <Button
              size="sm"
              onClick={() => setShowTransitForm(true)}
              className="w-full mb-3"
            >
              <Truck className="w-4 h-4 mr-2" />
              填写中转地发货信息
            </Button>
          )}
          {showTransitForm ? (
            <TransitShippingForm
              request={request}
              onSave={handleTransitShippingSubmit}
              onCancel={() => setShowTransitForm(false)}
            />
          ) : request.transit_shipped_date ? (
            <Card className="border-green-200 bg-green-50/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="w-4 h-4 text-green-600" />
                    中转地发货信息
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTransitForm(true)}
                    className="h-7 text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    编辑
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700"><strong>运输方式：</strong>{request.transit_shipping_method}</span>
                </div>
                {request.transit_tracking_number && (
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700"><strong>单号：</strong>{request.transit_tracking_number}</span>
                  </div>
                )}
                {request.transit_fee_jpy && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700"><strong>运费：</strong>¥{request.transit_fee_jpy.toLocaleString()}</span>
                  </div>
                )}
                {request.transit_note && (
                  <div className="text-gray-600"><strong>备注：</strong>{request.transit_note}</div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  发货日期：{request.transit_shipped_date} · 操作人：{request.transit_shipped_by}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {/* User Groups */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          参团用户分组
        </h2>
        <div className="space-y-3">
          {userGroupList.map(userGroup => (
            <UserGroupCard
              key={userGroup.user_email}
              userEntry={userGroup}
              orders={userGroup.entries}
              onAddressUpdate={handleAddressUpdate}
              onPackingImageUpload={handlePackingImageUpload}
            />
          ))}
        </div>
      </div>

      {/* Completed Entries */}
      {completedEntries.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            已完成订单
          </h2>
          <div className="space-y-2">
            {completedEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{entry.product_name}</p>
                    <p className="text-xs text-gray-500">{entry.user_name}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-600">¥{Math.round(entry.estimated_jpy).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}