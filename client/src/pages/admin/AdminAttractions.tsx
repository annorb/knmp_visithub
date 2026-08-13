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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

type Attraction = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  openingHours: string | null;
  location: string | null;
  averageVisitDurationMin: number | null;
  sortIndex: number | null;
  isActive: boolean;
};

export default function AdminAttractions() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: attractions, isLoading } = trpc.attractions.listAll.useQuery();
  const createMutation = trpc.attractions.create.useMutation({
    onSettled: () => {
      utils.attractions.listAll.invalidate();
      utils.attractions.list.invalidate();
    },
  });
  const updateMutation = trpc.attractions.update.useMutation({
    onSettled: () => {
      utils.attractions.listAll.invalidate();
      utils.attractions.list.invalidate();
    },
  });
  const removeMutation = trpc.attractions.remove.useMutation({
    onSettled: () => {
      utils.attractions.listAll.invalidate();
      utils.attractions.list.invalidate();
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Attraction | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    openingHours: "",
    location: "",
    averageVisitDurationMin: "",
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);

  const openDialog = (a?: Attraction) => {
    setEditing(a ?? null);
    setForm({
      name: a?.name ?? "",
      description: a?.description ?? "",
      imageUrl: a?.imageUrl ?? "",
      openingHours: a?.openingHours ?? "",
      location: a?.location ?? "",
      averageVisitDurationMin: a?.averageVisitDurationMin ? String(a.averageVisitDurationMin) : "",
      isActive: a?.isActive ?? true,
    });
    setError(null);
    setDialogOpen(true);
  };

  const set = (field: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("The attraction name is required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
      openingHours: form.openingHours.trim() || null,
      location: form.location.trim() || null,
      averageVisitDurationMin: form.averageVisitDurationMin ? Number(form.averageVisitDurationMin) : undefined,
      isActive: form.isActive,
    } as const;
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

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Attractions</h1>
            <p className="text-sm text-muted-foreground">
              Add, edit or remove attractions shown to visitors.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add attraction
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {editing ? "Edit attraction" : "Add attraction"}
                </DialogTitle>
                <DialogDescription>
                  Changes appear on the public attractions explorer immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. The Mausoleum" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => set("description", e.target.value)}
                    placeholder="A short description shown on attraction cards…"
                    className="min-h-24"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input
                    value={form.imageUrl}
                    onChange={e => set("imageUrl", e.target.value)}
                    placeholder="https://…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use an image URL hosted on webdev static storage.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Opening hours</Label>
                    <Input
                      value={form.openingHours}
                      onChange={e => set("openingHours", e.target.value)}
                      placeholder="e.g. 9:00am–7:00pm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <Input
                      value={form.location}
                      onChange={e => set("location", e.target.value)}
                      placeholder="e.g. Central grounds"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Avg. visit (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.averageVisitDurationMin}
                      onChange={e => set("averageVisitDurationMin", e.target.value)}
                      placeholder="45"
                    />
                  </div>
                  <div className="space-y-1.5 flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} />
                      Listed for visitors
                    </label>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !attractions?.length ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground text-sm">
              No attractions yet. Add the first one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {attractions
              .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
              .map(a => (
                <Card key={a.id} className="border-border">
                  <CardContent className="py-4 px-5 flex items-center gap-4 flex-wrap">
                    <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Star className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{a.name}</p>
                        {!a.isActive && (
                          <span className="text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {a.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openDialog(a)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (window.confirm(`Delete "${a.name}"?`)) {
                            await removeMutation.mutateAsync({ id: a.id });
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
      </div>
    </DashboardLayout>
  );
}
