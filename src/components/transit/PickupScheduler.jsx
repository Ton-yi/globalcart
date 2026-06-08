import { useState } from "react";
import { Calendar, Clock, CheckCircle, X, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";

export default function PickupScheduler({ 
  pool, 
  onUpdate,
  isAdmin 
}) {
  const [timeSlot, setTimeSlot] = useState(pool.transit_pickup_time_slot || "");
  const [saving, setSaving] = useState(false);

  const handleSchedule = async () => {
    if (!timeSlot) {
      alert('请输入自取时间段');
      return;
    }

    setSaving(true);
    try {
      await base44.functions.invoke('updateTransitPoolPickup', {
        pool_id: pool.id,
        time_slot: timeSlot,
        action: 'schedule'
      });
      onUpdate?.();
      alert('自取时间已约定');
    } catch (error) {
      alert('约定失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('updateTransitPoolPickup', {
        pool_id: pool.id,
        action: isAdmin ? 'admin_confirm' : 'user_confirm'
      });
      onUpdate?.();
      alert('已确认自取时间');
    } catch (error) {
      alert('确认失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!isAdmin) return;
    
    setSaving(true);
    try {
      await base44.functions.invoke('updateTransitPoolPickup', {
        pool_id: pool.id,
        action: 'complete'
      });
      onUpdate?.();
      alert('已标记为用户已自取');
    } catch (error) {
      alert('操作失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const userConfirmed = pool.transit_pickup_user_confirmed;
  const adminConfirmed = pool.transit_pickup_admin_confirmed;
  const completed = pool.transit_pickup_completed;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          自取管理
          {completed && (
            <Badge className="bg-green-100 text-green-700 ml-2">
              <CheckCircle className="w-3 h-3 mr-1" />
              已完成
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Badge variant={userConfirmed ? "default" : "outline"} className={userConfirmed ? "bg-blue-100 text-blue-700" : ""}>
            <User className="w-3 h-3 mr-1" />
            用户{userConfirmed ? '已确认' : '未确认'}
          </Badge>
          <Badge variant={adminConfirmed ? "default" : "outline"} className={adminConfirmed ? "bg-red-100 text-red-700" : ""}>
            <User className="w-3 h-3 mr-1" />
            管理员{adminConfirmed ? '已确认' : '未确认'}
          </Badge>
        </div>

        {/* Time Slot Display */}
        {pool.transit_pickup_time_slot && (
          <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-medium">约定时间：</span>
            <span>{pool.transit_pickup_time_slot}</span>
          </div>
        )}

        {/* Scheduling Input */}
        {!pool.transit_pickup_time_slot && (
          <div>
            <Label>约定自取时间段</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="例如：2026-06-10 14:00-16:00"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSchedule} disabled={saving}>
                约定
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Actions */}
        {pool.transit_pickup_time_slot && !completed && (
          <div className="flex gap-2">
            {!userConfirmed && !isAdmin && (
              <Button 
                onClick={handleConfirm} 
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                我接受此时间
              </Button>
            )}
            {!adminConfirmed && isAdmin && (
              <Button 
                onClick={handleConfirm} 
                disabled={saving}
                className="bg-red-600 hover:bg-red-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                确认自取时间
              </Button>
            )}
            {userConfirmed && adminConfirmed && isAdmin && (
              <Button 
                onClick={handleComplete} 
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                用户已自取
              </Button>
            )}
          </div>
        )}

        {/* Completed Status */}
        {completed && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>用户已于 {new Date(pool.transit_pickup_completed_at || pool.updated_date).toLocaleDateString()} 自取</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}