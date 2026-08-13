import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";

type BookingRow = {
  id: number;
  reference: string;
  userId: number;
  userName: string | null;
  visitDate: Date;
  visitorName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  totalPesewas: number;
  status: "pending" | "confirmed" | "cancelled";
  notes: string | null;
  createdAt: Date;
};

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

const statusStyles: Record<string, "secondary" | "default" | "destructive"> = {
  confirmed: "secondary",
  pending: "default",
  cancelled: "destructive",
};

export default function AdminBookings() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: rows, isLoading } = trpc.bookings.listAll.useQuery();
  const statusMutation = trpc.bookings.setStatus.useMutation({
    onSettled: () => {
      utils.bookings.listAll.invalidate();
      utils.bookings.stats.invalidate();
    },
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: detail } = trpc.bookings.byId.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId !== null },
  );

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

  const selected = rows?.find(r => r.id === selectedId) ?? null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Every visitor booking on the platform. Use the status control to
            confirm arrivals or record cancellations.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !rows?.length ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground text-sm">
              No bookings have been made yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Visit date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows]
                    .sort(
                      (a, b) =>
                        new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime(),
                    )
                    .map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm font-semibold text-heritage">
                          {row.reference}
                        </TableCell>
                        <TableCell className="max-w-40 truncate">
                          {row.visitorName ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-muted-foreground">
                          {row.contactEmail ?? row.contactPhone ?? "—"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(row.visitDate), "d MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(row.totalPesewas)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusStyles[row.status] ?? "secondary"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedId(row.id)}
                            aria-label="View details"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={selectedId !== null} onOpenChange={open => !open && setSelectedId(null)}>
          <DialogContent className="sm:max-w-md">
            {selected && (
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-mono tracking-wide text-heritage">
                  {selected.reference}
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(selected.visitDate), "EEEE, d MMMM yyyy")}
                </DialogDescription>
              </DialogHeader>
            )}
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Visitor</p>
                  <p>{selected?.visitorName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Amount</p>
                  <p className="font-semibold">{selected ? formatPrice(selected.totalPesewas) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                  <p className="truncate">{selected?.contactEmail ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Phone</p>
                  <p>{selected?.contactPhone ?? "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                <p className="text-muted-foreground">{selected?.notes ?? "—"}</p>
              </div>
              {detail?.items?.length ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Line items
                  </p>
                  <div className="space-y-1.5">
                    {detail.items.map(item => (
                      <div key={item.categoryId} className="flex justify-between rounded bg-accent px-3 py-1.5">
                        <span>
                          {item.categoryName} × {item.quantity}
                        </span>
                        <span className="font-medium">{formatPrice(item.subtotalPesewas)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                  Status
                </p>
                <Select
                  value={selected?.status ?? "pending"}
                  onValueChange={value => {
                    if (selected) {
                      statusMutation.mutate({
                        id: selected.id,
                        status: value as "pending" | "confirmed" | "cancelled",
                      });
                    }
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                {statusMutation.isPending && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating…
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
