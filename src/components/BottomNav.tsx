import {
  Home, Compass, Newspaper, Package, Calendar, Store,
  Menu, Users, User, Settings, Lock, Info, Mail, LogOut, ChevronRight, BookOpen,
  Building2, Shield, ClipboardList, Upload, Moon, Sun, Trash2, FileText, MapPin,
  Gift, HelpCircle, Star,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";


export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { can } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuItemClick = (path: string) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const isSitesActive = isActive("/site-lists");
  const isGiftShopActive = isActive("/gift-shop") || (location.pathname === "/artifacts" && location.search === "?type=3d");

  // Helper to build a menu row
  const menuRow = (
    icon: React.ElementType,
    label: string,
    description: string,
    active: boolean,
    onClick: () => void,
    destructive = false,
  ) => {
    const Icon = icon;
    return (
      <Button
        key={label}
        variant="ghost"
        className={`w-full h-auto py-3 px-4 flex items-center gap-4 active:scale-[0.98] rounded-xl transition-all justify-start ${
          destructive ? "hover:bg-destructive/10" : "hover:bg-muted/80"
        }`}
        onClick={onClick}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          destructive ? "bg-destructive/10" : active ? "bg-primary/20" : "bg-muted"
        }`}>
          <Icon className={`w-5 h-5 ${destructive ? "text-destructive" : active ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="text-left flex-1">
          <div className={`text-body font-semibold font-sans leading-snug ${destructive ? "text-destructive" : "text-foreground"}`}>
            {label}
          </div>
          <div className="text-caption text-muted-foreground font-sans leading-snug">{description}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Button>
    );
  };

  return (
    <>
      {/* Bottom Navigation Bar - Hidden on desktop (lg+) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border shadow-lg z-50 safe-bottom">
        {/* Footer Info Strip — matches desktop Footer.tsx */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground px-2 pt-1.5 pb-0.5 flex-wrap">
          <span>&copy; {new Date().getFullYear()} ArchePal</span>
          <span>|</span>
          <Link to="/feedback-results" className="hover:text-primary transition-colors flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5" />Testimonials
          </Link>
          <span>|</span>
          <Link to="/about-us" className="hover:text-primary transition-colors">About Us</Link>
          <span>|</span>
          <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
          <span>|</span>
          <Link to="/giveback" className="hover:text-primary transition-colors">Giveback</Link>
          <span>|</span>
          <Link to="/help" className="hover:text-primary transition-colors">Help</Link>
        </div>

        <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2">

          {/* Home */}
          <button
            onClick={() => navigate("/")}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isActive("/") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Home</span>
          </button>

          {/* Sites */}
          <button
            onClick={() => navigate("/site-lists")}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isSitesActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Compass className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Sites</span>
          </button>

          {/* Diary */}
          <button
            onClick={() => navigate("/digital-diary")}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isActive("/digital-diary") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Diary</span>
          </button>

          {/* Help */}
          <button
            onClick={() => navigate("/help")}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isActive("/help") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <HelpCircle className="w-6 h-6" />
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">Help</span>
          </button>

          {/* Account — opens menu sheet */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className={`flex flex-col items-center gap-0.5 p-3 min-w-[4rem] rounded-xl transition-all duration-200 active:scale-95 ${
              isActive("/account") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {isAuthenticated ? <User className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            <span className="text-micro font-medium leading-snug font-sans tracking-wide">
              {isAuthenticated ? "Account" : "More"}
            </span>
          </button>
        </div>
      </nav>

      {/* Unified Menu Sheet — mirrors SideNav structure */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="bottom" className="max-w-lg mx-auto rounded-t-3xl safe-bottom max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-h3 font-heading font-bold leading-tight">
              {isAuthenticated ? "Menu" : "More"}
            </SheetTitle>
            <SheetDescription className="text-body-sm font-sans text-muted-foreground leading-normal">
              Navigate to any section
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-1 pb-4">
            {/* Content navigation — matches SideNav top items */}
            <p className="px-4 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Explore</p>
            {menuRow(BookOpen, "Diary", "Write in your digital diary", isActive("/digital-diary"), () => handleMenuItemClick("/digital-diary"))}
            {menuRow(Package, "Artifacts", "Explore discovered artifacts", isActive("/artifacts") && location.search !== "?type=3d", () => handleMenuItemClick("/artifacts"))}
            {menuRow(Newspaper, "Articles", "Read research articles", isActive("/articles"), () => handleMenuItemClick("/articles"))}
            {menuRow(Calendar, "Events", "Upcoming events", isActive("/events"), () => handleMenuItemClick("/events"))}
            {menuRow(Store, "Gift Shop", "Browse merchandise & 3D artifacts", isGiftShopActive, () => handleMenuItemClick("/gift-shop"))}

            {isAuthenticated && (
              <>
                {/* Member section */}
                {can('assignments:view-own') && !can('org:manage') && (
                  <>
                    <div className="border-t border-border my-2" />
                    <p className="px-4 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Work</p>
                    {menuRow(ClipboardList, "My Assignments", "View and fill assigned forms",
                      location.pathname.startsWith("/my-assignments") || location.pathname.startsWith("/form/"),
                      () => handleMenuItemClick("/my-assignments"))}
                    {menuRow(Upload, "Upload Paper Form", "Scan or upload a filled form",
                      location.pathname.startsWith("/upload-filled-form"),
                      () => handleMenuItemClick("/upload-filled-form"))}
                  </>
                )}

                {/* Admin section — matches SideNav Admin collapsible */}
                {can('org:manage') && (
                  <>
                    <div className="border-t border-border my-2" />
                    <p className="px-4 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
                    {menuRow(Upload, "Upload Paper Form", "Scan or upload a filled form",
                      location.pathname.startsWith("/upload-filled-form"),
                      () => handleMenuItemClick("/upload-filled-form"))}
                    {menuRow(FileText, "Site Forms", "Manage site form templates",
                      location.pathname.startsWith("/templates"),
                      () => handleMenuItemClick("/templates"))}
                    {menuRow(Building2, "Organization", "Manage your organization",
                      isActive("/org-dashboard"),
                      () => handleMenuItemClick("/org-dashboard"))}
                    {menuRow(MapPin, "Sites", "Manage site assignments",
                      location.pathname.startsWith("/admin-assignments") || location.pathname.startsWith("/assign-form"),
                      () => handleMenuItemClick("/admin-assignments"))}
                    {menuRow(Users, "Users", "Manage organization users",
                      isActive("/admin-users"),
                      () => handleMenuItemClick("/admin-users"))}
                    {can('admin:panel') && menuRow(Shield, "Super Admin", "Global admin dashboard",
                      isActive("/admin"),
                      () => handleMenuItemClick("/admin"))}
                  </>
                )}

                {/* Account section — matches SideNav Account collapsible */}
                <div className="border-t border-border my-2" />
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</p>
                {menuRow(User, "Profile", "View your profile", isActive("/account"), () => handleMenuItemClick("/account"))}
                {menuRow(Lock, "Change Password", "Update your password", isActive("/edit-profile"), () => handleMenuItemClick("/edit-profile"))}
                {menuRow(Settings, "Preferences", "App settings", false, () => handleMenuItemClick("/account"))}
                {menuRow(Trash2, "Deactivate Account", "Delete your account permanently", false, () => handleMenuItemClick("/deactivate"), true)}

                {/* Dark Mode */}
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={toggleTheme}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">{theme === 'dark' ? "Light Mode" : "Dark Mode"}</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Switch appearance</div>
                  </div>
                </Button>

                {/* Logout */}
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-destructive/10 active:scale-[0.98] rounded-xl transition-all justify-start border-t border-border mt-2 pt-4"
                  onClick={handleLogout}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-destructive/10">
                    <LogOut className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-destructive font-sans leading-snug">Logout</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Sign out of your account</div>
                  </div>
                </Button>
              </>
            )}

            {/* Non-authenticated */}
            {!isAuthenticated && (
              <>
                <div className="border-t border-border my-2" />
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Info</p>
                {menuRow(Info, "About Us", "Learn about ArchePal", isActive("/about-us"), () => handleMenuItemClick("/about-us"))}
                {menuRow(Mail, "Contact Us", "Get in touch with us", isActive("/contact"), () => handleMenuItemClick("/contact"))}
                {menuRow(Gift, "Giveback", "Support archaeology", isActive("/giveback"), () => handleMenuItemClick("/giveback"))}
                {menuRow(HelpCircle, "Help", "Get assistance", isActive("/help"), () => handleMenuItemClick("/help"))}

                {/* Dark Mode */}
                <Button
                  variant="ghost"
                  className="w-full h-auto py-3 px-4 flex items-center gap-4 hover:bg-muted/80 active:scale-[0.98] rounded-xl transition-all justify-start"
                  onClick={toggleTheme}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-body font-semibold text-foreground font-sans leading-snug">{theme === 'dark' ? "Light Mode" : "Dark Mode"}</div>
                    <div className="text-caption text-muted-foreground font-sans leading-snug">Switch appearance</div>
                  </div>
                </Button>

                <div className="pt-4 mt-2 border-t border-border space-y-2">
                  <Button className="w-full h-11" onClick={() => handleMenuItemClick("/authentication/sign-in")}>
                    Sign In
                  </Button>
                  <Button variant="outline" className="w-full h-10" onClick={() => handleMenuItemClick("/authentication/sign-up")}>
                    Create Account
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

    </>
  );
};
