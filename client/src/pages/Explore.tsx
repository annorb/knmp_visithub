import VisitorLayout from "@/components/VisitorLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Clock,
  Landmark,
  MapPin,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type FacetValue = { value: string; count: number };

function FacetBar({
  label,
  icon,
  values,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  icon: React.ReactNode;
  values: FacetValue[];
  selected: string | null;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] font-medium text-muted-foreground">
          {icon}
          {label}
        </span>
        {selected && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-heritage hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map(f => {
          const active = selected === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onToggle(f.value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                active
                  ? "bg-heritage text-heritage-foreground border-heritage shadow-sm"
                  : "bg-card border-border hover:border-heritage/50 text-foreground"
              }`}
            >
              {f.value}
              <span className={active ? "opacity-80" : "text-muted-foreground"}>
                {" "}· {f.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Explore() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const { data: facets } = trpc.attractions.facets.useQuery();
  const { data: filtered, isLoading: searching } =
    trpc.attractions.searchFiltered.useQuery(
      {
        query: query.trim().length >= 2 ? query.trim() : undefined,
        category: category ?? undefined,
        location: location ?? undefined,
      },
      {
        enabled:
          query.trim().length >= 2 || category !== null || location !== null,
      },
    );
  const { data: allAttractions, isLoading: loadingAll } =
    trpc.attractions.list.useQuery();

  const results = useMemo(() => {
    const active = query.trim().length >= 2 || category !== null || location !== null;
    if (active) return filtered ?? [];
    return allAttractions ?? [];
  }, [query, category, location, filtered, allAttractions]);

  const isActive =
    query.trim().length >= 2 || category !== null || location !== null;
  const searchingAny = loadingAll || (isActive && searching);

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
          <div className="max-w-3xl space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search attractions, e.g. mausoleum, museum…"
                className="pl-10 h-12 bg-card shadow-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FacetBar
                label="Category"
                icon={<Landmark className="h-3.5 w-3.5 text-heritage" />}
                values={(facets?.categories as FacetValue[]) ?? []}
                selected={category}
                onToggle={v => setCategory(prev => (prev === v ? null : v))}
                onClear={() => setCategory(null)}
              />
              <FacetBar
                label="Location"
                icon={<MapPin className="h-3.5 w-3.5 text-heritage" />}
                values={(facets?.locations as FacetValue[]) ?? []}
                selected={location}
                onToggle={v => setLocation(prev => (prev === v ? null : v))}
                onClear={() => setLocation(null)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12">
        {isActive && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {category && (
              <Badge variant="secondary" className="gap-1.5">
                {category}
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  aria-label="Remove category filter"
                >
                  ×
                </button>
              </Badge>
            )}
            {location && (
              <Badge variant="secondary" className="gap-1.5">
                {location}
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  aria-label="Remove location filter"
                >
                  ×
                </button>
              </Badge>
            )}
            {(category || location) && (
              <button
                type="button"
                onClick={() => {
                  setCategory(null);
                  setLocation(null);
                }}
                className="text-xs text-muted-foreground hover:text-heritage"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {searchingAny ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20">
            <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold mb-2">
              No attractions found
            </h2>
            <p className="text-muted-foreground">
              {isActive
                ? "Nothing matches the current filters. Try adjusting your search or clearing a filter."
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
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display text-xl font-semibold mb-1.5 group-hover:text-heritage transition-colors">
                        {a.name}
                      </h2>
                      {a.category && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] text-heritage border-heritage/40"
                        >
                          {a.category}
                        </Badge>
                      )}
                    </div>
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
