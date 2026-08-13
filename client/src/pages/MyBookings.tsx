import VisitorLayout from "@/components/VisitorLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";
import { startLogin } from "@/const";
import {
  AlertCircle,
  CalendarDays,
  Loader2,
  LogIn,
  NotebookPen,
  Ticket,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

const statusStyles: Record<string, "secondary" | "default" | "destructive"> = {
  confirmed: "secondary",
  pending: "default",
  cancelled: "destructive",
};

export default function MyBookings() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const { data: bookings, isLoading } = trpc.bookings.myBookings.useQuery();
  const { data: bookingsDetail } = trpc.bookings.myBookingsDetail.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const visitorTotals = useMemo(() => {
    const map = new Map<number, number>();
    for (const bd of bookingsDetail ?? []) {
      map.set(
        bd.booking.id,
        bd.items.reduce((s, i) => s + i.quantity, 0),
      );
    }
    return map;
  }, [bookingsDetail]);
  const cancelMutation = trpc.bookings.cancel.useMutation({
    onMutate: async variables => {
      await utils.bookings.myBookings.cancel();
      const previous = utils.bookings.myBookings.getData();
      utils.bookings.myBookings.setData(undefined, old =>
        old?.map(b => (b.id === variables.id ? { ...b, status: "cancelled" as const } : b)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      utils.bookings.myBookings.setData(undefined, context?.previous);
    },
    onSettled: () => {
      utils.bookings.myBookings.invalidate();
    },
  });

  if (loading) {
    return (
      <VisitorLayout>
        <div className="container py-16">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-40 w-full" />
        </div>
      </VisitorLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <VisitorLayout>
        <div className="container py-24 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-6">
            <LogIn className="h-8 w-8 text-heritage" />
          </div>
          <h1 className="font-display text-3xl font-semibold mb-3">Sign in to view your bookings</h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Your bookings are personal to your account. Sign in to see, manage,
            and cancel them.
          </p>
          <Button size="lg" onClick={() => startLogin()} className="h-12 px-8">
            <LogIn className="mr-2 h-4.5 w-4.5" />
            Sign in
          </Button>
        </div>
      </VisitorLayout>
    );
  }

  return (
    <VisitorLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="container py-12">
          <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
            My Bookings
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-semibold mb-4">
            Your visits to the park
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            All bookings made with your account. Keep your booking reference
            handy for check-in at the gate.
          </p>
        </div>
      </section>

      <section className="container py-12">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : !bookings?.length ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <Ticket className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="font-display text-2xl font-semibold mb-2">No bookings yet</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                You have not booked a visit to the Kwame Nkrumah Memorial Park.
                Book your first visit in under two minutes.
              </p>
              <Link href="/book">
                <Button className="h-11 px-6">
                  <Ticket className="mr-2 h-4.5 w-4.5" />
                  Book a visit
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {[...bookings]
              .sort((a, b) => (a.visitDate as Date).getTime() - (b.visitDate as Date).getTime())
              .map(booking => (
                <Card key={booking.id} className="border-border">
                  <CardContent className="py-5 px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-display text-xl font-semibold text-heritage tracking-wide">
                            {booking.reference}
                          </p>
                          <Badge variant={statusStyles[booking.status] ?? "secondary"}>
                            {booking.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-heritage" />
                            {format(new Date(booking.visitDate), "EEEE, d MMMM yyyy")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Ticket className="h-4 w-4 text-heritage" />
                            {(visitorTotals.get(booking.id) ?? 0)} visitor{(visitorTotals.get(booking.id) ?? 0) === 1 ? "" : "s"}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatPrice(booking.totalPesewas)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {booking.status !== "cancelled" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <XCircle className="mr-1.5 h-4 w-4" />
                                Cancel
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display text-xl">
                                  Cancel this booking?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will cancel booking {booking.reference} for{" "}
                                  {format(new Date(booking.visitDate), "d MMM yyyy")}. You can
                                  book a new visit at any time.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelMutation.mutate({ id: booking.id })}
                                  disabled={cancelMutation.isPending}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {cancelMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Yes, cancel booking
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    {(booking.notes || booking.contactPhone) && (
                      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                        {booking.contactPhone && <p>Phone: {booking.contactPhone}</p>}
                        {booking.notes && <p>Notes: {booking.notes}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            <div className="flex justify-center pt-6">
              <Link href="/itinerary">
                <Button variant="outline">
                  <NotebookPen className="mr-2 h-4 w-4" />
                  Plan my itinerary
                </Button>
              </Link>
            </div>
          </div>
        )}
        {cancelMutation.isError && (
          <div className="max-w-3xl mx-auto mt-4 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to cancel the booking. Please try again.
          </div>
        )}
      </section>
    </VisitorLayout>
  );
}
