import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Calendar } from "lucide-react";
import { ArtifactsService, Artifact } from "@/services/artifacts";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Timestamp } from "firebase/firestore";
import { parseDate } from "@/lib/utils";

export const RecentFinds = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtifacts = async () => {
      try {
        setLoading(true);
        const fetchedArtifacts = await ArtifactsService.getAllArtifacts();
        setAllArtifacts(fetchedArtifacts);
      } catch (error) {
        console.error("Error fetching artifacts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtifacts();
  }, []);

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');

  // Filter artifacts based on organization type
  // - Pro/Enterprise org users: See content belonging to their organization
  // - Default/Free org users: See ONLY their own content (createdBy)
  // - Non-signed-in users: See ONLY public content from Pro/Enterprise orgs (not default org)
  const artifacts = user
    ? isProOrg
      ? allArtifacts.filter(artifact => artifact.organizationId === organization?.id)
      : allArtifacts.filter(artifact => artifact.createdBy === user.uid) // Default org users see only their own
    : allArtifacts.filter(artifact =>
        artifact.visibility === 'public' &&
        artifact.organizationId &&
        artifact.organizationId !== DEFAULT_ORGANIZATION_ID
      );

  // Get the 4 most recently created artifacts (for 4-col layout on ultra-wide)
  const recentArtifacts = artifacts
    .sort((a, b) => {
      const dateA = parseDate(a.createdAt);
      const dateB = parseDate(b.createdAt);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    })
    .slice(0, 4);

  const formatDate = (date: Date | Timestamp | undefined | any) => {
    const d = parseDate(date);
    if (!d) return "Unknown date";
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'Coin': return '🪙';
      case 'Ceramic': return '🏺';
      case 'Weapon': return '🗡️';
      case 'Glass': return '🍶';
      case 'Personal Ornament': return '📎';
      case 'Sculpture': return '🗿';
      default: return '🏺';
    }
  };

  if (loading) {
    return (
      <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-8 md:py-12">
          <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3 md:mb-4 lg:mb-5">
          <h3 className="text-h3 font-bold text-foreground font-heading leading-tight tracking-tight">
            Recent Artifacts
          </h3>
          <button
            onClick={() => navigate("/artifacts")}
            className="text-body-sm text-primary font-medium hover:underline font-sans"
          >
            See All
          </button>
        </div>

        {recentArtifacts.length === 0 ? (
          <Card className="p-6 md:p-8 lg:p-12 border-border/50 text-center">
            <p className="text-muted-foreground text-body font-sans leading-normal">No recent artifacts</p>
          </Card>
        ) : (
          <div
            className="grid gap-3 md:gap-4 lg:gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 500px), 1fr))' }}
          >
            {recentArtifacts.map((artifact, index) => (
              <Card
                key={artifact.id}
                className="p-3 sm:p-4 border-border/50 hover:shadow-lg active:scale-[0.99] lg:active:scale-100 transition-all duration-200 cursor-pointer animate-slide-up group"
                style={{ animationDelay: `${index * 75}ms` }}
                onClick={() => navigate(`/artifact/${artifact.id}`)}
              >
                <div className="flex gap-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-muted rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                    {artifact.images && artifact.images.length > 0 ? (
                      <img
                        src={artifact.images[0]}
                        alt={artifact.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<span class="text-2xl sm:text-3xl">${getArtifactIcon(artifact.type)}</span>`;
                          }
                        }}
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl">{getArtifactIcon(artifact.type)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                      <h4 className="font-semibold text-sm sm:text-base lg:text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {artifact.name}
                      </h4>
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border/50 flex-shrink-0 text-[10px] sm:text-xs">
                        {artifact.condition}
                      </Badge>
                    </div>

                    <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 lg:w-4 lg:h-4 flex-shrink-0" />
                        <span className="truncate">{artifact.location || artifact.siteName || "Unknown location"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3 lg:w-4 lg:h-4 flex-shrink-0" />
                        <span>{formatDate(artifact.createdAt)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground line-clamp-2 mb-2 sm:mb-3">
                      {artifact.description || "No description available"}
                    </p>

                    <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                        <span>{artifact.type}</span>
                        <span>•</span>
                        <span>{artifact.material}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
