import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import { Camera, CameraOff, Loader2, QrCode, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const QR_PAYLOAD_PREFIX = "KNMP-TICKET:";

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

export default function AdminGate() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [inputRef, setInputRef] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const lookup = trpc.gate.lookupByReference.useQuery(
    { reference: inputRef.toUpperCase().trim() },
    { enabled: inputRef.trim().length >= 4, refetchOnWindowFocus: false },
  );
  const found = lookup.data?.booking ?? null;
  const items = lookup.data?.items ?? [];

  const invalidate = useCallback(() => {
    utils.gate.lookupByReference.invalidate();
    utils.bookings.listAll.invalidate();
  }, [utils]);

  const checkInMutation = trpc.gate.checkIn.useMutation({
    onSuccess: () => {
      toast.success(`Checked in ${found?.reference ?? "the visitor party"}`);
      invalidate();
    },
    onError: err => {
      toast.error(err.message ?? "Could not check in this booking");
    },
  });

  const undoMutation = trpc.gate.undoCheckIn.useMutation({
    onSuccess: () => {
      toast.success("Check-in undone");
      invalidate();
    },
    onError: err => toast.error(err.message ?? "Could not undo the check-in"),
  });

  // Auto-check-in on scan detection: resolve the latest scanned reference and
  // check the party in when the lookup result arrives.
  useEffect(() => {
    if (!lastScan) return;
    const ref = lastScan;
    if (lookup.data?.booking && !checkInMutation.isPending) {
      const booking = lookup.data.booking;
      if (!booking.checkInAt && booking.status !== "cancelled") {
        checkInMutation.mutate({ id: booking.id });
      }
      setLastScan(null);
      void ref;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.data, lastScan]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    import("jsqr").then(({ default: jsQR }) => {
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code?.data) {
        let raw = code.data.trim().toUpperCase();
        if (raw.startsWith(QR_PAYLOAD_PREFIX)) raw = raw.slice(QR_PAYLOAD_PREFIX.length);
        if (raw && raw !== lookup.data?.booking?.reference?.toUpperCase()) {
          setLastScan(raw);
          setInputRef(raw);
          toast.success(`Ticket scanned: ${raw}`);
        }
      }
      rafRef.current = requestAnimationFrame(scanFrame);
    });
  }, [lookup.data?.booking?.reference]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      toast.error("Camera access was denied or unavailable. Use manual entry instead.");
    }
  }, [scanFrame]);

  const manualLookup = () => {
    if (inputRef.trim().length < 4) {
      toast.error("Enter at least the booking reference (e.g. KNMP-ABC123)");
      return;
    }
    lookup.refetch();
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
          <p className="text-sm text-muted-foreground">Gate check-in is restricted to administrators.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold">Gate Check-in</h1>
          <p className="text-sm text-muted-foreground">
            Scan the QR code on a visitor's ticket, or type the booking reference
            manually. The visitor party is checked in as soon as a valid ticket is
            recognised.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-accent/60 flex items-center justify-center">
                {cameraOn ? (
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                ) : (
                  <div className="text-center p-6">
                    <CameraOff className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
                    <p className="text-sm text-muted-foreground">Camera is off</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex gap-2">
                {cameraOn ? (
                  <Button variant="outline" onClick={stopCamera} className="flex-1">
                    <CameraOff className="h-4 w-4 mr-2" />
                    Stop camera
                  </Button>
                ) : (
                  <Button onClick={startCamera} className="flex-1">
                    <Camera className="h-4 w-4 mr-2" />
                    Start camera
                  </Button>
                )}
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Or enter the reference manually
                </p>
                <div className="flex gap-2">
                  <Input
                    value={inputRef}
                    onChange={e => setInputRef(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") manualLookup();
                    }}
                    placeholder="KNMP-ABC123"
                    className="uppercase font-mono"
                  />
                  <Button variant="secondary" onClick={manualLookup} disabled={checkInMutation.isPending}>
                    {checkInMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Lookup result
              </p>
              {lookup.isLoading || lookup.isFetching ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : !found ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  {inputRef.trim().length >= 4 ? (
                    "No booking found for that reference."
                  ) : (
                    "Enter a reference or scan a ticket to see the visitor details."
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-mono text-xl text-heritage">
                      {found.reference}
                    </p>
                    <div className="flex gap-1.5">
                      <Badge variant={found.status === "cancelled" ? "destructive" : "secondary"}>
                        {found.status}
                      </Badge>
                      {found.checkInAt ? (
                        <Badge className="bg-heritage/15 text-heritage">
                          Checked in {format(new Date(found.checkInAt), "d MMM HH:mm")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not checked in</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Visitor</p>
                      <p>{found.visitorName ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Visit</p>
                      <p>{format(new Date(found.visitDate), "d MMM yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Amount</p>
                      <p className="font-semibold">{formatPrice(found.totalPesewas)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Party size</p>
                      <p className="font-semibold">
                        {items.reduce((sum, i) => sum + i.quantity, 0)} visitors
                      </p>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                        Line items
                      </p>
                      <div className="space-y-1.5">
                        {items.map(item => (
                          <div
                            key={item.categoryId}
                            className="flex justify-between rounded bg-accent px-3 py-1.5 text-sm"
                          >
                            <span>{item.categoryName} × {item.quantity}</span>
                            <span className="font-medium">{formatPrice(item.subtotalPesewas)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    {found.status === "cancelled" ? (
                      <p className="text-sm text-muted-foreground">
                        This booking is cancelled and cannot be checked in.
                      </p>
                    ) : found.checkInAt ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-heritage/15 text-heritage">
                          Party already checked in at the gate
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => undoMutation.mutate({ id: found.id })}
                          disabled={undoMutation.isPending}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                          Undo
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => checkInMutation.mutate({ id: found.id })}
                        disabled={checkInMutation.isPending}
                      >
                        {checkInMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-2" />
                        )}
                        Check in visitor party
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
