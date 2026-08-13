import VisitorLayout from "@/components/VisitorLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Clock,
  MapPin,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

export default function Explore() {
  const [query, setQuery] = useState("");
  const { data: allAttractions, isLoading } = trpc.attractions.list.useQuery();
  const { data: searchResults, isLoading: searching } =
    trpc.attractions.search.useQuery(
      { query: query.trim() },
      { enabled: query.trim().length >= 2 },
    );

  const results = useMemo(() => {
    if (query.trim().length >= 2) return searchResults ?? [];
    return allAttractions ?? [];
  }, [query, searchResults, allAttractions]);

  return (
    <VisitorLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="container py-14 md:py-18">
          <p className="text-heritage uppercase tracking-[0.24em] text-xs font-medium mb-3">
            Attractions Explorer
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-semibold mb-4">
            Discover the Kwame Nkrumah Memorial Park
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed mb-8">
            Browse the park's mausoleum, museum, library, gardens and more —
            each with descriptions, opening hours, and suggested visit durations
            to help you plan your day.
          </p>
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search attractions, e.g. mausoleum, museum…"
              className="pl-10 h-12 bg-card shadow-sm"
            />
          </div>
        </div>
      </section>

      <section className="container py-12">
        {(isLoading || searching) ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20">
            <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold mb-2">No attractions found</h2>
            <p className="text-muted-foreground">
              {query.trim()
                ? `Nothing matches "${query}". Try another search term.`
                : "There are no attractions to display yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results.map(a => (
              <Link key={a.id} href={`/explore/${a.slug}`}>
                <article className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    {a.imageUrl ? (
                      <img
                        src={a.imageUrl}
                        alt={a.name}
                        loading="lazy"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h2 className="font-display text-xl font-semibold mb-1.5 group-hover:text-heritage transition-colors">
                      {a.name}
                    </h2>
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed flex-1">
                      {a.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                      {a.openingHours && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-heritage" />
                          {a.openingHours}
                        </span>
                      )}
                      {a.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-heritage" />
                          {a.location}
                        </span>
                      )}
                      {a.averageVisitDurationMin && (
                        <span className="ml-auto font-medium text-heritage inline-flex items-center gap-1">
                          View details
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </VisitorLayout>
  );
}
