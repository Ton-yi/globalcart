/**
 * TransitPoolWork - 单箱工作面板（基于拼邮申请数据）
 * Route: /Trworkon/:pool_code
 * 此页面完全基于 GroupBuyRequest 数据，提供额外的编辑功能
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { 
  Package, CheckCircle, Clock, Truck, Calendar, 
  MapPin, Scale, Image as ImageIcon, AlertCircle,
  Loader2, ChevronRight, X, Edit2, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCountry } from "@/lib/countries";

export default function TransitPoolWork() {
  const { pool_code } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [entries, setEntries] = useState([]);
  const [location, setLocation] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 通过 pool_code 查找对应的 GroupBuyRequest
      // 注意：这里需要根据实际业务逻辑调整
      const allRequests = await base44.asServiceRole.entities.GroupBuyRequest.filter({});
      const foundRequest = (allRequests || []).find(r => 
        r.id === pool_code || r.pool_code === pool_code
      );
      
      if (!foundRequest) {
        navigate("/Home");
        return;
      }
      
      setRequest(foundRequest);
      setEditData(foundRequest);
      
      // 获取条目
      const allEntries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ 
        request_id: foundRequest.id 
      });
      setEntries(allEntries || []);
      
      // 获取中转地信息
      if (foundRequest.transit_location_id) {
        const locations = await base44.asServiceRole.entities.TransitLocation.filter({ 
          id: foundRequest.transit_location_id 
        });
        if (locations && locations.length > 0) {
          setLocation(locations[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !pool_code) return;
    fetchData();
  }, [user, pool_code]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.asServiceRole.entities.GroupBuyRequest.update(request.id, editData);
      setRequest({ ...request, ...editData });
      setEditing(false);
      alert('保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('保存失败：' + error.message);
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

  if (!request) {
    return null;
  }

  const activeEntries = entries.filter(e => e.status === 'active');
  const completedEntries = entries.filter(e => e.status === 'completed');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            ← 返回
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
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setEditing(!editing)}
              className="h-7 text-xs"
            >
              {editing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
              {editing ? '取消' : '编辑'}
            </Button>
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
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">截止日期：</span>
                <span className="font-medium">{request.deadline}</span>
              </div>
              <div>
                <span className="text-gray-500">到期处理：</span>
                <span className="font-medium">
                  {request.on_deadline_action === 'cancel' ? '取消订单' : '继续单独下单'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">目标金额：</span>
                <span className="font-medium">¥{request.condition_min_amount_jpy?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">当前金额：</span>
                <span className="font-medium text-indigo-600">¥{request.total_amount_jpy?.toLocaleString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entries */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Package className="w-4 h-4" />
          参团条目（{activeEntries.length} 个）
        </h3>
        
        {activeEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">暂无参团条目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {activeEntries.map(entry => (
              <Card key={entry.id} className="border-gray-200">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.product_name}</span>
                        {entry.user_email === user?.email && (
                          <Badge className="text-[10px] bg-purple-100 text-purple-600">我</Badge>
                        )}
                      </div>
                      {entry.product_description && (
                        <p className="text-xs text-gray-500 mt-0.5">{entry.product_description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {entry.user_name || entry.user_email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        ¥{Math.round(entry.estimated_jpy).toLocaleString()}
                      </p>
                      {entry.status === 'completed' && (
                        <Badge className="mt-1 text-[10px] bg-green-100 text-green-700">
                          已下单
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {entry.product_image_url && (
                    <div className="mt-2">
                      <img 
                        src={entry.product_image_url} 
                        alt={entry.product_name}
                        className="w-20 h-20 object-cover rounded border"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Entries */}
      {completedEntries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            已完成条目（{completedEntries.length} 个）
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {completedEntries.map(entry => (
              <Card key={entry.id} className="border-green-200 bg-green-50/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{entry.product_name}</p>
                      <p className="text-xs text-gray-500">{entry.user_name || entry.user_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700">
                        ¥{Math.round(entry.estimated_jpy).toLocaleString()}
                      </p>
                      {entry.order_number && (
                        <p className="text-xs text-green-600 mt-0.5">
                          订单号：{entry.order_number}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}