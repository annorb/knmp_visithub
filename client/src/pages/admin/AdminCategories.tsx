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
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  pricePesewas: number;
  isActive: boolean;
  sortIndex: number | null;
};

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

export default function AdminCategories() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.categories.listAll.useQuery();
  const createMutation = trpc.categories.create.useMutation({
    onSettled: () => {
      utils.categories.listAll.invalidate();
      utils.categories.list.invalidate();
    },
  });
  const updateMutation = trpc.categories.update.useMutation({
    onSettled: () => {
      utils.categories.listAll.invalidate();
      utils.categories.list.invalidate();
    },
  });
  const removeMutation = trpc.categories.remove.useMutation({
    onSettled: () => {
      utils.categories.listAll.invalidate();
      utils.categories.list.invalidate();
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    priceCedis: "",
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);

  const openDialog = (c?: Category) => {
    setEditing(c ?? null);
    setForm({
      name: c?.name ?? "",
      description: c?.description ?? "",
      priceCedis: c ? String(c.pricePesewas / 100) : "",
      isActive: c?.isActive ?? true,
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
      setError("The category name is required.");
      return;
    }
    const price = Number(form.priceCedis);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Please enter a valid fee greater than zero.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      pricePesewas: Math.round(price * 100),
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
      <div className="p-4 md:p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Visitor categories & fees</h1>
            <p className="text-sm text-muted-foreground">
              Fees are stored in pesewas (1 GHS = 100 pesewas) for exact
              arithmetic. Enter amounts in Cedis above.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {editing ? "Edit category" : "Add visitor category"}
                </DialogTitle>
                <DialogDescription>
                  Categories appear in the public fee table and the booking flow.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Student" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => set("description", e.target.value)}
                    placeholder="Who qualifies, e.g. Tertiary students with valid ID"
                    className="min-h-16"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label>Entrance fee (GHS) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.50"
                      value={form.priceCedis}
                      onChange={e => set("priceCedis", e.target.value)}
                      placeholder="25.00"
                    />
                  </div>
                  <div className="pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} />
                      Visible for booking
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
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !categories?.length ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground text-sm">
              No visitor categories yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {categories
              .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
              .map(c => (
                <Card key={c.id} className="border-border">
                  <CardContent className="py-4 px-5 flex items-center gap-4 flex-wrap">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <Tags className="h-4.5 w-4.5 text-heritage" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{c.name}</p>
                        {!c.isActive && (
                          <span className="text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                            Hidden
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <p className="font-display text-xl font-semibold text-heritage shrink-0">
                      {formatPrice(c.pricePesewas)}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openDialog(c)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (window.confirm(`Delete "${c.name}"?`)) {
                            await removeMutation.mutateAsync({ id: c.id });
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
