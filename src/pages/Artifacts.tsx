import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Calendar, Filter, Grid3X3, List, Loader2, Building2, Plus, WifiOff, CloudOff, Database } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useArtifacts } from "@/hooks/use-artifacts";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Timestamp } from "firebase/firestore";
import { createEmojiElement, getArtifactEmoji } from "@/lib/sanitize";
import { parseDate } from "@/lib/utils";

const periods = ["All", "Imperial Roman", "Roman", "Late Roman", "Byzantine", "Medieval"];
const types = ["All", "Coin", "Ceramic", "Weapon", "Glass", "Personal Ornament", "Sculpture"];

const Artifacts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const { artifacts, loading, error, offlineCount, isOnline, usingCachedData } = useArtifacts();

  // Check if user is in a Pro organization (non-default)
  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');

  // Filter artifacts based on organization type
  // - Pro/Enterprise org users: See content belonging to their organization
  // - Default/Free org users: See ONLY their own content (createdBy)
  // - Non-signed-in users: See ONLY public content from Pro/Enterprise orgs (not default org)
  const orgFilteredArtifacts = user
    ? isProOrg
      ? artifacts.filter(artifact => artifact.organizationId === organization?.id)
      : artifacts.filter(artifact => artifact.createdBy === user.uid) // Default org users see only their own
    : artifacts.filter(artifact =>
        artifact.visibility === 'public' &&
        artifact.organizationId &&
        artifact.organizationId !== DEFAULT_ORGANIZATION_ID
      );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPeriod, setSelectedPeriod] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredArtifacts = orgFilteredArtifacts.filter(artifact => {
    if (selectedPeriod !== "All" && artifact.period !== selectedPeriod) return false;
    if (selectedType !== "All" && artifact.type !== selectedType) return false;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      return artifact.name.toLowerCase().includes(query) ||
             artifact.description.toLowerCase().includes(query) ||
             artifact.material.toLowerCase().includes(query) ||
             artifact.siteName?.toLowerCase().includes(query) ||
             artifact.tags?.some(tag => tag.toLowerCase().includes(query));
    }
    return true;
  });

  const sortedArtifacts = [...filteredArtifacts].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        const dateA = parseDate(a.excavationDate);
        const dateB = parseDate(b.excavationDate);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      case "oldest":
        const oldDateA = parseDate(a.excavationDate);
        const oldDateB = parseDate(b.excavationDate);
        return (oldDateA?.getTime() || 0) - (oldDateB?.getTime() || 0);
      case "name":
        return a.name.localeCompare(b.name);
      case "significance":
        const sigOrder = { "Very High": 0, "High": 1, "Medium": 2, "Low": 3 };
        return (sigOrder[a.significance as keyof typeof sigOrder] || 4) - (sigOrder[b.significance as keyof typeof sigOrder] || 4);
      default:
        return 0;
    }
  });

  const formatDate = (date: Date | Timestamp | undefined | any) => {
    const d = parseDate(date);
    if (!d) return "Unknown date";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case "Very High": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "High": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "Medium": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "Low": return "bg-green-500/10 text-green-600 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "Excellent": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "Good": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Fair": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "Fragment": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "Poor": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleArtifactClick = (artifactId: string) => {
    navigate(`/artifact/${artifactId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading artifacts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <PageHeader showLogo={false} />
            <div className="flex items-center gap-2">
              {/* Offline indicator */}
              {!isOnline && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </div>
              )}
              {offlineCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                  <CloudOff className="w-3 h-3" />
                  <span>{offlineCount} pending</span>
                </div>
              )}
              {usingCachedData && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">
                  <Database className="w-3 h-3" />
                  <span>Cached</span>
                </div>
              )}
              {user && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/create-artifact")}
                  className="hidden lg:flex gap-1.5 text-sm h-9 px-4 shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Artifact
                </Button>
              )}
              <AccountButton />
            </div>
          </div>

          <div className="relative mb-3 sm:mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search artifacts..."
              className="pl-10 h-11 lg:h-12 bg-muted/50 border-0 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <Card className="p-2.5 sm:p-3 lg:p-4 border-border/50 text-center bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-md transition-shadow">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">{orgFilteredArtifacts.length}</p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium">Total</p>
            </Card>
            <Card className="p-2.5 sm:p-3 lg:p-4 border-border/50 text-center bg-gradient-to-br from-orange-500/5 to-orange-500/10 hover:shadow-md transition-shadow">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">
                {orgFilteredArtifacts.filter(a => a.significance === 'High' || a.significance === 'Very High').length}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium">Significant</p>
            </Card>
            <Card className="p-2.5 sm:p-3 lg:p-4 border-border/50 text-center bg-gradient-to-br from-green-500/5 to-green-500/10 hover:shadow-md transition-shadow">
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                {orgFilteredArtifacts.filter(a => a.condition === 'Excellent' || a.condition === 'Good').length}
              </p>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium">Good</p>
            </Card>
          </div>
        </div>
      </header>

      {/* Two-column layout on desktop */}
      <div className="lg:flex lg:gap-8 max-w-7xl mx-auto">
        {/* Main content */}
        <div className="lg:flex-1">
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-9 w-9 lg:h-10 lg:w-10 p-0"
                >
                  <Grid3X3 className="w-4 h-4 lg:w-5 lg:h-5" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-9 w-9 lg:h-10 lg:w-10 p-0"
                >
                  <List className="w-4 h-4 lg:w-5 lg:h-5" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-9 lg:h-10 text-xs sm:text-sm lg:text-base lg:hidden">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>

            <Tabs defaultValue="all" className="w-full lg:hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
                <TabsTrigger value="sort">Sort</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                {renderArtifactsList()}
              </TabsContent>

              <TabsContent value="filters" className="mt-4 space-y-3">
                {renderFilters()}
              </TabsContent>

              <TabsContent value="sort" className="mt-4">
                {renderSortOptions()}
              </TabsContent>
            </Tabs>

            {/* Desktop view - no tabs */}
            <div className="hidden lg:block">
              {renderArtifactsList()}
            </div>
          </div>
        </div>

        {/* Sidebar - Filters on desktop */}
        <div className="hidden lg:block lg:w-80 xl:w-96 lg:flex-shrink-0 p-6">
          <div className="sticky top-32 space-y-6">
            <Card className="p-4 border-border/50">
              <h3 className="font-semibold mb-4">Filters</h3>
              {renderFilters()}
            </Card>
            <Card className="p-4 border-border/50">
              <h3 className="font-semibold mb-4">Sort</h3>
              {renderSortOptions()}
            </Card>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );

  function renderArtifactsList() {
    if (sortedArtifacts.length === 0) {
      return (
        <Card className="p-8 lg:p-12 text-center border-border">
          <Building2 className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground lg:text-lg">
            {searchQuery ? "No artifacts found matching your search." : "No artifacts cataloged yet."}
          </p>
        </Card>
      );
    }

    return (
      <div
        className={viewMode === "grid" ? "grid gap-4" : "space-y-4"}
        style={viewMode === "grid" ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 500px), 1fr))' } : undefined}
      >
        {sortedArtifacts.map((artifact) => {
          const isOfflineArtifact = 'isOffline' in artifact && artifact.isOffline;
          return (
          <Card
            key={artifact.id}
            className={`p-3 sm:p-4 border-border/50 hover:shadow-lg active:scale-[0.99] lg:active:scale-100 transition-all cursor-pointer group ${isOfflineArtifact ? 'border-amber-400/50 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
            onClick={() => !isOfflineArtifact && handleArtifactClick(artifact.id!)}
          >
            <div className="flex gap-3 lg:gap-4">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-muted rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform relative">
                {isOfflineArtifact && (
                  <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center z-10">
                    <CloudOff className="w-6 h-6 text-amber-600" />
                  </div>
                )}
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
                        parent.appendChild(createEmojiElement(getArtifactEmoji(artifact.type), 'text-3xl lg:text-4xl'));
                      }
                    }}
                  />
                ) : (
                  <span className="text-3xl lg:text-4xl">
                    {artifact.type === 'Coin' ? '🪙' :
                     artifact.type === 'Ceramic' ? '🏺' :
                     artifact.type === 'Weapon' ? '🗡️' :
                     artifact.type === 'Glass' ? '🍶' :
                     artifact.type === 'Personal Ornament' ? '📎' :
                     artifact.type === 'Sculpture' ? '🗿' :
                     '🏺'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground line-clamp-1 lg:text-lg group-hover:text-primary transition-colors">
                      {artifact.name}
                    </h3>
                    {isOfflineArtifact && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                        Pending Sync
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className={getSignificanceColor(artifact.significance)}>
                    {artifact.significance}
                  </Badge>
                </div>

                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground">
                    <Building2 className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span>{artifact.siteName || "Unknown Site"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span>{artifact.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span>{formatDate(artifact.excavationDate)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-3 text-xs lg:text-sm text-muted-foreground">
                    <Badge variant="outline" className={getConditionColor(artifact.condition)}>
                      {artifact.condition}
                    </Badge>
                    <span>{artifact.material}</span>
                    <span>{artifact.period}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
        })}
      </div>
    );
  }

  function renderFilters() {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Period</label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map(period => (
                <SelectItem key={period} value={period}>{period}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Type</label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  function renderSortOptions() {
    return (
      <div>
        <label className="text-sm font-medium mb-2 block">Sort by</label>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="significance">Significance</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
};

export default Artifacts;