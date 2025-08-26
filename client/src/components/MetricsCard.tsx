import { Card, CardContent } from "@/components/ui/card";

interface MetricsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'purple' | 'orange';
  subtitle?: string;
}

export default function MetricsCard({ title, value, icon, color, subtitle }: MetricsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-glyph-blue',
    emerald: 'bg-emerald-100 text-glyph-emerald',
    purple: 'bg-purple-100 text-glyph-purple',
    orange: 'bg-orange-100 text-boundary-orange'
  };

  return (
    <Card className="bg-white shadow-sm border border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-900" data-testid={`metric-${title.toLowerCase()}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
