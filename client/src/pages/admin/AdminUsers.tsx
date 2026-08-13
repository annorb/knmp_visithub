import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, Users, MoreVertical, UserCheck, UserX } from "lucide-react";
import { useState } from "react";

type PlatformUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: Date;
  lastSignedIn: Date;
};

export default function AdminUsers() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.listAll.useQuery();
  const [dialog, setDialog] = useState<{
    open: boolean;
    target: PlatformUser | null;
    action: "deactivate" | "activate" | "promote" | "demote" | null;
  }>({ open: false, target: null, action: null });

  const roleMutation = trpc.users.updateRole.useMutation({
    onSettled: () => {
      utils.users.listAll.invalidate();
    },
    onError: err => {
      toast.error(err.message || "Could not update the role.");
    },
  });

  const activationMutation = trpc.users.setActivation.useMutation({
    onSettled: () => {
      utils.users.listAll.invalidate();
    },
    onError: err => {
      toast.error(err.message || "Could not update the account status.");
    },
  });

  const pending = roleMutation.isPending || activationMutation.isPending;

  const confirmAction = async () => {
    if (!dialog.target || !dialog.action) return;
    const t = dialog.target;
    try {
      if (dialog.action === "activate" || dialog.action === "deactivate") {
        await activationMutation.mutateAsync({
          userId: t.id,
          isActive: dialog.action === "activate",
        });
        toast.success(
          dialog.action === "activate"
            ? `${t.name ?? "User"} has been reactivated.`
            : `${t.name ?? "User"} has been deactivated.`,
        );
      } else if (dialog.action === "promote") {
        await roleMutation.mutateAsync({ userId: t.id, role: "admin" });
        toast.success(`${t.name ?? "User"} is now an administrator.`);
      } else {
        await roleMutation.mutateAsync({ userId: t.id, role: "user" });
        toast.success(`${t.name ?? "User"} is now a regular visitor.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDialog({ open: false, target: null, action: null });
    }
  };

  const openConfirm = (target: PlatformUser, action: NonNullable<typeof dialog.action>) => {
    setDialog({ open: true, target, action });
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
        <div className="text-center py-20 text-muted-foreground">
          This area is restricted to administrators.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">Users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every visitor and administrator registered on the platform. Administrators can change
            roles and deactivate accounts that should no longer have access.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <Users className="h-4 w-4 text-primary" />
              Registered users
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {isLoading ? "—" : `${(users ?? []).length} total`}
            </span>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {!isLoading && (users ?? []).length === 0 && (
              <div className="py-14 text-center text-sm text-muted-foreground">
                No users have registered yet.
              </div>
            )}

            {!isLoading && (users ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 pr-4 font-medium">Name</th>
                      <th className="py-2.5 pr-4 font-medium">Email</th>
                      <th className="py-2.5 pr-4 font-medium">Role</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 pr-4 font-medium">Last signed in</th>
                      <th className="py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users as PlatformUser[] | undefined)?.map(u => {
                      const isSelf = u.id === user.id;
                      const displayName = u.name?.trim() || u.email || "Unknown visitor";
                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {displayName}
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{u.email ?? "—"}</td>
                          <td className="py-3 pr-4">
                            <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                              {u.role === "admin" ? "Administrator" : "Visitor"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {u.isActive ? (
                              <Badge variant="outline" className="text-green-700 border-green-200">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                Deactivated
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                            {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : "Never"}
                          </td>
                          <td className="py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="User actions">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {u.role !== "admin" && (
                                  <DropdownMenuItem
                                    disabled={pending}
                                    onClick={() => openConfirm(u, "promote")}
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Make administrator
                                  </DropdownMenuItem>
                                )}
                                {u.role === "admin" && !isSelf && (
                                  <DropdownMenuItem
                                    disabled={pending}
                                    onClick={() => openConfirm(u, "demote")}
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Make visitor
                                  </DropdownMenuItem>
                                )}
                                {u.isActive ? (
                                  <DropdownMenuItem
                                    disabled={pending}
                                    onClick={() => openConfirm(u, "deactivate")}
                                    className="text-red-600"
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    Deactivate account
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled={pending}
                                    onClick={() => openConfirm(u, "activate")}
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Reactivate account
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={dialog.open}
        onOpenChange={open => setDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.action === "promote" && "Grant administrator access"}
              {dialog.action === "demote" && "Revoke administrator access"}
              {dialog.action === "deactivate" && "Deactivate account"}
              {dialog.action === "activate" && "Reactivate account"}
            </DialogTitle>
            <DialogDescription>
              {dialog.action === "promote" &&
                `${dialog.target?.name ?? "This user"} will gain full access to the admin dashboard, including the ability to manage attractions, prices and other users.`}
              {dialog.action === "demote" &&
                `${dialog.target?.name ?? "This user"} will be returned to visitor privileges and will no longer see the admin dashboard.`}
              {dialog.action === "deactivate" &&
                `${dialog.target?.name ?? "This account"} will be blocked from signing in and using authenticated features until reactivated.`}
              {dialog.action === "activate" &&
                `${dialog.target?.name ?? "This account"} will regain access to authenticated features on the next sign-in.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, target: null, action: null })}
            >
              Cancel
            </Button>
            <Button
              variant={
                dialog.action === "deactivate" || dialog.action === "demote" ? "destructive" : "default"
              }
              disabled={pending}
              onClick={confirmAction}
            >
              {dialog.action === "promote" && "Make administrator"}
              {dialog.action === "demote" && "Make visitor"}
              {dialog.action === "deactivate" && "Deactivate"}
              {dialog.action === "activate" && "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
