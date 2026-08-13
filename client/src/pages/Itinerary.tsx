import VisitorLayout from "@/components/VisitorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Clock,
  Landmark,
  LogIn,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

type Item = {
  id: number;
  visitDate: Date;
  title: string;
  description: string | null;
  timeSlot: string | null;
  attractionId: number | null;
  attractionName: string | null;
  bookingId: number | null;
  sortIndex: number | null;
};

const timeSlots = [
  "9:00 am", "10:00 am", "11:00 am", "12:00 pm",
  "1:00 pm", "2:00 pm", "3:00 pm", "4:00 pm",
  "5:00 pm", "6:00 pm", "7:00 pm",
];

function groupByDate(items: Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.visitDate.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  Array.from(groups.values()).forEach(list => {
    list.sort((a: Item, b: Item) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  });
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({ date: list[0].visitDate, key, items: list }));
}

export default function Itinerary() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.itineraries.list.useQuery();
  const { data: attractions } = trpc.attractions.list.useQuery();
  const { data: bookings } = trpc.bookings.myUpcomingBookings.useQuery();

  const createMutation = trpc.itineraries.create.useMutation({
    onSettled: () => utils.itineraries.list.invalidate(),
  });
  const updateMutation = trpc.itineraries.update.useMutation({
    onSettled: () => utils.itineraries.list.invalidate(),
  });
  const removeMutation = trpc.itineraries.remove.useMutation({
    onSettled: () => utils.itineraries.list.invalidate(),
  });
  const reorderMutation = trpc.itineraries.reorder.useMutation({
    onSettled: () => utils.itineraries.list.invalidate(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeSlot, setTimeSlot] = useState("10:00 am");
  const [visitDate, setVisitDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [attractionId, setAttractionId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openDialog = (item?: Item) => {
    setEditing(item ?? null);
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setTimeSlot(item?.timeSlot ?? "10:00 am");
    setVisitDate(
      item ? (item.visitDate as Date).toISOString().slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
    );
    setAttractionId(item?.attractionId ? String(item.attractionId) : "");
    setBookingId(item?.bookingId ? String(item.bookingId) : "");
    setError(null);
    setDialogOpen(true);
  };

  const saveItem = async () => {
    if (!title.trim()) {
      setError("Please give the activity a title.");
      return;
    }
    const payload = {
      visitDate: new Date(`${visitDate}T09:00:00.000Z`),
      title: title.trim(),
      description: description.trim() || null,
      timeSlot: timeSlot,
      attractionId: attractionId ? Number(attractionId) : null,
      bookingId: bookingId ? Number(bookingId) : null,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const moveItem = async (item: Item, direction: "up" | "down") => {
    const newIndex = (direction === "up" ? item.sortIndex ?? 0 : item.sortIndex ?? 0) + (direction === "up" ? -1 : 1);
    if (newIndex < 0) return;
    await reorderMutation.mutateAsync({ id: item.id, sortIndex: newIndex });
  };

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
            <NotebookPen className="h-8 w-8 text-heritage" />
          </div>
          <h1 className="font-display text-3xl font-semibold mb-3">Sign in to plan your itinerary</h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Your visit plan is saved to your account. Sign in to create, edit and
            manage your day at the park.
          </p>
          <Button size="lg" onClick={() => startLogin()} className="h-12 px-8">
            <LogIn className="mr-2 h-4.5 w-4.5" />
            Sign in
          </Button>
        </div>
      </VisitorLayout>
    );
  }

  const groups = groupByDate(items ?? []);

  return (
    <VisitorLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="container py-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
              Personal Itinerary
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-semibold mb-4">
              Plan your perfect day
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Build a day-plan of activities and attractions for each day of
              your visit. Tip from the itinerary builder — the mausoleum, museum
              and gardens comfortably fill a morning.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12 px-6">
                <Plus className="mr-2 h-4.5 w-4.5" />
                Add activity
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {editing ? "Edit activity" : "Add an activity"}
                </DialogTitle>
                <DialogDescription>
                  Activities can be linked to a park attraction and/or a booking.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="it-title">Title</Label>
                  <Input
                    id="it-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Visit the mausoleum"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Visit date</Label>
                    <Input
                      type="date"
                      value={visitDate}
                      onChange={e => setVisitDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Select value={timeSlot} onValueChange={setTimeSlot}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map(t => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Park attraction (optional)</Label>
                  <Select value={attractionId} onValueChange={setAttractionId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose an attraction" />
                    </SelectTrigger>
                    <SelectContent>
                      {(attractions ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Related booking (optional)</Label>
                  <Select value={bookingId} onValueChange={setBookingId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose a booking" />
                    </SelectTrigger>
                    <SelectContent>
                      {(bookings ?? []).map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.reference} · {format(new Date(b.visitDate), "d MMM yyyy")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="it-desc">Notes (optional)</Label>
                  <Textarea
                    id="it-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What to see, reminders…"
                    className="min-h-16"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              <DialogFooter>
                {editing && (
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={async () => {
                      await removeMutation.mutateAsync({ id: editing.id });
                      setDialogOpen(false);
                    }}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                )}
                <Button onClick={saveItem} disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="container py-12">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <NotebookPen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="font-display text-2xl font-semibold mb-2">Your itinerary is empty</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Start by adding your first activity — for example, a morning at
                the mausoleum followed by the museum.
              </p>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4.5 w-4.5" />
                Add your first activity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {groups.map(group => (
              <div key={group.key}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-heritage flex items-center justify-center shrink-0">
                    <CalendarDays className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold leading-tight">
                      {format(group.date, "EEEE, d MMMM yyyy")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {group.items.length} activit{group.items.length === 1 ? "y" : "ies"} planned
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {group.items.map(item => (
                    <Card key={item.id} className="border-border">
                      <CardContent className="py-4 px-5 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-heritage">
                              <Clock className="h-3.5 w-3.5" />
                              {item.timeSlot ?? "Any time"}
                            </span>
                            {item.attractionName && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">
                                <Landmark className="h-3 w-3" />
                                {item.attractionName}
                              </span>
                            )}
                            {item.bookingId && (
                              <span className="text-xs text-muted-foreground">
                                Booking #{item.bookingId}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium mt-1">{item.title}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className={cn("flex flex-col gap-1 shrink-0", "sm:flex-row sm:gap-1.5")}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDialog(item)}
                            aria-label="Edit"
                          >
                            <NotebookPen className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveItem(item, "up")}
                            disabled={item.sortIndex === 0 || reorderMutation.isPending}
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveItem(item, "down")}
                            disabled={reorderMutation.isPending}
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeMutation.mutate({ id: item.id })}
                            disabled={removeMutation.isPending}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </VisitorLayout>
  );
}
