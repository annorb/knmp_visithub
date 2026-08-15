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
import { useMemo } from "react";
import { format } from "date-fns";
import { Eye, Loader2, QrCode, XCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

type BookingRow = {
  id: number;
  reference: string;
  userId: number;
  userName: string | null;
  visitDate: Date;
  visitEndDate: Date | null;
  visitorName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  totalPesewas: number;
  status: "pending" | "confirmed" | "cancelled";
  notes: string | null;
  checkInAt: Date | null;
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
  const [checkInFilter, setCheckInFilter] = useState<"all" | "checkedIn" | "notCheckedIn">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: detail } = trpc.bookings.byId.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId !== null },
  );
  const { data: tourSlots } = trpc.tours.list.useQuery();
  const slotTimes = useMemo(() => {
    const map = new Map<number, { start: string; end: string }>();
    for (const s of tourSlots ?? []) map.set(s.id, { start: s.startTime, end: s.endTime });
    return map;
  }, [tourSlots]);

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold">Bookings</h1>
              <p className="text-sm text-muted-foreground">
                Every visitor booking on the platform. Use the status control to
                confirm arrivals or record cancellations.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-input bg-background p-1">
              {(
                [
                  { value: "all", label: "All", icon: ShieldCheck },
                  { value: "checkedIn", label: "Checked in", icon: QrCode },
                  { value: "notCheckedIn", label: "Not checked in", icon: XCircle },
                ] as const
              ).map(opt => {
                const Icon = opt.icon;
                const active = checkInFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCheckInFilter(opt.value)}
                    className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-heritage text-white"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
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
        ) : !(() => {
            if (checkInFilter === "checkedIn") return rows.some(r => r.checkInAt);
            if (checkInFilter === "notCheckedIn") return rows.some(r => !r.checkInAt);
            return true;
          })() ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground text-sm">
              No bookings match the selected check-in filter.
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
                    <TableHead>Visit dates</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows]
                    .filter(row => {
                      if (checkInFilter === "checkedIn") return Boolean(row.checkInAt);
                      if (checkInFilter === "notCheckedIn") return !row.checkInAt;
                      return true;
                    })
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
                          {(() => {
                            const start = new Date(row.visitDate);
                            const end = row.visitEndDate ? new Date(row.visitEndDate) : null;
                            const multi = end && end.getTime() !== start.getTime();
                            return multi
                              ? `${format(start, "d MMM")} – ${format(end!, "d MMM yyyy")}`
                              : format(start, "d MMM yyyy");
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(row.totalPesewas)}
                        </TableCell>
                        <TableCell>
                          {row.checkInAt ? (
                            <Badge className="bg-heritage/15 text-heritage hover:bg-heritage/20">
                              Checked in {format(new Date(row.checkInAt), "d MMM HH:mm")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusStyles[row.status] ?? "secondary"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`/admin/gate?ref=${row.reference}`, "_blank")}
                            aria-label="Check in at gate"
                          >
                            <QrCode className="h-4 w-4 text-muted-foreground" />
                          </Button>
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
                  {(() => {
                    const start = new Date(selected.visitDate);
                    const end = selected.visitEndDate ? new Date(selected.visitEndDate) : null;
                    const multi = end && end.getTime() !== start.getTime();
                    return multi
                      ? `${format(start, "EEEE, d MMMM yyyy")} – ${format(end!, "EEEE, d MMMM yyyy")} (multi-day)`
                      : format(start, "EEEE, d MMMM yyyy");
                  })()}
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
              {detail?.slots?.length ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Guided tour slots
                  </p>
                  <div className="space-y-1.5">
                    {detail.slots.map(slot => (
                      <div key={slot.id} className="flex justify-between rounded bg-accent px-3 py-1.5">
                        <span>{slot.attractionName ?? "Guided tour"}</span>
                        <span className="font-medium text-muted-foreground">
                          {format(new Date(slot.visitDate), "d MMM yyyy")} ·{" "}
                          {slotTimes.get(slot.slotId)?.start ?? ""} – {slotTimes.get(slot.slotId)?.end ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
