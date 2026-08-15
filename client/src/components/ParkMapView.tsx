import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
type AttractionShape = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  location: string | null;
  openingHours: string | null;
  imageUrl: string | null;
  lat: string | number | null;
  lng: string | number | null;
};
import { Clock, MapPin } from "lucide-react";
import { useRef } from "react";

/**
 * Interactive park map for the Explorer page. Renders one marker per
 * attraction with map coordinates (lat/lng). Markers for attractions that
 * appear in the active results set are highlighted; clicking a marker opens
 * an info window with the attraction name, category, hours, and a link to
 * its detail page.
 */
export function ParkMapView({
  attractions,
  activeSlugs,
  isLoading,
}: {
  attractions: AttractionShape[];
  /** Slugs of attractions that match the current filters (all highlighted when null). */
  activeSlugs: string[] | null;
  isLoading: boolean;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<
    Map<number, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  if (isLoading) {
    return <Skeleton className="h-[460px] w-full rounded-xl" />;
  }

  const placable = attractions.filter(a => a.lat != null && a.lng != null);
  const activeSet = new Set(activeSlugs ?? attractions.map(a => a.slug));

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <MapView
        className="h-[460px]"
        initialCenter={{ lat: 5.5506, lng: -0.2107 }}
        initialZoom={18}
        onMapReady={map => {
          mapRef.current = map;
          infoWindowRef.current = new google.maps.InfoWindow();
          placable.forEach(a => {
            const isActive = activeSet.has(a.slug);
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map,
              position: {
                lat: Number(a.lat),
                lng: Number(a.lng),
              },
              title: a.name,
              content: renderPin(isActive),
            });
            markersRef.current.set(a.id, marker);
            marker.addListener("click", () => {
              infoWindowRef.current?.setContent(
                renderInfoContent(a),
              );
              infoWindowRef.current?.open({ map, anchor: marker });
            });
          });
        }}
      />
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-border bg-secondary/40 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-heritage inline-block" />
          Current filter results
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" />
          Other attractions
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          Kwame Nkrumah Memorial Park, Accra
        </span>
      </div>
    </div>
  );
}

function renderPin(isActive: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 ${
    isActive ? "bg-heritage" : "bg-muted-foreground/70"
  }`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "white");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  path.setAttribute(
    "d",
    "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01",
  );
  svg.appendChild(path);
  el.appendChild(svg);
  return el;
}

function renderInfoContent(a: AttractionShape): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "px-1 py-0.5 text-[13px]";
  el.innerHTML = `
    <p class="font-semibold text-[15px] mb-1">${a.name}</p>
    ${a.category ? `<span class="inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground mb-1.5">${a.category}</span>` : ""}
    <div class="flex items-center gap-1 text-muted-foreground text-xs mb-0.5"><span>🕐</span> ${a.openingHours ?? "Hours not set"}</div>
    ${a.location ? `<div class="flex items-center gap-1 text-muted-foreground text-xs mb-2"><span>📍</span> ${a.location}</div>` : ""}
    <a href="/explore/${a.slug}" class="inline-flex items-center gap-1 font-medium text-[13px]">View details →</a>
  `;
  return el;
}

export function MapLegend() {
  return (
    <Badge variant="outline" className="gap-1.5 text-xs">
      <Clock className="h-3 w-3 text-heritage" />
      Interactive park map
    </Badge>
  );
}
