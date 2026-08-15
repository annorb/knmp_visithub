import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { DEFAULT_DAILY_CAPACITY, DEFAULT_NEAR_CAPACITY_THRESHOLD } from "../../../../drizzle/schema";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

function toPercent(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

export default function AdminSettings() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settings.list.useQuery();

  const [capacity, setCapacity] = useState("");
  const [threshold, setThreshold] = useState("");
  const [initialized, setInitialized] = useState(false);

  useMemo(() => {
    if (data && !initialized) {
      setCapacity(String(data.capacity));
      setThreshold(String(Math.round(data.nearThreshold * 100)));
      setInitialized(true);
    }
  }, [data, initialized]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: result => {
      toast.success("Settings saved");
      utils.settings.list.invalidate();
      setCapacity(String(result.capacity));
      setThreshold(String(Math.round(result.nearThreshold * 100)));
    },
    onError: err => toast.error(err.message ?? "Could not save settings"),
  });

  const save = () => {
    const capacityNum = Number.parseInt(capacity, 10);
    const thresholdNum = Number.parseInt(threshold, 10);
    if (!Number.isFinite(capacityNum) || capacityNum < 10) {
      toast.error("Capacity must be a whole number of at least 10 visitors");
      return;
    }
    if (!Number.isFinite(thresholdNum) || thresholdNum < 10 || thresholdNum > 99) {
      toast.error("Warning threshold must be between 10% and 99%");
      return;
    }
    updateMutation.mutate({
      capacity: capacityNum,
      nearThreshold: thresholdNum / 100,
    });
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
          <p className="text-sm text-muted-foreground">Settings are restricted to administrators.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure the park-wide limits that drive the capacity forecast and the
            booking-form warnings.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily visitor capacity</CardTitle>
                <CardDescription>
                  The maximum number of visitors the park plans to host in a single
                  day. Used by the analytics forecast chart and by the public booking
                  form to warn when a date is overbooked. Default is{" "}
                  {DEFAULT_DAILY_CAPACITY.toLocaleString()}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label htmlFor="capacity" className="mb-1.5 block">
                    Visitors per day
                  </Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={10}
                    max={100_000}
                    value={capacity}
                    onChange={e => setCapacity(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Near-capacity warning threshold</CardTitle>
                <CardDescription>
                  The fraction of daily capacity at which the booking form starts
                  showing the near-capacity warning. A date is considered
                  near-capacity when projected visitors reach this fraction.
                  Default is {toPercent(DEFAULT_NEAR_CAPACITY_THRESHOLD)}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label htmlFor="threshold" className="mb-1.5 block">
                    Warning at (%)
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    min={10}
                    max={99}
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Whole number between 10 and 99.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button
                onClick={save}
                disabled={updateMutation.isPending}
                className="min-w-32"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save settings
              </Button>
              {updateMutation.isError && (
                <p className="text-sm text-destructive">
                  {updateMutation.error.message ?? "Could not save settings"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
