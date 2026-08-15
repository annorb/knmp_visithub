import VisitorLayout from "@/components/VisitorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  IndianRupee,
  Loader2,
  MapPin,
  PartyPopper,
  Scissors,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type EventRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  eventType: string;
  attractionId: number | null;
  eventDate: Date;
  startTime: string | null;
  endTime: string | null;
  meetingPoint: string | null;
  guideName: string | null;
  imageUrl: string | null;
  capacity: number;
  feePesewas: number;
  registrationDeadline: Date | null;
  isPublished: boolean;
  sortIndex: number;
};

function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFees(pesewas: number): string {
  if (pesewas <= 0) return "Free";
  return `GH\u20B5 ${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

function formatEventDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayKey(): string {
  return dateKey(new Date());
}

export default function Events() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [openDetails, setOpenDetails] = useState(false);
  const [showMyEvents, setShowMyEvents] = useState(true);

  const { data: monthEvents, isLoading: monthLoading } = trpc.events.listMonth.useQuery({
    year,
    month,
  });
  const { data: upcoming, isLoading: upcomingLoading } = trpc.events.upcoming.useQuery();
  const { data: details, isLoading: detailsLoading } = trpc.events.details.useQuery(
    { id: detailsId ?? -1 },
    { enabled: openDetails && detailsId !== null },
  );
  const { user, isAuthenticated } = useAuth();
  const { data: myRegistrations, isLoading: myLoading } = trpc.events.myRegistrations.useQuery(
    undefined,
    { enabled: isAuthenticated && showMyEvents },
  );

  const register = trpc.events.register.useMutation({
    onSuccess: data => {
      setOpenDetails(false);
      toast.success(`Registration confirmed! Reference: ${data.reference}`, {
        description:
          "A confirmation email is on its way. You can also view this registration in the page below.",
      });
      utils.events.myRegistrations.invalidate();
      utils.events.details.invalidate();
    },
    onError: err => toast.error(err.message),
  });
  const cancelReg = trpc.events.cancelRegistration.useMutation({
    onSuccess: () => {
      toast.success("Registration cancelled.");
      utils.events.myRegistrations.invalidate();
      utils.events.details.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  const eventsByKey = new Map<string, EventRow[]>();
  for (const e of monthEvents ?? []) {
    const key = dateKey(e.eventDate);
    const list = eventsByKey.get(key) ?? [];
    list.push(e as EventRow);
    eventsByKey.set(key, list);
  }

  // Build the month grid (Mon–Sun).
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = (first.getUTCDay() + 6) % 7; // Monday = 0
  const grid: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(Date.UTC(year, month - 1, d)));
  while (grid.length % 7 !== 0) grid.push(null);

  const isGuidedTour = (e: EventRow) => e.eventType === "guided_tour";

  return (
    <VisitorLayout>
      {/* Page header */}
      <section className="relative overflow-hidden bg-heritage">
        <div className="container py-16 md:py-20">
          <div className="max-w-2xl fade-up">
            <div className="kente-rule w-16 mb-6" />
            <p className="text-gold uppercase tracking-[0.28em] text-xs font-medium mb-4">
              Kwame Nkrumah Memorial Park
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-semibold text-white leading-tight mb-4">
              Park events &amp; guided tours
            </h1>
            <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-xl">
              Special programs, commemoration days and guided walks through the
              mausoleum, museum and gardens. Browse the calendar and register for
              guided tours directly.
            </p>
          </div>
        </div>
      </section>

      <div className="container py-10 space-y-10">
        {/* Interactive month calendar */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-heritage" />
              Events calendar
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (month === 1) {
                    setYear(y => y - 1);
                    setMonth(12);
                  } else setMonth(m => m - 1);
                }}
                aria-label="Previous month"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-44 text-center">
                {MONTHS[month - 1]} {year}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (month === 12) {
                    setYear(y => y + 1);
                    setMonth(1);
                  } else setMonth(m => m + 1);
                }}
                aria-label="Next month"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setYear(now.getFullYear());
                  setMonth(now.getMonth() + 1);
                }}
              >
                Today
              </Button>
            </div>
          </div>

          {monthLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <div
                className="w-full bg-secondary/70"
                style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
              >
                {WEEKDAYS.map(w => (
                  <div
                    key={w}
                    className="py-2 text-center text-xs uppercase tracking-wider font-medium text-muted-foreground"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div
                className="w-full"
                style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
              >
                {grid.map((d, i) => {
                  if (!d) return <div key={`pad-${i}`} className="min-h-20 border-t border-border bg-secondary/30" />;
                  const key = dateKey(d);
                  const events = eventsByKey.get(key) ?? [];
                  const isToday = key === todayKey();
                  const hasEvent = events.length > 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!hasEvent}
                      onClick={() => {
                        setSelectedKey(key);
                        if (events.length === 1) {
                          setDetailsId(events[0].id);
                          setOpenDetails(true);
                        }
                      }}
                      className={`min-h-20 border-t border-l border-border p-1.5 text-left transition-colors ${
                        i % 7 === 0 ? "border-l-0" : ""
                      } ${hasEvent ? "hover:bg-accent/60 cursor-pointer" : "cursor-default"} ${
                        isToday ? "bg-heritage/5" : ""
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                          isToday ? "bg-heritage text-heritage-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {d.getUTCDate()}
                      </span>
                      {events.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {events.slice(0, 2).map(e => (
                            <span
                              key={e.id}
                              className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                                isGuidedTour(e)
                                  ? "bg-gold/15 text-gold-foreground"
                                  : "bg-accent text-accent-foreground"
                              }`}
                              title={e.title}
                            >
                              {e.title}
                            </span>
                          ))}
                          {events.length > 2 && (
                            <span className="block text-[10px] text-muted-foreground pl-1">
                              +{events.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 px-3 py-2 bg-secondary/40 text-xs text-muted-foreground border-t border-border">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold/60" />
                  Guided tour
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  Program
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-heritage/20 flex items-center justify-center text-[10px] font-medium text-heritage">
                    {new Date().getUTCDate()}
                  </span>
                  Today
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Upcoming events list */}
        <section>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2 mb-6">
            <PartyPopper className="h-6 w-6 text-heritage" />
            Upcoming events
          </h2>
          {upcomingLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : (upcoming ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No upcoming events are scheduled at the moment. Check back soon!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(upcoming as EventRow[]).map(e => {
                const isTour = isGuidedTour(e);
                return (
                  <Card key={e.id} className="flex flex-col overflow-hidden group">
                    {e.imageUrl && (
                      <div
                        className="h-40 bg-cover bg-center group-hover:scale-[1.02] transition-transform duration-300"
                        style={{ backgroundImage: `url(${e.imageUrl})` }}
                      />
                    )}
                    <CardContent className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Badge variant={isTour ? "default" : "secondary"}>
                          {isTour ? "Guided tour" : "Special program"}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {e.startTime ?? ""}
                          {e.endTime ? ` – ${e.endTime}` : ""}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-semibold mb-1.5 leading-snug">
                        {e.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">
                        {e.description}
                      </p>
                      <div className="mt-auto space-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-heritage shrink-0" />
                          {formatEventDate(e.eventDate)}
                        </span>
                        {e.attractionId && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-heritage shrink-0" />
                            {e.meetingPoint ?? "See event details"}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <IndianRupee className="h-3.5 w-3.5 text-heritage shrink-0" />
                          {formatFees(e.feePesewas)}
                          {e.capacity > 0 ? ` · Up to ${e.capacity} participants` : ""}
                        </span>
                      </div>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => {
                          setDetailsId(e.id);
                          setOpenDetails(true);
                        }}
                      >
                        {isTour ? "Register for this tour" : "View details"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* My registrations (logged-in visitors) */}
        {isAuthenticated && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                <Scissors className="h-6 w-6 text-heritage" />
                My tour registrations
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowMyEvents(v => !v)}>
                {showMyEvents ? "Hide" : "Show"}
              </Button>
            </div>
            {showMyEvents && (
              myLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (myRegistrations ?? []).filter(r => !r.registration.isCancelled).length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    You have not registered for any guided tours yet. Pick a tour from the
                    calendar above and register to reserve your place.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {(myRegistrations ?? []).map(r => {
                    const e = r.event as EventRow | null;
                    if (!e) return null;
                    const cancelled = r.registration.isCancelled;
                    return (
                      <Card key={r.registration.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="flex-1 min-w-48">
                          <p className="font-medium">{e.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatEventDate(e.eventDate)}
                            {e.startTime ? ` · ${e.startTime}` : ""}
                            {e.endTime ? ` – ${e.endTime}` : ""}
                            {" · "}
                            {r.registration.numberOfParticipants} participant
                            {r.registration.numberOfParticipants > 1 ? "s" : ""}
                            {" · Ref "}
                            <span className="font-mono text-heritage">
                              {r.registration.reference}
                            </span>
                          </p>
                        </div>
                        {cancelled ? (
                          <Badge variant="secondary">Cancelled</Badge>
                        ) : e.eventDate < new Date() ? (
                          <Badge className="bg-gold text-gold-foreground">Past event</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelReg.mutate({ id: r.registration.id })}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )
            )}
          </section>
        )}
      </div>

      {/* Event details + registration dialog */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="max-w-lg">
          {detailsLoading ? (
            <div className="py-8">
              <Skeleton className="h-40 w-full mb-4" />
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : details ? (
            <EventDetailsDialog
              event={details.event as EventRow}
              attractionName={details.attractionName}
              remainingPlaces={details.remainingPlaces}
              registrationOpen={details.registrationOpen}
              capacityFull={details.capacityFull}
              activeParticipants={details.activeParticipants}
              isGuidedTour={isGuidedTour(details.event as EventRow)}
              requireLogin={!isAuthenticated}
              onSubmit={data =>
                register.mutate({
                  eventId: details.event.id,
                  attendeeName: data.attendeeName,
                  contactEmail: data.contactEmail,
                  numberOfParticipants: data.numberOfParticipants,
                })
              }
              submitting={register.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </VisitorLayout>
  );
}

function EventDetailsDialog({
  event,
  attractionName,
  remainingPlaces,
  registrationOpen,
  capacityFull,
  activeParticipants,
  isGuidedTour,
  requireLogin,
  onSubmit,
  submitting,
}: {
  event: EventRow;
  attractionName: string | null;
  remainingPlaces: number | null;
  registrationOpen: boolean;
  capacityFull: boolean;
  activeParticipants: number;
  isGuidedTour: boolean;
  requireLogin: boolean;
  onSubmit: (data: { attendeeName: string; contactEmail: string; numberOfParticipants: number }) => void;
  submitting: boolean;
}) {
  const [attendeeName, setAttendeeName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [numberOfParticipants, setNumberOfParticipants] = useState("1");

  const deadlineReached = !registrationOpen;
  const full = capacityFull;

  return (
    <div>
      <DialogHeader>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={isGuidedTour ? "default" : "secondary"}>
            {isGuidedTour ? "Guided tour" : "Special program"}
          </Badge>
          {attractionName && (
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              {attractionName}
            </Badge>
          )}
        </div>
        <DialogTitle className="text-left">{event.title}</DialogTitle>
        <DialogDescription className="text-left whitespace-pre-line">
          {event.description}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-heritage shrink-0" />
          <span>
            {formatEventDate(event.eventDate)}
            {event.startTime ? ` · ${event.startTime}` : ""}
            {event.endTime ? ` – ${event.endTime}` : ""}
          </span>
        </div>
        {event.meetingPoint && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-heritage shrink-0" />
            Meet at: {event.meetingPoint}
          </div>
        )}
        {event.guideName && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 text-heritage shrink-0" />
            Guide: {event.guideName}
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <IndianRupee className="h-4 w-4 text-heritage shrink-0" />
          {formatFees(event.feePesewas)} per participant
        </div>
        {isGuidedTour && event.capacity > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 text-heritage shrink-0" />
            {remainingPlaces} place{remainingPlaces === 1 ? "" : "s"} remaining
            ({activeParticipants} registered)
          </div>
        )}
        {event.registrationDeadline && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-heritage shrink-0" />
            Registration closes {formatEventDate(event.registrationDeadline)}
          </div>
        )}
      </div>

      {isGuidedTour && (full || deadlineReached) && (
        <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {full
            ? "This tour has reached its capacity. Check the calendar for other available dates."
            : "Registration for this event has closed."}
        </div>
      )}

      {isGuidedTour && !full && !deadlineReached && (
        <>
          {requireLogin ? (
            <div className="mt-4 rounded-md bg-accent border border-border px-4 py-4 text-sm">
              <p className="mb-3 text-foreground">
                Please sign in to reserve your place on this guided tour. You will
                receive a confirmation email with your registration reference.
              </p>
              <Button onClick={() => startLogin()}>Sign in to register</Button>
            </div>
          ) : (
            <form
              className="mt-5 space-y-3.5"
              onSubmit={e => {
                e.preventDefault();
                const n = parseInt(numberOfParticipants, 10);
                if (!attendeeName.trim()) {
                  toast.error("Please enter the attendee name.");
                  return;
                }
                if (remainingPlaces !== null && n > remainingPlaces) {
                  toast.error(`Only ${remainingPlaces} place(s) remaining.`);
                  return;
                }
                onSubmit({
                  attendeeName: attendeeName.trim(),
                  contactEmail: contactEmail.trim(),
                  numberOfParticipants: n,
                });
              }}
            >
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-heritage" />
                Reserve a place
              </h4>
              <div className="space-y-2">
                <Label htmlFor="attendee-name" className="text-xs">
                  Attendee name
                </Label>
                <Input
                  id="attendee-name"
                  value={attendeeName}
                  onChange={e => setAttendeeName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-xs">
                  Contact email
                  <span className="text-muted-foreground ml-1">
                    (your account email is used if left blank)
                  </span>
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party-size" className="text-xs">
                  Party size
                </Label>
                <Input
                  id="party-size"
                  type="number"
                  min={1}
                  max={Math.min(50, remainingPlaces ?? 50)}
                  value={numberOfParticipants}
                  onChange={e => setNumberOfParticipants(e.target.value)}
                />
              </div>
              {event.feePesewas > 0 && (
                <p className="text-xs text-muted-foreground">
                  Fee of {formatFees(event.feePesewas)} per participant, payable at the
                  meeting point.
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Complete registration
                </Button>
              </DialogFooter>
            </form>
          )}
        </>
      )}

      {!isGuidedTour && (
        <p className="mt-4 text-sm text-muted-foreground">
          This is a special park program open to all visitors. No registration is
          required — simply visit the park on the day and join in at the meeting
          point.
        </p>
      )}
    </div>
  );
}
