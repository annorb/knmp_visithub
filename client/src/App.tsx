import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import AttractionDetail from "./pages/AttractionDetail";
import Book from "./pages/Book";
import MyBookings from "./pages/MyBookings";
import Itinerary from "./pages/Itinerary";
import ItineraryShare from "./pages/ItineraryShare";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminAttractions from "./pages/admin/AdminAttractions";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminGate from "./pages/admin/AdminGate";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminEvents from "./pages/admin/AdminEvents";
import Events from "./pages/Events";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/explore"} component={Explore} />
      <Route path={"/explore/:slug"} component={AttractionDetail} />
      <Route path={"/book"} component={Book} />
      <Route path={"/bookings"} component={MyBookings} />
      <Route path={"/itinerary"} component={Itinerary} />
      <Route path={"/events"} component={Events} />
      <Route path={"/share/itinerary/:code"} component={ItineraryShare} />
      <Route path={"/admin"} component={AdminOverview} />
      <Route path={"/admin/attractions"} component={AdminAttractions} />
      <Route path={"/admin/categories"} component={AdminCategories} />
      <Route path={"/admin/bookings"} component={AdminBookings} />
      <Route path={"/admin/analytics"} component={AdminAnalytics} />
      <Route path={"/admin/users"} component={AdminUsers} />
      <Route path={"/admin/gate"} component={AdminGate} />
      <Route path={"/admin/settings"} component={AdminSettings} />
      <Route path={"/admin/audit"} component={AdminAudit} />
      <Route path={"/admin/events"} component={AdminEvents} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
