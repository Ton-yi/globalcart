// Metric Card Component for Customer360
import { Card, CardContent } from "@/components/ui/card";

export default function MetricCard({ icon: Icon, label, value, subValue, color = "blue" }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  
  return (
    <Card className={`border-2 ${colorClasses[color] || colorClasses.blue}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="text-lg font-bold mt-1">{value}</p>
            {subValue && <p className="text-xs opacity-60 mt-0.5">{subValue}</p>}
          </div>
          <Icon className="w-6 h-6 opacity-50" />
        </div>
      </CardContent>
    </Card>
  );
}