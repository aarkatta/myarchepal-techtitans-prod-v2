import {
  Home,
  Compass,
  Package,
  Newspaper,
  Calendar,
  Store,
  Box,
  User,
  Lock,
  Settings,
  LogOut,
  LogIn,
  BookOpen,
  Building2,
  Shield,
  FileText,
  ClipboardList,
  Moon,
  Sun,
  ChevronDown,
  MapPin,
  Users,
  Trash2,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const SideNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isSuperAdmin, isAdmin, isMember } = useUser();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [isGiftShopOpen, setIsGiftShopOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const is3DArtifactsActive =
    location.pathname === "/artifacts" &&
    location.search === "?type=3d";

  const isGiftShopActive =
    isActive("/gift-shop") || is3DArtifactsActive;

  const isAdminActive =
    isActive("/admin") ||
    isActive("/org-dashboard") ||
    location.pathname.startsWith("/templates") ||
    location.pathname.startsWith("/admin-assignments") ||
    location.pathname.startsWith("/assign-form") ||
    isActive("/admin-users");

  const isAccountActive =
    isActive("/account") ||
    isActive("/edit-profile") ||
    isActive("/deactivate");

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group mb-1 ${
      active
        ? "bg-primary/10 text-primary"
        : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
    }`;

  const subItemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors ${
      active
        ? "text-primary bg-primary/5"
        : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-muted/50"
    }`;

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 xl:w-72 bg-card border-r border-border z-50">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/archepal.png"
            alt="ArchePal Logo"
            className="w-10 h-10 xl:w-12 xl:h-12 object-contain"
          />
          <span className="text-xl xl:text-2xl font-bold text-foreground tracking-tight font-sans">
            ArchePal
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Home */}
        <button
          onClick={() => navigate("/")}
          className={navItemClass(isActive("/"))}
        >
          <Home className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive("/") ? "text-primary" : ""}`} />
          <span>Home</span>
        </button>

        {/* Sites */}
        <button
          onClick={() => navigate("/site-lists")}
          className={navItemClass(isActive("/site-lists"))}
        >
          <Compass className={`w-5 h-5 ${isActive("/site-lists") ? "text-primary" : ""}`} />
          <span>Sites</span>
        </button>

        {/* Diary */}
        <button
          onClick={() => navigate("/digital-diary")}
          className={navItemClass(isActive("/digital-diary"))}
        >
          <BookOpen className={`w-5 h-5 ${isActive("/digital-diary") ? "text-primary" : ""}`} />
          <span>Diary</span>
        </button>

        {/* Artifacts */}
        <button
          onClick={() => navigate("/artifacts")}
          className={navItemClass(isActive("/artifacts") && !is3DArtifactsActive)}
        >
          <Package className={`w-5 h-5 ${isActive("/artifacts") && !is3DArtifactsActive ? "text-primary" : ""}`} />
          <span>Artifacts</span>
        </button>

        {/* Articles */}
        <button
          onClick={() => navigate("/articles")}
          className={navItemClass(isActive("/articles"))}
        >
          <Newspaper className={`w-5 h-5 ${isActive("/articles") ? "text-primary" : ""}`} />
          <span>Articles</span>
        </button>

        {/* Events */}
        <button
          onClick={() => navigate("/events")}
          className={navItemClass(isActive("/events"))}
        >
          <Calendar className={`w-5 h-5 ${isActive("/events") ? "text-primary" : ""}`} />
          <span>Events</span>
        </button>

        {/* Gift Shop Collapsible */}
        <Collapsible open={isGiftShopOpen} onOpenChange={setIsGiftShopOpen} className="mb-1">
          <CollapsibleTrigger asChild>
            <button
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isGiftShopActive && !isGiftShopOpen
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Store className={`w-5 h-5 ${isGiftShopActive ? "text-primary" : ""}`} />
                Gift Shop
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isGiftShopOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-0.5">
            <button
              onClick={() => navigate("/gift-shop")}
              className={subItemClass(isActive("/gift-shop") && !is3DArtifactsActive)}
            >
              <Store className="w-4 h-4" />
              Merchandise
            </button>
            <button
              onClick={() => navigate("/artifacts?type=3d")}
              className={subItemClass(is3DArtifactsActive)}
            >
              <Box className="w-4 h-4" />
              3D Artifacts
            </button>
          </CollapsibleContent>
        </Collapsible>

        {/* Admin Collapsible — for admins only */}
        {isAuthenticated && isAdmin && (
          <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen} className="mb-1">
            <CollapsibleTrigger asChild>
              <button
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isAdminActive && !isAdminOpen
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Shield className={`w-5 h-5 ${isAdminActive ? "text-primary" : ""}`} />
                  Admin
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isAdminOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0.5">
              <button
                onClick={() => navigate("/templates")}
                className={subItemClass(location.pathname.startsWith("/templates"))}
              >
                <FileText className="w-4 h-4" />
                Site Forms
              </button>
              <button
                onClick={() => navigate("/org-dashboard")}
                className={subItemClass(isActive("/org-dashboard"))}
              >
                <Building2 className="w-4 h-4" />
                Organization
              </button>
              <button
                onClick={() => navigate("/admin-assignments")}
                className={subItemClass(
                  location.pathname.startsWith("/admin-assignments") ||
                  location.pathname.startsWith("/assign-form")
                )}
              >
                <MapPin className="w-4 h-4" />
                Sites
              </button>
              <button
                onClick={() => navigate("/admin-users")}
                className={subItemClass(isActive("/admin-users"))}
              >
                <Users className="w-4 h-4" />
                Users
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => navigate("/admin")}
                  className={subItemClass(isActive("/admin"))}
                >
                  <Shield className="w-4 h-4" />
                  Super Admin
                </button>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* My Assignments — MEMBER only (not admin) */}
        {isAuthenticated && isMember && !isAdmin && (
          <button
            onClick={() => navigate("/my-assignments")}
            className={navItemClass(
              location.pathname.startsWith("/my-assignments") ||
              location.pathname.startsWith("/form/")
            )}
          >
            <ClipboardList
              className={`w-5 h-5 ${
                location.pathname.startsWith("/my-assignments") ||
                location.pathname.startsWith("/form/")
                  ? "text-primary"
                  : ""
              }`}
            />
            <span>My Assignments</span>
          </button>
        )}

        {/* Account Collapsible — authenticated users only */}
        {isAuthenticated && (
          <Collapsible
            open={isAccountOpen}
            onOpenChange={setIsAccountOpen}
            className="mt-4 pt-4 border-t border-border/50"
          >
            <CollapsibleTrigger asChild>
              <button
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isAccountActive && !isAccountOpen
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <User className={`w-5 h-5 ${isAccountActive ? "text-primary" : ""}`} />
                  Account
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isAccountOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0.5">
              <button
                onClick={() => navigate("/account")}
                className={subItemClass(isActive("/account"))}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                onClick={() => navigate("/edit-profile")}
                className={subItemClass(isActive("/edit-profile"))}
              >
                <Lock className="w-4 h-4" />
                Change Password
              </button>
              <button
                onClick={() => navigate("/account")}
                className={subItemClass(false)}
              >
                <Settings className="w-4 h-4" />
                Preferences
              </button>
              <button
                onClick={() => navigate("/deactivate")}
                className={`w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors text-destructive hover:bg-destructive/10`}
              >
                <Trash2 className="w-4 h-4" />
                Deactivate
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 pl-12 text-sm font-medium rounded-lg transition-colors text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      {/* Dark Mode Toggle */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-muted/50 transition-all duration-200"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Sign In Section - Only for Non-Authenticated Users */}
      {!isAuthenticated && (
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="default"
            className="w-full justify-center gap-2 h-11"
            onClick={() => navigate("/authentication/sign-in")}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center gap-2 h-10"
            onClick={() => navigate("/authentication/sign-up")}
          >
            Create Account
          </Button>
        </div>
      )}
    </aside>
  );
};
