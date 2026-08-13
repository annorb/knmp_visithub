import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BarChart3,
  CalendarCheck,
  CalendarX,
  Landmark,
  Users,
  Wallet,
} from "lucide-react";
import { Link, useLocation } from "wouter";

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function AdminOverview() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = trpc.bookings.stats.useQuery();
  const { data: attractions, isLoading: aLoading } = trpc.attractions.listAll.useQuery();
  const { data: categories } = trpc.categories.listAll.useQuery();

  if (loading) return <DashboardLayout><Skeleton className="h-32 w-full" /></DashboardLayout>;
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
          <p className="text-sm text-muted-foreground mb-4">
            Your account does not have administrator privileges.
          </p>
          <Link href="/" className="text-heritage underline text-sm">
            Return to the public site
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    { label: "Total bookings", value: stats?.total ?? "–", icon: BarChart3, tone: "text-heritage" },
    { label: "Upcoming visits", value: stats?.upcoming ?? "–", icon: CalendarCheck, tone: "text-heritage" },
    { label: "Total visitors", value: stats?.totalVisitors ?? "–", icon: Users, tone: "text-heritage" },
    { label: "Estimated revenue", value: stats ? formatPrice(stats.revenuePesewas) : "–", icon: Wallet, tone: "text-heritage" },
    { label: "Cancelled", value: stats?.cancelled ?? "–", icon: CalendarX, tone: "text-destructive" },
    { label: "Active attractions", value: aLoading ? "…" : (attractions ?? []).filter(a => a.isActive).length, icon: Landmark, tone: "text-heritage" },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl">
        <h1 className="font-display text-3xl font-semibold mb-1">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Manage the Kwame Nkrumah Memorial Park's attractions, visitor
          categories and bookings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {statCards.map(s => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl font-semibold">{isLoading ? "…" : s.value}</span>
                  <s.icon className={`h-5 w-5 ${s.tone}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-xl">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => navigate("/admin/attractions")}
                className="rounded-lg border border-border p-4 text-left hover:border-gold/60 hover:shadow-md transition-all group"
              >
                <Landmark className="h-5 w-5 text-heritage mb-2" />
                <p className="font-medium text-sm">Manage attractions</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {aLoading ? "…" : (attractions ?? []).length} listed
                </p>
              </button>
              <button
                onClick={() => navigate("/admin/categories")}
                className="rounded-lg border border-border p-4 text-left hover:border-gold/60 hover:shadow-md transition-all group"
              >
                <Wallet className="h-5 w-5 text-heritage mb-2" />
                <p className="font-medium text-sm">Visitor fees & categories</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(categories ?? []).length} categories
                </p>
              </button>
              <button
                onClick={() => navigate("/admin/bookings")}
                className="rounded-lg border border-border p-4 text-left hover:border-gold/60 hover:shadow-md transition-all sm:col-span-2"
              >
                <CalendarCheck className="h-5 w-5 text-heritage mb-2" />
                <p className="font-medium text-sm">Review all bookings</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View, confirm and cancel visitor bookings across the platform
                </p>
              </button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-xl">System information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Signed in as <span className="font-medium text-foreground">{user.name}</span>{" "}
                ({user.email}).
              </p>
              <p>
                Booking references are generated automatically in the format
                <span className="font-mono text-foreground"> KNMP-XXXXXX</span> and
                are guaranteed unique by the database.
              </p>
              <p>
                All timestamps are stored in UTC and displayed in your local
                timezone.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
