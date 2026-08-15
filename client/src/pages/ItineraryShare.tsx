import VisitorLayout from "@/components/VisitorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Landmark, Link2, NotebookPen } from "lucide-react";
import { Link, useParams } from "wouter";

type SharedDay = {
  dateLabel: string;
  rows: {
    id: number;
    visitDate: Date;
    title: string;
    description: string | null;
    timeSlot: string | null;
    attractionName: string | null;
    sortIndex: number | null;
  }[];
};

export default function ItineraryShare() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";
  const { data, isLoading, isError, refetch } = trpc.itineraries.byShareCode.useQuery(
    { shareCode: code },
    { enabled: code.length > 0 },
  );

  const hasItems = (data?.days ?? []).some(day => day.rows.length > 0);

  return (
    <VisitorLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="container py-12">
          <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
            Shared visit plan
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-semibold mb-4">
            A visit to the park, planned with care
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            This is a shared read-only copy of someone's personal KNMP
            itinerary. To plan your own visit, sign in and use the itinerary
            builder.
          </p>
        </div>
      </section>

      <section className="container py-12">
        {isLoading ? (
          <div className="space-y-4 max-w-3xl mx-auto">
            {[0, 1].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : isError || !hasItems ? (
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-16 text-center">
              <Link2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="font-display text-2xl font-semibold mb-2">
                {isError ? "This link isn't valid" : "Nothing shared here yet"}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {isError
                  ? "The share link you opened may be misspelled or no longer exists."
                  : "The owner hasn't added any activities to their itinerary yet."}
              </p>
              <div className="flex justify-center gap-3">
                {isError && (
                  <Button variant="outline" onClick={() => refetch()}>
                    Try again
                  </Button>
                )}
                <Button asChild>
                  <Link href="/itinerary">
                    <NotebookPen className="mr-2 h-4 w-4" />
                    Plan your own visit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {(data!.days as SharedDay[]).map((day, di) => (
              <div key={di}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-heritage flex items-center justify-center shrink-0">
                    <CalendarDays className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold leading-tight">
                      {day.dateLabel}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {day.rows.length} activit{day.rows.length === 1 ? "y" : "ies"} planned
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {day.rows.map(row => (
                    <Card key={row.id} className="border-border">
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-heritage">
                            <Clock className="h-3.5 w-3.5" />
                            {row.timeSlot ?? "Any time"}
                          </span>
                          {row.attractionName && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">
                              <Landmark className="h-3 w-3" />
                              {row.attractionName}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium mt-1">{row.title}</h3>
                        {row.description && (
                          <p className="text-sm text-muted-foreground mt-1">{row.description}</p>
                        )}
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
