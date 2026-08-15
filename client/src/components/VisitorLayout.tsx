import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startLogin } from "@/const";
import {
  CalendarDays,
  Clock,
  Landmark,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  NotebookPen,
  Ticket,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navLinks = [
  { href: "/explore", label: "Explore", icon: Landmark },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/book", label: "Book a Visit", icon: Ticket },
  { href: "/bookings", label: "My Bookings", icon: NotebookPen, auth: true as const },
  { href: "/itinerary", label: "Itinerary", icon: NotebookPen, auth: true as const },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      <div className="h-9 w-9 rounded-full bg-heritage flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
        <Landmark className="h-4.5 w-4.5 text-gold" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-xl font-semibold tracking-wide text-foreground">
          KNMP <span className="text-heritage">VisitHub</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-1">
          Kwame Nkrumah Memorial Park
        </span>
      </div>
    </Link>
  );
}

export default function VisitorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Brand />
          <nav className="hidden md:flex items-center gap-1">
            {navLinks
              .filter(l => !l.auth || user)
              .map(link => {
                const active = location.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      active
                        ? "text-heritage bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            <div className="ml-2 pl-2 border-l border-border">
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden lg:block">
                    Hello, {user.name?.split(" ")[0] ?? "Visitor"}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => logout()}>
                    <LogOut className="h-3.5 w-3.5 mr-1" />
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => startLogin()}>
                  <LogIn className="h-3.5 w-3.5 mr-1" />
                  Sign in
                </Button>
              )}
            </div>
          </nav>
          <button
            className="md:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 pb-4 pt-2 space-y-1">
            {navLinks
              .filter(l => !l.auth || user)
              .map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium ${
                    location.startsWith(link.href)
                      ? "text-heritage bg-accent"
                      : "text-muted-foreground"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            <div className="pt-2 border-t border-border">
              {loading ? (
                <Skeleton className="h-9 w-full" />
              ) : user ? (
                <Button variant="outline" className="w-full" onClick={() => logout()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              ) : (
                <Button className="w-full" onClick={() => startLogin()}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign in
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-secondary/60 mt-16">
        <div className="container py-12 grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-heritage flex items-center justify-center">
                <Landmark className="h-4.5 w-4.5 text-gold" strokeWidth={1.75} />
              </div>
              <span className="font-display text-lg font-semibold">KNMP VisitHub</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              The official booking and visit-planning companion for the Kwame Nkrumah
              Memorial Park & Mausoleum in the heart of Accra, Ghana.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold mb-4">Visit the Park</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-heritage shrink-0" />
                <span>
                  Monday – Saturday: 9:00 am – 7:00 pm
                  <br />
                  Sunday: 10:00 am – 7:00 pm
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-heritage shrink-0" />
                <span>
                  Prof. Atta Mills High Street, Accra
                  <br />
                  GPS: GA-184-8219
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold mb-4">Explore</h3>
            <div className="flex flex-wrap gap-2">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:text-heritage hover:border-heritage transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="kente-rule mx-auto w-24 mb-6 rounded-full" />
        <p className="text-center text-xs text-muted-foreground pb-8">
          © {new Date().getFullYear()} KNMP VisitHub · A web-based booking & visit-planning
          system for the Kwame Nkrumah Memorial Park
        </p>
      </footer>
    </div>
  );
}
