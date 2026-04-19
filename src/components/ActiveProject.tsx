import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Loader2, FileText } from "lucide-react";
import { useSites } from "@/hooks/use-sites";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { ArchaeologistService } from "@/services/archaeologists";
import { SiteConditions } from "@/components/SiteConditions";
import { Timestamp } from "firebase/firestore";
import { useState, useEffect } from "react";
import { parseDate } from "@/lib/utils";

export const ActiveProject = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const { isArchaeologist } = useArchaeologist();
  const { sites: allSites, loading } = useSites();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [fetchingActiveProject, setFetchingActiveProject] = useState(false);

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');

  // Filter sites based on organization type
  // - Pro/Enterprise org users: See content belonging to their organization
  // - Default/Free org users: See ONLY their own content (createdBy)
  // - Non-signed-in users: See ONLY public content from Pro/Enterprise orgs (not default org)
  // Soft-deleted sites (deletedAt set) are excluded for all audiences.
  const visibleSites = allSites.filter(site => !site.deletedAt);
  const sites = user
    ? isProOrg
      ? visibleSites.filter(site => site.organizationId === organization?.id)
      : visibleSites.filter(site => site.createdBy === user.uid) // Default org users see only their own
    : visibleSites.filter(site =>
        site.visibility === 'public' &&
        site.organizationId &&
        site.organizationId !== DEFAULT_ORGANIZATION_ID
      );

  // Fetch active project ID for archaeologist
  useEffect(() => {
    const fetchActiveProject = async () => {
      if (user && isArchaeologist) {
        try {
          setFetchingActiveProject(true);
          const activeId = await ArchaeologistService.getActiveProjectId(user.uid);
          setActiveProjectId(activeId);
        } catch (error) {
          console.error("Error fetching active project:", error);
        } finally {
          setFetchingActiveProject(false);
        }
      }
    };

    fetchActiveProject();
  }, [user, isArchaeologist]);

  // For archaeologists: show their active project + 2 latest sites
  // For non-archaeologists: show 2 latest sites
  const getDisplaySites = () => {
    if (isArchaeologist && activeProjectId) {
      // Find the active project
      const activeProject = sites.find(site => site.id === activeProjectId);

      // Get latest sites sorted by creation date, excluding the active project
      const latestSites = sites
        .filter(site => site.id !== activeProjectId)
        .sort((a, b) => {
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        })
        .slice(0, 2);

      // Return active project first, then latest sites
      return activeProject ? [activeProject, ...latestSites] : latestSites;
    } else {
      // Show 2 most recent sites
      return sites
        .sort((a, b) => {
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        })
        .slice(0, 2);
    }
  };

  const displaySites = getDisplaySites();

  const formatDate = (date: Date | Timestamp | undefined | any) => {
    const d = parseDate(date);
    if (!d) return "Unknown date";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getLocationDisplay = (site: any) => {
    const parts = [];
    if (site.location?.region) parts.push(site.location.region);
    if (site.location?.country) parts.push(site.location.country);
    return parts.join(", ") || "Location not specified";
  };

  if (loading || fetchingActiveProject) {
    return (
      <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-muted/30">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-8 md:py-12">
          <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3 md:mb-4 lg:mb-5">
          <h3 className="text-h3 font-bold text-foreground font-heading leading-tight tracking-tight">
            {isArchaeologist && activeProjectId ? "Active Project & Recent Sites" : "Recent Sites"}
          </h3>
          <button
            onClick={() => navigate("/site-lists")}
            className="text-body-sm text-primary font-medium hover:underline font-sans"
          >
            View All
          </button>
        </div>

        {displaySites.length === 0 ? (
          <Card className="p-6 md:p-8 lg:p-12 border-border/50 text-center">
            <p className="text-muted-foreground text-body font-sans leading-normal">No sites available</p>
          </Card>
        ) : (
          <div
            className="grid gap-3 md:gap-4 lg:gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 500px), 1fr))' }}
          >
            {displaySites.map((site, index) => {
              const isActiveProject = isArchaeologist && site.id === activeProjectId;
              return (
              <Card
                key={site.id}
                className={`p-3 sm:p-4 border-border/50 hover:shadow-lg active:scale-[0.99] lg:active:scale-100 transition-all duration-200 cursor-pointer animate-slide-up group ${
                  isActiveProject ? 'ring-2 ring-primary/50 bg-primary/5' : ''
                }`}
                style={{ animationDelay: `${index * 75}ms` }}
                onClick={() => navigate(`/site/${site.id}`)}
              >
                <div className="flex gap-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-muted rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                    {site.images && site.images.length > 0 ? (
                      <img
                        src={site.images[0]}
                        alt={site.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<span class="text-2xl sm:text-3xl">🏛️</span>';
                          }
                        }}
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl">🏛️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base lg:text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {site.name}
                        </h4>
                        {isActiveProject && (
                          <Badge variant="outline" className="mt-1 bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs">
                            Active Project
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 lg:w-4 lg:h-4 flex-shrink-0" />
                        <span className="truncate">{getLocationDisplay(site)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3 lg:w-4 lg:h-4 flex-shrink-0" />
                        <span>{formatDate(site.updatedAt || site.createdAt)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground line-clamp-2 mb-2 sm:mb-3">
                      {site.description || "No description available"}
                    </p>

                    <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 lg:w-4 lg:h-4" />
                          <span>{site.artifacts?.length || 0} artifacts</span>
                        </div>
                        {site.period && (
                          <span className="text-muted-foreground">{site.period}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Site Conditions - Only for Active Project */}
                {isActiveProject && user && isArchaeologist && site.location?.latitude && site.location?.longitude && (
                  <div className="mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    <SiteConditions
                      latitude={site.location.latitude}
                      longitude={site.location.longitude}
                    />
                  </div>
                )}
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
