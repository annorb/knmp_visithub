import VisitorLayout from "@/components/VisitorLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  NotebookPen,
  Star,
  Ticket,
} from "lucide-react";
import { Link } from "wouter";

const HERO_IMAGE = "/manus-storage/knmp_hero_6e87e968.webp";
const STATUE_IMAGE = "/manus-storage/knmp_statue_closeup_7a9971ab.jpg";
const POOL_IMAGE = "/manus-storage/knmp_pool_gardens_339eca09.jpg";

function formatPrice(pesewas: number) {
  return `GH₵${(pesewas / 100).toFixed(pesewas % 100 === 0 ? 0 : 2)}`;
}

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: attractions, isLoading: attractionsLoading } =
    trpc.attractions.list.useQuery();
  const { data: categories, isLoading: categoriesLoading } =
    trpc.categories.list.useQuery();

  const featured = (attractions ?? []).slice(0, 3);

  return (
    <VisitorLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="container relative z-10 py-24 md:py-36 lg:py-44">
          <div className="max-w-2xl fade-up">
            <div className="kente-rule w-16 mb-6" />
            <p className="text-gold uppercase tracking-[0.28em] text-xs font-medium mb-4">
              Accra · Ghana · Since 1992
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-semibold text-white leading-[1.08] mb-6">
              Walk the ground where Ghana found its freedom
            </h1>
            <p className="text-white/85 text-lg leading-relaxed mb-8 max-w-xl">
              Plan your visit to the Kwame Nkrumah Memorial Park & Mausoleum —
              explore the attractions, choose your visit date, and organise your
              perfect day, all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/explore">
                <Button size="lg" className="bg-gold text-foreground hover:bg-gold/90 h-12 px-8 text-base font-medium shadow-xl">
                  Explore Attractions
                  <ArrowRight className="ml-2 h-4.5 w-4.5" />
                </Button>
              </Link>
              <Link href={isAuthenticated ? "/book" : "#"}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base border-white/40 text-white hover:bg-white/10 hover:text-white"
                  onClick={e => {
                    if (!isAuthenticated) {
                      e.preventDefault();
                      startLogin();
                    }
                  }}
                >
                  <Ticket className="mr-2 h-4.5 w-4.5" />
                  {isAuthenticated ? "Book a Visit" : "Book a Visit (Sign in first)"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Practical info strip */}
      <section className="border-b border-border bg-card">
        <div className="container grid gap-6 md:grid-cols-3 py-8">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-heritage" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Opening Hours</p>
              <p className="text-sm text-muted-foreground">Mon–Sat 9am–7pm · Sun 10am–7pm</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-heritage" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Location</p>
              <p className="text-sm text-muted-foreground">High Street, Accra · GA-184-8219</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-accent flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-heritage" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Plan Ahead</p>
              <p className="text-sm text-muted-foreground">Book online and skip the queue</p>
            </div>
          </div>
        </div>
      </section>

      {/* Entrance fees */}
      <section className="container py-20">
        <div className="grid gap-12 lg:grid-cols-5 items-start">
          <div className="lg:col-span-2">
            <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
              Visitor Fees
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">
              Simple, transparent entrance fees
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Entrance fees are set per visitor category. When you book, simply
              tell us how many people are in each category and we calculate the
              total instantly.
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <NotebookPen className="h-5 w-5 text-heritage shrink-0" />
              <p className="text-sm text-muted-foreground">
                Prefer to plan a full day? Build a personal itinerary for your
                {isAuthenticated ? "" : " visit — "}
                {isAuthenticated ? "visit from your dashboard." : "sign in to plan your day."}
              </p>
            </div>
          </div>
          <div className="lg:col-span-3">
            {categoriesLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(categories ?? []).map(cat => (
                  <Card key={cat.id} className="border-border hover:border-gold/60 hover:shadow-md transition-all">
                    <CardContent className="flex items-center justify-between py-5 px-6">
                      <div>
                        <p className="font-medium text-foreground">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                        )}
                      </div>
                      <p className="font-display text-2xl font-semibold text-heritage">
                        {formatPrice(cat.pricePesewas)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Fees shown in Ghana Cedis (GHS). Categories and prices are managed
              by park administrators.
            </p>
          </div>
        </div>
      </section>

      {/* Featured attractions */}
      <section className="bg-secondary/50 border-y border-border">
        <div className="container py-20">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
                Inside the Park
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold">
                Attractions worth your morning
              </h2>
            </div>
            <Link href="/explore">
              <Button variant="outline" className="group">
                View all attractions
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
          {attractionsLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-72 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((a, i) => (
                <Link key={a.id} href={`/explore/${a.slug}`}>
                  <Card className="overflow-hidden border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      {a.imageUrl ? (
                        <img
                          src={a.imageUrl}
                          alt={a.name}
                          loading={i === 0 ? "eager" : "lazy"}
                          className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Star className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-display text-xl font-semibold mb-1.5">{a.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {a.description}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-xs text-heritage font-medium mt-3">
                        Discover more
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative rounded-2xl overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${POOL_IMAGE})` }}
          />
          <div className="absolute inset-0 bg-heritage/80" />
          <div className="relative z-10 px-8 py-14 md:px-16 md:py-16 text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4">
              Your visit, beautifully planned
            </h2>
            <p className="text-white/85 leading-relaxed mb-8">
              Sign in to book your visit, receive a unique booking reference, and
              build a personal itinerary for your day at the park.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {loading ? (
                <Skeleton className="h-12 w-44" />
              ) : user ? (
                <Link href="/book">
                  <Button size="lg" className="bg-gold text-foreground hover:bg-gold/90 h-12 px-8">
                    Book Your Visit
                  </Button>
                </Link>
              ) : (
                <Button size="lg" onClick={() => startLogin()} className="bg-gold text-foreground hover:bg-gold/90 h-12 px-8">
                  <Star className="mr-2 h-4.5 w-4.5" />
                  Sign in to get started
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </VisitorLayout>
  );
}
