import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, CalendarRange, Ticket, Users } from "lucide-react";

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(2)}`;
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AdminAnalytics() {
  const { user, isAuthenticated } = useAuth();
  const { data: breakdown, isLoading: breakdownLoading } =
    trpc.analytics.categoryBreakdown.useQuery(undefined, { enabled: true });
  const { data: trends, isLoading: trendsLoading } =
    trpc.analytics.monthlyTrends.useQuery({ months: 6 });

  if (!isAuthenticated || !user) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">You are not signed in.</div>
      </DashboardLayout>
    );
  }
  if (user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-lg font-medium mb-2">Admin access required</p>
          <p className="text-sm text-muted-foreground">Your account is not an administrator.</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalRevenue = (breakdown ?? []).reduce((s, b) => s + Number(b.revenuePesewas ?? 0), 0);
  const totalVisitors = (breakdown ?? []).reduce(
    (s, b) => s + Number(b.visitors ?? 0),
    0,
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Revenue and visitor-category insights drawn from confirmed and pending bookings.
            Cancelled bookings are excluded.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Banknote className="h-5 w-5 text-heritage" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total revenue
                </p>
                <p className="font-display text-2xl font-semibold text-heritage">
                  {breakdownLoading ? "…" : formatPrice(totalRevenue)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-heritage" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total visitors
                </p>
                <p className="font-display text-2xl font-semibold">
                  {breakdownLoading ? "…" : totalVisitors.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center shrink-0">
                <CalendarRange className="h-5 w-5 text-heritage" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Bookings (6 months)
                </p>
                <p className="font-display text-2xl font-semibold">
                  {trendsLoading
                    ? "…"
                    : (trends ?? []).reduce((s, t) => s + Number(t.bookings ?? 0), 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly trends */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-display text-xl">Monthly revenue trend</CardTitle>
            <CardDescription>
              Revenue from bookings over the last {(trends ?? []).length || 6} months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !trends || trends.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                No booking data yet — trends will appear as bookings are made.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={m => MONTH_LABELS[Number(m) - 1]?.slice(0, 3) ?? String(m)}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `GH₵${Number(v) / 100}`}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatPrice(value), "Revenue"]}
                      labelFormatter={label => MONTH_LABELS[Number(label) - 1] ?? String(label)}
                    />
                    <Bar dataKey="revenuePesewas" fill="#14532d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Visitor category breakdown</CardTitle>
            <CardDescription>
              Visitors and revenue per category across all non-cancelled bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !breakdown || breakdown.length === 0 ? (
              <div className="py-10 text-center">
                <Ticket className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No category data yet — breakdown will appear as bookings are made.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {breakdown.map(row => {
                  const visitors = Number(row.visitors ?? 0);
                  const revenue = Number(row.revenuePesewas ?? 0);
                  const share = totalVisitors > 0 ? Math.round((visitors / totalVisitors) * 100) : 0;
                  return (
                    <div
                      key={row.categoryName}
                      className="rounded-lg border border-border px-4 py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[160px_1fr_auto_auto] items-center gap-x-4 gap-y-1"
                    >
                      <p className="font-medium text-sm truncate">{row.categoryName}</p>
                      <div className="hidden sm:block h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all"
                          style={{ width: `${Math.min(100, share * 2.5)}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-right">
                        {visitors.toLocaleString()} visitor{visitors === 1 ? "" : "s"}
                        <span className="ml-1.5 text-xs text-muted-foreground/70">({share}%)</span>
                      </p>
                      <p className="text-sm font-semibold text-heritage text-right">
                        {formatPrice(revenue)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
