import DashboardLayout from "@/components/DashboardLayout";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CalendarDays,
  IndianRupee,
  Loader2,
  PartyPopper,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

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
  sortIndex: number | null;
};

type RegistrationRow = {
  id: number;
  reference: string;
  eventId: number;
  userId: number;
  attendeeName: string;
  contactEmail: string | null;
  numberOfParticipants: number;
  isCancelled: boolean;
  createdAt: Date;
};

function formatFees(pesewas: number): string {
  if (pesewas <= 0) return "Free";
  return `GH\u20B5 ${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminEvents() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.events.admin.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emptyForm = {
    title: "",
    description: "",
    eventType: "program" as "program" | "guided_tour",
    attractionId: "",
    eventDate: toDateStr(new Date()),
    startTime: "",
    endTime: "",
    meetingPoint: "",
    guideName: "",
    imageUrl: "",
    capacity: "25",
    feePesewas: "0",
    registrationDeadline: "",
    isPublished: false,
  };
  const [form, setForm] = useState(emptyForm);

  const { data: details } = trpc.events.admin.details.useQuery(
    { id: selectedId ?? -1 },
    { enabled: selectedId !== null },
  );

  const createMutation = trpc.events.admin.create.useMutation({
    onSuccess: () => {
      setDialogOpen(false);
      utils.events.admin.list.invalidate();
    },
    onError: err => setError(err.message),
  });
  const updateMutation = trpc.events.admin.update.useMutation({
    onSuccess: () => {
      setDialogOpen(false);
      utils.events.admin.list.invalidate();
      if (selectedId !== null) utils.events.admin.details.invalidate({ id: selectedId });
    },
    onError: err => setError(err.message),
  });
  const removeMutation = trpc.events.admin.remove.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      utils.events.admin.list.invalidate();
    },
    onError: err => setError(err.message),
  });
  const publishMutation = trpc.events.admin.update.useMutation({
    onSuccess: () => utils.events.admin.list.invalidate(),
  });
  const cancelRegMutation = trpc.events.admin.cancelRegistration.useMutation({
    onSuccess: () => {
      if (selectedId !== null) utils.events.admin.details.invalidate({ id: selectedId });
    },
  });

  const attractions = trpc.attractions.list.useQuery();

  const openDialog = (e?: EventRow) => {
    setEditing(e ?? null);
    setForm(
      e
        ? {
            title: e.title,
            description: e.description,
            eventType: e.eventType === "guided_tour" ? "guided_tour" : "program",
            attractionId: e.attractionId ? String(e.attractionId) : "",
            eventDate: toDateStr(e.eventDate),
            startTime: e.startTime ?? "",
            endTime: e.endTime ?? "",
            meetingPoint: e.meetingPoint ?? "",
            guideName: e.guideName ?? "",
            imageUrl: e.imageUrl ?? "",
            capacity: String(e.capacity),
            feePesewas: String(Math.round(e.feePesewas / 100)),
            registrationDeadline: e.registrationDeadline ? toDateStr(e.registrationDeadline) : "",
            isPublished: e.isPublished,
          }
        : emptyForm,
    );
    setError(null);
    setDialogOpen(true);
  };

  const set = (field: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const save = () => {
    if (!form.title.trim()) {
      setError("The event title is required.");
      return;
    }
    if (!form.description.trim()) {
      setError("A short description is required.");
      return;
    }
    const feeCedis = Number(form.feePesewas);
    if (!Number.isFinite(feeCedis) || feeCedis < 0) {
      setError("Please enter a valid fee (0 for free events).");
      return;
    }
    const capacity = Math.max(0, Number(form.capacity) || 0);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      eventType: form.eventType,
      attractionId: form.attractionId ? Number(form.attractionId) : undefined,
      eventDate: new Date(`${form.eventDate}T00:00:00Z`),
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      meetingPoint: form.meetingPoint || undefined,
      guideName: form.guideName || undefined,
      imageUrl: form.imageUrl || undefined,
      capacity,
      feePesewas: Math.round(feeCedis * 100),
      registrationDeadline: form.registrationDeadline
        ? new Date(`${form.registrationDeadline}T00:00:00Z`)
        : undefined,
      isPublished: form.isPublished,
    } as const;

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

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

  const isPast = (d: Date) => d < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Events &amp; programs</h1>
            <p className="text-sm text-muted-foreground">
              Publish special programs and guided tours; visitors register for guided
              tours directly from the public calendar.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button
              onClick={() => openDialog()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add event
            </Button>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {editing ? "Edit event" : "Add event or program"}
                </DialogTitle>
                <DialogDescription>
                  Guided tours can be registered for by visitors; programs are
                  open to all who visit the park on the day.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={e => set("title", e.target.value)}
                    placeholder="e.g. Mausoleum Guided Heritage Tour"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description *</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => set("description", e.target.value)}
                    placeholder="What visitors will experience…"
                    className="min-h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={form.eventType}
                      onValueChange={v => set("eventType", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guided_tour">Guided tour</SelectItem>
                        <SelectItem value="program">Special program</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Event date *</Label>
                    <Input
                      type="date"
                      value={form.eventDate}
                      onChange={e => set("eventDate", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Start time</Label>
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={e => set("startTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End time</Label>
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={e => set("endTime", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Attraction
                    <span className="text-muted-foreground ml-1">
                      (required for guided tours so visitors know where to meet)
                    </span>
                  </Label>
                  <Select
                    value={form.attractionId || "none"}
                    onValueChange={v => set("attractionId", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (general park)</SelectItem>
                      {(attractions.data ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Meeting point</Label>
                  <Input
                    value={form.meetingPoint}
                    onChange={e => set("meetingPoint", e.target.value)}
                    placeholder="e.g. Main gate entrance"
                  />
                </div>
                {form.eventType === "guided_tour" && (
                  <div className="space-y-1.5">
                    <Label>Guide name</Label>
                    <Input
                      value={form.guideName}
                      onChange={e => set("guideName", e.target.value)}
                      placeholder="e.g. Mr. Mensah"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Capacity (0 = unlimited)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.capacity}
                      onChange={e => set("capacity", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fee per participant (GHS)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.50"
                      value={form.feePesewas}
                      onChange={e => set("feePesewas", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Registration deadline</Label>
                    <Input
                      type="date"
                      value={form.registrationDeadline}
                      onChange={e => set("registrationDeadline", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Image URL</Label>
                    <Input
                      value={form.imageUrl}
                      onChange={e => set("imageUrl", e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={form.isPublished}
                    onCheckedChange={v => set("isPublished", v)}
                  />
                  <span>
                    <span className="font-medium">Publish</span>
                    <span className="text-muted-foreground ml-1">
                      (unpublished events stay visible only to administrators)
                    </span>
                  </span>
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={save}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Events list */}
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !events?.length ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground text-sm">
              No events yet. Click “Add event” to publish the first program or guided
              tour.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events
              .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
              .map((e: EventRow) => (
                <Card key={e.id} className="border-border">
                  <CardContent className="py-4 px-5 flex items-center gap-4 flex-wrap">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      {e.eventType === "guided_tour" ? (
                        <Scissors className="h-4.5 w-4.5 text-heritage" />
                      ) : (
                        <PartyPopper className="h-4.5 w-4.5 text-heritage" />
                      )}
                    </div>
                    <div className="flex-1 min-w-64">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{e.title}</p>
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                            e.eventType === "guided_tour"
                              ? "bg-gold/15 text-amber-700"
                              : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {e.eventType === "guided_tour" ? "Guided tour" : "Program"}
                        </span>
                        {e.isPublished ? (
                          <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                            Published
                          </span>
                        ) : (
                          <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5">
                            Draft
                          </span>
                        )}
                        {isPast(e.eventDate) && (
                          <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                            Past
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(e.eventDate)}
                          {e.startTime ? ` · ${e.startTime}` : ""}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {formatFees(e.feePesewas)}
                        </span>
                        {e.capacity > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {e.capacity} places
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mr-1">
                        <Switch
                          checked={e.isPublished}
                          onCheckedChange={v =>
                            publishMutation.mutate({
                              id: e.id,
                              isPublished: v,
                            })
                          }
                          disabled={publishMutation.isPending}
                        />
                        Published
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => openDialog(e)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setSelectedId(e.id)}
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (window.confirm(`Delete "${e.title}"?`)) {
                            await removeMutation.mutateAsync({ id: e.id });
                          }
                        }}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Registrations panel */}
        <Dialog open={selectedId !== null} onOpenChange={v => !v && setSelectedId(null)}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Registrations
                {details?.event ? ` — ${details.event.title}` : ""}
              </DialogTitle>
              <DialogDescription>
                Visitors registered for this event. Cancelled registrations are
                excluded from the capacity count.
              </DialogDescription>
            </DialogHeader>
            {!details ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-heritage" />
                  {details.activeParticipants} active participant group(s)
                  {details.event.capacity > 0
                    ? ` of ${details.event.capacity} capacity`
                    : " (unlimited capacity)"}
                </p>
                {details.registrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No registrations yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {details.registrations.map((r: RegistrationRow) => (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                          r.isCancelled ? "bg-muted/40" : "bg-card"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {r.attendeeName}
                            {r.isCancelled && (
                              <span className="ml-2 text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                                Cancelled
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.contactEmail ?? "No email"} · {r.numberOfParticipants}{" "}
                            participant{r.numberOfParticipants > 1 ? "s" : ""} · Ref{" "}
                            <span className="font-mono text-heritage">{r.reference}</span>
                          </p>
                        </div>
                        {!r.isCancelled && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cancelRegMutation.isPending}
                            onClick={() =>
                              cancelRegMutation.mutate({ id: r.id })
                            }
                          >
                            Cancel registration
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
