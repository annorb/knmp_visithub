import VisitorLayout from "@/components/VisitorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  MapPin,
  NotebookPen,
  Ticket,
} from "lucide-react";
import { Link, useParams } from "wouter";

export default function AttractionDetail() {
  const params = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const { data: attraction, isLoading } = trpc.attractions.bySlug.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug },
  );
  const { data: categories } = trpc.categories.list.useQuery();

  if (isLoading) {
    return (
      <VisitorLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-40 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </VisitorLayout>
    );
  }

  if (!attraction) {
    return (
      <VisitorLayout>
        <div className="container py-24 text-center">
          <h1 className="font-display text-3xl font-semibold mb-3">Attraction not found</h1>
          <p className="text-muted-foreground mb-6">
            The attraction you are looking for does not exist or is no longer
            available.
          </p>
          <Link href="/explore">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to attractions
            </Button>
          </Link>
        </div>
      </VisitorLayout>
    );
  }

  const formatPrice = (p: number) =>
    `GH₵${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

  return (
    <VisitorLayout>
      <div className="bg-secondary/40 border-b border-border">
        <div className="container pt-8 pb-2">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heritage transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All attractions
          </Link>
        </div>
      </div>

      <section className="container py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
              {attraction.imageUrl ? (
                <img
                  src={attraction.imageUrl}
                  alt={attraction.name}
                  className="w-full aspect-[16/10] object-cover"
                />
              ) : (
                <div className="w-full aspect-[16/10] bg-muted" />
              )}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-5">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight mb-2">
                {attraction.name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-3">
                {attraction.openingHours && (
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <Clock className="h-3.5 w-3.5 text-heritage" />
                    {attraction.openingHours}
                  </Badge>
                )}
                {attraction.location && (
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <MapPin className="h-3.5 w-3.5 text-heritage" />
                    {attraction.location}
                  </Badge>
                )}
                {attraction.averageVisitDurationMin && (
                  <Badge variant="secondary" className="font-normal">
                    ~{attraction.averageVisitDurationMin} min visit
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {attraction.description}
            </p>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm font-semibold mb-2.5 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-heritage" />
                Entrance fees by category
              </p>
              <div className="space-y-1.5">
                {(categories ?? []).map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="font-medium">{formatPrice(c.pricePesewas)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link href={isAuthenticated ? "/book" : "#"}>
                <Button
                  size="lg"
                  className="w-full h-12"
                  onClick={e => {
                    if (!isAuthenticated) {
                      e.preventDefault();
                      startLogin();
                    }
                  }}
                >
                  <Ticket className="mr-2 h-4.5 w-4.5" />
                  {isAuthenticated ? "Book this visit" : "Sign in to book this visit"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              {isAuthenticated && (
                <Link href="/itinerary">
                  <Button variant="outline" size="lg" className="w-full h-12">
                    <NotebookPen className="mr-2 h-4.5 w-4.5" />
                    Add to my itinerary
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </VisitorLayout>
  );
}
