import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Activity, ScrollText } from "lucide-react";

type AuditRow = {
  id: number;
  actorId: number;
  actorName: string | null;
  action: string;
  targetUserId: number | null;
  targetName: string | null;
  detail: string | null;
  createdAt: Date;
};

const ACTION_LABELS: Record<string, string> = {
  role_change: "Role changed",
  account_deactivated: "Account deactivated",
  account_reactivated: "Account reactivated",
};

const ACTION_BADGE_VARIANT = (action: string) =>
  action === "account_deactivated" ? "destructive" : action === "role_change" ? "default" : "secondary";

export default function AdminAudit() {
  const { user, isAuthenticated } = useAuth();
  const { data: events, isLoading } = trpc.audit.list.useQuery();

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
        <div className="text-center py-20 text-muted-foreground">
          This area is restricted to administrators.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">Audit Log</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A record of sensitive administrative actions — role changes, account deactivations and
            reactivations — kept automatically for oversight.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <ScrollText className="h-4 w-4 text-primary" />
              Recent activity
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {isLoading ? "—" : `${(events ?? []).length} entries`}
            </span>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {!isLoading && (events ?? []).length === 0 && (
              <div className="py-16 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
                <h2 className="font-display text-xl font-semibold mb-1">No recorded actions yet</h2>
                <p className="text-sm text-muted-foreground">
                  Administrative actions will appear here as they happen.
                </p>
              </div>
            )}

            {!isLoading && (events ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 pr-4 font-medium">When</th>
                      <th className="py-2.5 pr-4 font-medium">Actor</th>
                      <th className="py-2.5 pr-4 font-medium">Action</th>
                      <th className="py-2.5 pr-4 font-medium">Target</th>
                      <th className="py-2.5 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(events as AuditRow[] | undefined)?.map(e => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {e.actorName ?? `Admin #${e.actorId}`}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={ACTION_BADGE_VARIANT(e.action)}>
                            {ACTION_LABELS[e.action] ?? e.action}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {e.targetName ?? `User #${e.targetUserId ?? "?"}`}
                        </td>
                        <td className="py-3 text-muted-foreground">{e.detail ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
