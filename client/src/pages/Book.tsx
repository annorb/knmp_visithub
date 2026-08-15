import VisitorLayout from "@/components/VisitorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Landmark,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type QtyMap = Record<number, number>;

/** Compute client-side group discount to preview it live in the summary. */
function groupDiscountFor(cat: {
  isGroup: boolean;
  groupMinQty: number | null;
  groupDiscountPercent: number | null;
  pricePesewas: number;
}, quantity: number): { discountPesewas: number; discountPercent: number } {
  if (!cat.isGroup) return { discountPesewas: 0, discountPercent: 0 };
  const minQty = cat.groupMinQty ?? 15;
  const percent = Math.min(100, Math.max(0, cat.groupDiscountPercent ?? 0));
  if (quantity < minQty || percent <= 0) return { discountPesewas: 0, discountPercent: 0 };
  return { discountPesewas: Math.round((cat.pricePesewas * quantity * percent) / 100), discountPercent: percent };
}

function groupRateHint(cat: {
  isGroup: boolean;
  groupMinQty: number | null;
  groupDiscountPercent: number | null;
}): string | null {
  if (!cat.isGroup || !(cat.groupDiscountPercent ?? 0)) return null;
  return `${cat.groupDiscountPercent ?? 0}% group rate from ${cat.groupMinQty ?? 15} visitors`;
}

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

export default function Book() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: categories, isLoading: catsLoading } = trpc.categories.list.useQuery();
  const { data: tourSlots } = trpc.tours.list.useQuery();

  const [visitDate, setVisitDate] = useState<Date | undefined>(undefined);
  const [visitEndDate, setVisitEndDate] = useState<Date | undefined>(undefined);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<QtyMap>({});
  const [visitorName, setVisitorName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Capacity projection for the selected visit date (public forecast). */
  const capacityQuery = trpc.bookings.capacityCheck.useQuery(
    { date: visitDate ?? new Date() },
    { enabled: Boolean(visitDate) },
  );

  const calculateMutation = trpc.bookings.calculateCost.useMutation();
  const createMutation = trpc.bookings.create.useMutation({
    onSuccess: () => {
      utils.bookings.myBookings.invalidate();
    },
  });

  const [confirmed, setConfirmed] = useState<{
    id: number;
    reference: string;
    total: number;
    visitors: number;
  } | null>(null);

  const ticketMutation = trpc.ticket.useMutation();

  const setQty = (categoryId: number, delta: number) => {
    setError(null);
    setQuantities(prev => {
      const next = { ...prev };
      const current = next[categoryId] ?? 0;
      const value = Math.max(0, Math.min(100, current + delta));
      if (value === 0) delete next[categoryId];
      else next[categoryId] = value;
      return next;
    });
  };

  const lines = useMemo(
    () =>
      Object.entries(quantities).map(([id, quantity]) => ({
        categoryId: Number(id),
        quantity,
      })),
    [quantities],
  );

  const totalVisitors = Object.values(quantities).reduce((s, q) => s + q, 0);
  const liveTotal = useMemo(() => {
    if (!categories) return 0;
    const map = new Map(categories.map(c => [c.id, c.pricePesewas]));
    return lines.reduce((s, l) => s + (map.get(l.categoryId) ?? 0) * l.quantity, 0);
  }, [lines, categories]);

  const cost = calculateMutation.data;

  const submit = async () => {
    setError(null);
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!visitDate) {
      setError("Please select a visit date.");
      return;
    }
    if (visitEndDate && visitEndDate < visitDate) {
      setError("The end date must not be earlier than the start date.");
      return;
    }
    if (lines.length === 0) {
      setError("Please select at least one visitor category.");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        visitDate,
        visitEndDate: visitEndDate && visitEndDate.getTime() !== visitDate.getTime() ? visitEndDate : undefined,
        slotIds: selectedSlots.length > 0 ? selectedSlots : undefined,
        lines,
        visitorName: visitorName || user?.name || undefined,
        contactEmail: contactEmail || user?.email || undefined,
        contactPhone: contactPhone || undefined,
        notes: notes || undefined,
      });
      setConfirmed({ id: result.id, reference: result.reference, total: cost?.totalPesewas ?? liveTotal, visitors: totalVisitors });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (confirmed) {
    return (
      <VisitorLayout>
        <div className="container py-16 md:py-24 max-w-2xl mx-auto text-center fade-up">
          <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-6">
            <Check className="h-8 w-8 text-heritage" />
          </div>
          <h1 className="font-display text-4xl font-semibold mb-3">Booking confirmed</h1>
          <p className="text-muted-foreground mb-8">
            Your visit to the Kwame Nkrumah Memorial Park is booked. Keep your
            reference for check-in at the gate.
          </p>
          <Card className="border-gold/50 shadow-md mb-8">
            <CardContent className="py-8">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Booking Reference
              </p>
              <p className="font-display text-3xl md:text-4xl font-semibold tracking-wide text-heritage mb-4">
                {confirmed.reference}
              </p>
              <div className="flex justify-center gap-8 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {visitEndDate && visitEndDate.getTime() !== visitDate!.getTime()
                    ? `${format(visitDate!, "d MMM yyyy")} – ${format(visitEndDate, "d MMM yyyy")}`
                    : format(visitDate!, "EEEE, d MMM yyyy")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Landmark className="h-4 w-4" />
                  {confirmed.visitors} visitor{confirmed.visitors === 1 ? "" : "s"}
                </span>
                <span className="font-semibold text-foreground">
                  {formatPrice(confirmed.total)}
                </span>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              onClick={async () => {
                try {
                  const { base64, filename } = await ticketMutation.mutateAsync({ id: confirmed.id });
                  const link = document.createElement("a");
                  link.href = `data:application/pdf;base64,${base64}`;
                  link.download = filename;
                  link.click();
                } catch {
                  setError("Could not generate the ticket — please try from My Bookings.");
                }
              }}
              disabled={ticketMutation.isPending}
            >
              <Ticket className="mr-2 h-4.5 w-4.5" />
              {ticketMutation.isPending ? "Generating…" : "Download entry ticket (PDF)"}
            </Button>
            <Link href="/bookings">
              <Button size="lg" variant="outline">
                View my bookings
              </Button>
            </Link>
            <Link href="/itinerary">
              <Button size="lg" variant="outline">
                Plan my itinerary
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </VisitorLayout>
    );
  }

  return (
    <VisitorLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="container py-12">
          <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
            Book a Visit
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-semibold mb-4">
            Reserve your day at the park
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Pick a date, tell us who is coming, and we will calculate your total
            instantly. A unique booking reference is generated the moment your
            booking is confirmed.
          </p>
        </div>
      </section>

      <section className="container py-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Step 1: Date */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                <span className="text-gold mr-2">1</span>Choose a visit date
              </CardTitle>
              <CardDescription>
                The park is open Monday–Saturday 9am–7pm and Sundays 10am–7pm. Booking
                a second date turns your visit into a multi-day experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 justify-start text-left font-normal w-full sm:w-64 bg-card",
                        !visitDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="mr-2 h-4.5 w-4.5 text-heritage" />
                      {visitDate ? format(visitDate, "EEEE, d MMMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={visitDate}
                      onSelect={date => {
                        setVisitDate(date);
                        setError(null);
                      }}
                      disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {visitDate && (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                    <Check className="h-3.5 w-3.5 text-heritage" />
                    {visitEndDate && visitEndDate.getTime() !== visitDate.getTime()
                      ? `${format(visitDate, "d MMM")} – ${format(visitEndDate, "d MMM yyyy")}`
                      : format(visitDate, "EEE, d MMM yyyy")}
                  </Badge>
                )}
              </div>
              {visitDate && (
                <div className="mt-5 pt-5 border-t border-border space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="multi-day"
                      checked={Boolean(visitEndDate)}
                      onCheckedChange={checked => {
                        setVisitEndDate(checked ? visitDate : undefined);
                        setError(null);
                      }}
                    />
                    <Label htmlFor="multi-day" className="text-sm">
                      Make this a multi-day visit
                    </Label>
                  </div>
                  {visitEndDate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-12 justify-start text-left font-normal w-full sm:w-64 bg-card",
                            !visitEndDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarDays className="mr-2 h-4.5 w-4.5 text-heritage" />
                          {format(visitEndDate, "EEEE, d MMMM yyyy")}
                          <span className="ml-auto text-xs text-muted-foreground">end date</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={visitEndDate}
                          onSelect={date => {
                            setVisitEndDate(date);
                            setError(null);
                          }}
                          disabled={date =>
                            date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                            date < visitDate ||
                            date.getTime() - visitDate.getTime() > 30 * 24 * 60 * 60 * 1000
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                <span className="text-gold mr-2">2</span>Who is visiting?
              </CardTitle>
              <CardDescription>
                Select the number of visitors in each category. Costs update
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {catsLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(categories ?? []).map(cat => {
                    const qty = quantities[cat.id] ?? 0;
                    const hint = groupRateHint(cat);
                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3",
                          cat.isGroup ? "border-gold/60" : "border-border",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{cat.name}</p>
                          {hint && (
                            <p className="text-xs font-medium mt-0.5 text-amber-700 flex items-center gap-1">
                              <Ticket className="h-3 w-3" />
                              {hint}
                            </p>
                          )}
                          {!hint && cat.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold w-14 text-right">
                            {formatPrice(cat.pricePesewas)}
                          </span>
                          <div className="flex items-center border border-border rounded-md">
                            <button
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-heritage disabled:opacity-30 transition-colors"
                              onClick={() => setQty(cat.id, -1)}
                              disabled={qty === 0}
                              aria-label={`Reduce ${cat.name}`}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-9 text-center text-sm font-semibold">
                              {qty}
                            </span>
                            <button
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-heritage transition-colors"
                              onClick={() => setQty(cat.id, +1)}
                              aria-label={`Add ${cat.name}`}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Guided tour slots */}
          {/* (numbering kept; contact details step is 4) */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                <span className="text-gold mr-2">3</span>Guided tour time slots
              </CardTitle>
              <CardDescription>
                Optional — reserve guided-tour slots at any attraction. Group size is
                limited to 25 visitors per slot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!tourSlots || tourSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No guided-tour slots are currently available.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {tourSlots.map(slot => {
                    const checked = selectedSlots.includes(slot.id);
                    return (
                      <label
                        key={slot.id}
                        htmlFor={`slot-${slot.id}`}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3.5 py-3 cursor-pointer transition-colors",
                          checked
                            ? "border-heritage bg-accent/60"
                            : "border-border bg-card hover:border-gold/50",
                        )}
                      >
                        <Checkbox
                          id={`slot-${slot.id}`}
                          checked={checked}
                          onCheckedChange={c => {
                            setSelectedSlots(prev =>
                              c ? [...prev, slot.id] : prev.filter(i => i !== slot.id),
                            );
                            setError(null);
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {slot.attractionName ?? "Guided tour"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {slot.label ?? `${slot.startTime} – ${slot.endTime}`}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4: Contact details */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                <span className="text-gold mr-2">4</span>Your details
              </CardTitle>
              <CardDescription>
                Optional — we prefill from your account when you are signed in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={visitorName}
                    onChange={e => setVisitorName(e.target.value)}
                    placeholder={user?.name ?? "Your name"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder={user?.email ?? "you@example.com"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Anything our team should know about your visit…"
                    className="min-h-20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <Card className="border-heritage/30 shadow-md">
              <CardHeader>
                <CardTitle className="font-display text-xl">Booking summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {visitEndDate && visitEndDate.getTime() !== visitDate?.getTime()
                      ? "Visit dates"
                      : "Visit date"}
                  </span>
                  <span className="font-medium">
                    {visitDate
                      ? visitEndDate && visitEndDate.getTime() !== visitDate.getTime()
                        ? `${format(visitDate, "d MMM")} – ${format(visitEndDate, "d MMM yyyy")}`
                        : format(visitDate, "d MMM yyyy")
                      : "—"}
                  </span>
                </div>
                {Object.entries(quantities).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select visitor categories to see your total.
                  </p>
                ) : (
                  <div className="space-y-2 border-t border-border pt-3">
                    {lines.map(line => {
                      const cat = categories?.find(c => c.id === line.categoryId);
                      const disc = cat ? groupDiscountFor(cat, line.quantity) : { discountPesewas: 0, discountPercent: 0 };
                      return (
                        <div key={line.categoryId} className="space-y-0.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {cat?.name ?? "Category"} × {line.quantity}
                            </span>
                            <span>
                              {cat ? formatPrice(cat.pricePesewas * line.quantity) : "—"}
                            </span>
                          </div>
                          {disc.discountPesewas > 0 && (
                            <div className="flex items-center justify-between text-xs text-amber-700 font-medium pl-1">
                              <span>
                                Group package −{disc.discountPercent}% applied
                              </span>
                              <span>−{formatPrice(disc.discountPesewas)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-3 border-t border-border font-semibold">
                      <span>Total visitors</span>
                      <span>{totalVisitors}</span>
                    </div>
                    {selectedSlots.length > 0 && (
                      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                        <span>Guided tours selected</span>
                        <span>{selectedSlots.length}</span>
                      </div>
                    )}
                    {(() => {
                      const totalDiscount = lines.reduce((sum, line) => {
                        const cat = categories?.find(c => c.id === line.categoryId);
                        return sum + (cat ? groupDiscountFor(cat, line.quantity).discountPesewas : 0);
                      }, 0);
                      const baseTotal = lines.reduce((sum, line) => {
                        const cat = categories?.find(c => c.id === line.categoryId);
                        return sum + (cat ? cat.pricePesewas * line.quantity : 0);
                      }, 0);
                      return totalDiscount > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-sm text-amber-700 font-medium">
                            <span>Group/school package discount</span>
                            <span>−{formatPrice(totalDiscount)}</span>
                          </div>
                          {cost ? (
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Before discount</span>
                              <span>{formatPrice(baseTotal)}</span>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between pt-1 font-display text-xl text-heritage">
                            <span>Estimated total</span>
                            <span>{formatPrice(cost ? cost.totalPesewas : baseTotal - totalDiscount)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between pt-1 font-display text-xl text-heritage">
                          <span>Estimated total</span>
                          <span>
                            {cost ? formatPrice(cost.totalPesewas) : formatPrice(liveTotal)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {visitDate &&
                  (() => {
                    const cap = capacityQuery.data;
                    const over = cap
                      ? cap.isOver || (cap.isNear && cap.projectedVisitors + totalVisitors > cap.capacity)
                      : false;
                    const near = cap?.isNear === true && !over;
                    return (
                      <div className="border-t border-border pt-3">
                        {capacityQuery.isLoading ? (
                          <Skeleton className="h-14 w-full" />
                        ) : cap ? (
                          over ? (
                            <p className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2.5 leading-relaxed">
                              <strong>High demand:</strong> {cap.projectedVisitors} visitors are already
                              projected for {format(visitDate, "d MMM yyyy")} against a daily limit of{" "}
                              {cap.capacity}. Your party of {totalVisitors || "—"} would exceed the remaining
                              capacity. Consider choosing another date.
                            </p>
                          ) : near ? (
                            <p className="text-sm rounded-md bg-amber-50 text-amber-700 px-3 py-2.5 leading-relaxed border border-amber-200">
                              <strong>Almost full:</strong> {cap.projectedVisitors} visitors are already
                              projected for {format(visitDate, "d MMM yyyy")} (limit {cap.capacity}). Your
                              party would leave little spare capacity — booking early is recommended.
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5 text-heritage" />
                              {cap.projectedVisitors} visitors projected for{" "}
                              {format(visitDate, "d MMM yyyy")} — comfortable availability.
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Capacity projection unavailable for past dates.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                {error && (
                  <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                    {error}
                  </p>
                )}
                <Button
                  size="lg"
                  className="w-full h-12"
                  onClick={submit}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? "Confirming…"
                    : isAuthenticated
                      ? "Confirm booking"
                      : "Sign in to continue"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground text-center">
                    You will be signed in securely via your account before the
                    booking is confirmed.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </VisitorLayout>
  );
}
