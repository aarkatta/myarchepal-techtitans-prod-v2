import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, Folder, Loader2 } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventsService, Event } from "@/services/events";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Timestamp } from "firebase/firestore";

const Events = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const allEvents = await EventsService.getAllEvents();

        // Filter events based on organization type
        // - Pro/Enterprise org users: See content belonging to their organization
        // - Default/Free org users: See ONLY their own content (createdBy)
        // - Non-signed-in users: See ONLY public content from Pro/Enterprise orgs (not default org)
        const filteredEvents = user
          ? isProOrg
            ? allEvents.filter(event => event.organizationId === organization?.id)
            : allEvents.filter(event => event.createdBy === user.uid) // Default org users see only their own
          : allEvents.filter(event =>
              event.visibility === 'public' &&
              event.organizationId &&
              event.organizationId !== DEFAULT_ORGANIZATION_ID
            );

        setEvents(filteredEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user, isProOrg, organization?.id]);

  const formatEventDate = (date: Timestamp) => {
    const d = date.toDate();
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  };

  const getMonthDay = (date: Timestamp) => {
    const d = date.toDate();
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }),
      day: d.getDate().toString()
    };
  };

  const formatTime = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`;
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <ResponsiveLayout>
      <header className="bg-card p-4 border-b border-border sticky top-0 z-10 lg:static">
        <div className="flex items-center justify-between">
          <PageHeader />
          <AccountButton />
        </div>
      </header>

      <div className="p-4 lg:p-6 space-y-6 mx-auto max-w-7xl">
          {/* Month Header */}
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">{getCurrentMonthYear()}</h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <Card className="p-6 border-border text-center">
              <p className="text-muted-foreground">No events available</p>
            </Card>
          ) : (
            /* Events List - Responsive Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => {
                const { month, day } = getMonthDay(event.date);
                return (
                <div key={event.id} className="flex gap-4">
                  {/* Calendar Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 border-4 border-muted rounded-xl flex flex-col items-center justify-center bg-background">
                      <div className="flex gap-2 mb-1">
                        <div className="w-2 h-6 bg-muted rounded-full"></div>
                        <div className="w-2 h-6 bg-muted rounded-full"></div>
                      </div>
                      <div className="text-5xl font-bold text-muted-foreground leading-none mb-1">
                        {day}
                      </div>
                      <div className="text-lg text-muted-foreground">
                        {month}
                      </div>
                    </div>
                  </div>

                  {/* Event Details Card */}
                  <Card className="flex-1 border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl text-primary">
                        {event.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{formatEventDate(event.date)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(event.startTime, event.endTime)}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="underline">{event.locationName}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Folder className="w-4 h-4" />
                        <span className="underline">{event.category}</span>
                      </div>

                      <p className="text-sm text-muted-foreground pt-2 line-clamp-2">
                        {event.description}
                      </p>

                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => navigate(`/event/${event.id}`)}
                      >
                        MORE INFO
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
            </div>
          )}
      </div>
    </ResponsiveLayout>
  );
};

export default Events;
