/**
 * App Header Component
 *
 * Displays the main header with:
 * - App title
 * - User authentication status
 * - Sign in/Sign up buttons when not authenticated
 * - User avatar and greeting when authenticated
 *
 * Responsive breakpoints:
 * - Mobile (< 576px): Compact layout, abbreviated elements
 * - Tablet (576px - 992px): Standard layout
 * - Desktop (992px+): Full layout with enhanced spacing
 */

import { useState, useEffect } from "react";
import { Bell, User, LogIn, LogOut, Mail, WifiOff, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useNetworkStatus } from "@/hooks/use-network";
import { ArchaeologistService, Archaeologist } from "@/services/archaeologists";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";

export const AppHeader = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { organization } = useUser();
  const { isOnline } = useNetworkStatus();
  const [archaeologistProfile, setArchaeologistProfile] = useState<Archaeologist | null>(null);

  // Check if user should see organization branding (PRO subscription, not default org)
  const showOrgBranding = organization &&
    organization.subscriptionLevel === 'Pro' &&
    organization.id !== DEFAULT_ORGANIZATION_ID;

  // Fetch archaeologist profile when user is available
  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.uid) {
        try {
          const profile = await ArchaeologistService.getArchaeologistProfile(user.uid);
          setArchaeologistProfile(profile);
        } catch (error) {
          console.error('Error fetching archaeologist profile:', error);
        }
      } else {
        setArchaeologistProfile(null);
      }
    };

    fetchProfile();
  }, [user?.uid]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Get display name from archaeologist profile or Firebase user
  const displayName = archaeologistProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || "Guest";

  // Generate initials from display name for avatar fallback
  const initials = user ? displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) : "G";

  return (
    <header className="bg-card/95 backdrop-blur-lg px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-5 md:px-6 md:pt-5 md:pb-6 lg:px-8 lg:pt-6 lg:pb-8 sticky top-0 z-40 border-b border-border/50">
      <div className="max-w-7xl mx-auto">
        {/* Top Row: Logo and Actions - Hide logo on desktop (shown in SideNav) */}
        <div className="flex items-center justify-between mb-3 md:mb-4 lg:mb-5">
          {/* Logo Section - Hidden on desktop */}
          <div className="flex items-center gap-2 md:gap-3 lg:hidden">
            <img
              src="/archepal.png"
              alt="ArchePal Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 object-contain"
            />
            <span className="text-display font-bold text-foreground tracking-tight font-sans">
              ArchePal
            </span>
          </div>

          {/* Desktop: Show greeting inline */}
          <div className="hidden lg:block">
            {isAuthenticated && user ? (
              showOrgBranding ? (
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-primary" />
                  <h2 className="text-h2 font-bold text-foreground font-heading leading-tight tracking-tight">
                    {organization?.name}
                  </h2>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    PRO
                  </Badge>
                </div>
              ) : (
                <h2 className="text-h2 font-bold text-foreground font-heading leading-tight tracking-tight">
                  {getGreeting()}, {displayName}
                </h2>
              )
            ) : (
              <h2 className="text-h2 font-bold text-foreground font-heading leading-tight tracking-tight">
                Welcome to ArchePal
              </h2>
            )}
          </div>

          {/* Action Buttons - Only show on mobile (desktop has SideNav) */}
          <div className="flex items-center gap-2 md:gap-3 lg:hidden">
            {/* Offline Indicator */}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium animate-pulse">
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </div>
            )}
            {isAuthenticated ? (
              <>
                <button
                  className="p-2 md:p-2.5 hover:bg-muted active:scale-95 rounded-full transition-all duration-200"
                  onClick={() => navigate("/account")}
                  aria-label="Account"
                >
                  <User className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  className="gap-1.5 text-body-sm px-2 md:px-3 h-8 md:h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/authentication/sign-up")}
                  className="hidden xs:flex gap-1.5 text-body-sm px-2 md:px-3 h-8 md:h-9 font-medium"
                >
                  Sign Up
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/authentication/sign-in")}
                  className="gap-1.5 text-body-sm px-2.5 sm:px-3 md:px-4 h-8 md:h-9 shadow-sm font-medium text-white"
                >
                  <LogIn className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="sm:inline">Sign In</span>
                </Button>
              </>
            )}
          </div>

          {/* Desktop: Account / Auth buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Desktop Offline Indicator */}
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium animate-pulse">
                <WifiOff className="w-4 h-4" />
                <span>Offline Mode</span>
              </div>
            )}
            {isAuthenticated ? (
              <>
                <button
                  className="p-2.5 hover:bg-muted rounded-full transition-all duration-200"
                  onClick={() => navigate("/account")}
                  aria-label="Account"
                >
                  <User className="w-6 h-6 text-muted-foreground" />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/authentication/sign-up")}
                  className="gap-1.5 font-medium"
                >
                  Sign Up
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/authentication/sign-in")}
                  className="gap-1.5 font-medium text-white"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Greeting Section - Mobile only */}
        <div className="lg:hidden">
          {isAuthenticated && user ? (
            showOrgBranding ? (
              <div className="flex items-center gap-3 md:gap-4 animate-fade-in">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-h2 font-bold text-foreground truncate font-heading leading-tight tracking-tight">
                      {organization?.name}
                    </h2>
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      PRO
                    </Badge>
                  </div>
                  <p className="text-body-sm text-muted-foreground font-sans leading-normal">
                    Welcome, {displayName}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 md:gap-4 animate-fade-in">
                <Avatar className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  {(archaeologistProfile?.photoURL || user.photoURL) ? (
                    <AvatarImage src={archaeologistProfile?.photoURL || user.photoURL || undefined} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold font-sans text-body">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-h2 font-bold text-foreground truncate font-heading leading-tight tracking-tight">
                    {getGreeting()}, {displayName}
                  </h2>
                  <p className="text-body-sm text-muted-foreground font-sans leading-normal">
                    Ready for new discoveries?
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="animate-fade-in">
              <h2 className="text-h2 font-bold text-foreground mb-1 font-heading leading-tight tracking-tight">
                {getGreeting()}, Welcome to ArchePal
              </h2>
              <p className="text-body-sm text-muted-foreground font-sans leading-normal">
                Sign in to access your projects and discoveries
              </p>
            </div>
          )}
        </div>

        {/* Desktop: Subtitle */}
        <div className="hidden lg:block">
          {isAuthenticated && user ? (
            showOrgBranding ? (
              <div className="flex items-center gap-4 animate-fade-in">
                <Avatar className="w-12 h-12 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  {(archaeologistProfile?.photoURL || user.photoURL) ? (
                    <AvatarImage src={archaeologistProfile?.photoURL || user.photoURL || undefined} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold font-sans">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <p className="text-body text-muted-foreground font-sans leading-normal">
                  Welcome back, {displayName}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4 animate-fade-in">
                <Avatar className="w-12 h-12 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  {(archaeologistProfile?.photoURL || user.photoURL) ? (
                    <AvatarImage src={archaeologistProfile?.photoURL || user.photoURL || undefined} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold font-sans">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <p className="text-body text-muted-foreground font-sans leading-normal">
                  Ready for new discoveries?
                </p>
              </div>
            )
          ) : (
            <p className="text-body text-muted-foreground font-sans leading-normal">
              Sign in to access your projects and discoveries
            </p>
          )}
        </div>
      </div>
    </header>
  );
};
