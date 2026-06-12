import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { 
  User, Package, CreditCard, MapPin, Clock, 
  DollarSign, ShoppingCart, Calendar, Shield, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";
import ProfileCommentSection from "@/components/profile/ProfileCommentSection";

export default function PublicProfile() {
  const { handle } = useParams();
  const { user: currentUser } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!handle) return;
    
    setLoading(true);
    setError(null);
    
    base44.functions.invoke('getPublicProfile', { handle })
      .then((res) => {
        if (res.data?.error) {
          setError(res.data.error);
        } else {
          setProfile(res.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        // 后端对不存在/未公开/被风控统一返回 404，限速返回 429
        setError(err.response?.data?.error || "用户不存在或不可访问");
        setLoading(false);
      });
  }, [handle]);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `¥${Math.round(amount).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error || "用户不存在或不可访问"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8 px-4">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name || profile.handle} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                {(profile.display_name || profile.handle)[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.display_name || profile.handle}</h1>
                {profile.member_tier_name && (
                  <Badge className="bg-blue-100 text-blue-700">{profile.member_tier_name}</Badge>
                )}
                {profile.roles && profile.roles.map(role => (
                  <Badge key={role} className="bg-gray-100 text-gray-700">
                    {role === 'platform_admin' ? '平台管理员' : role === 'tenant_admin' ? '租户管理员' : role === 'staff' ? '工作人员' : '用户'}
                  </Badge>
                ))}
                {/* 租户自定义角色标签 */}
                {(profile.custom_roles || []).map((r, idx) => (
                  <Badge key={`cr-${idx}`} variant="outline" className="text-xs" style={{ borderColor: r.color, color: r.color }}>
                    {r.name}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                @{profile.handle}
                {profile.country && (
                  <span className="inline-flex items-center gap-1 ml-3">
                    <MapPin className="w-3.5 h-3.5" />{profile.country}
                  </span>
                )}
              </p>
              {profile.bio && (
                <div className="text-sm text-gray-600 mt-3 [&_p]:my-1 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-blue-600 [&_a]:underline [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3">
                  <ReactMarkdown>{profile.bio}</ReactMarkdown>
                </div>
              )}
              {profile.bio_image_url && (
                <img src={profile.bio_image_url} alt="Bio" className="mt-3 rounded-lg max-h-48 object-cover" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {profile.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">累计消费</p>
              <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(profile.stats.totalPaidJpy)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">订单数</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{profile.stats.totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">货款总计</p>
              <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(profile.stats.totalGoodsJpy)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">服务费</p>
              <p className="text-xl font-bold text-indigo-700 mt-1">{formatCurrency(profile.stats.totalServiceFeeJpy)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meta Info */}
      {(profile.created_date || profile.last_login_at || profile.stats?.lastOrderDate) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">账户信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.created_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">注册时间：{formatDate(profile.created_date)}</span>
              </div>
            )}
            {profile.last_login_at && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">最近登录：{formatDate(profile.last_login_at)}</span>
              </div>
            )}
            {profile.stats?.lastOrderDate && (
              <div className="flex items-center gap-2 text-sm">
                <ShoppingCart className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">最近下单：{formatDate(profile.stats.lastOrderDate)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Orders (if visible) */}
      {profile.recentOrders && profile.recentOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">最近订单</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{order.product_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(order.created_date)} · {formatCurrency(order.paid_amount)}
                  </p>
                </div>
                <Badge className={order.order_status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {order.order_status === 'delivered' ? '已完成' : order.order_status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 留言板 */}
      <ProfileCommentSection handle={handle} />
    </div>
  );
}