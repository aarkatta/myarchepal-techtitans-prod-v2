import { ReactNode } from "react";
import { SideNav } from "./SideNav";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { FreeOrgBanner } from "./FreeOrgBanner";
import { useUser } from "@/hooks/use-user";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";

interface ResponsiveLayoutProps {
  children: ReactNode;
  /** Show bottom nav padding on mobile - default true */
  showBottomNav?: boolean;
  /** Full width content without max-width constraint */
  fullWidth?: boolean;
  /** Custom class for the main content area */
  className?: string;
}

/**
 * ResponsiveLayout Component
 *
 * Provides responsive layout structure:
 * - Mobile (<1024px): Full width with bottom navigation
 * - Desktop (>=1024px): Side navigation with content offset
 *
 * Features:
 * - Automatic safe area handling
 * - Consistent navigation across all pages
 * - Two-column layout support on desktop
 */
export const ResponsiveLayout = ({
  children,
  showBottomNav = true,
  fullWidth = false,
  className = "",
}: ResponsiveLayoutProps) => {
  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Side Navigation - Only visible on desktop (lg+) */}
      <SideNav />

      {/* Main Content Area */}
      <div className={`
        min-h-screen
        lg:ml-64 xl:ml-72
        ${showBottomNav ? 'pb-nav lg:pb-0' : ''}
        ${className}
        flex flex-col
      `}>
        <FreeOrgBanner />
        <div className={`flex-1 ${fullWidth ? 'w-full' : 'w-full max-w-7xl mx-auto'}`}>
          {children}
        </div>

        {/* Footer - Hidden on mobile when bottom nav is shown */}
        <div className={showBottomNav ? 'hidden lg:block' : ''}>
          <Footer />
        </div>
      </div>

      {/* Bottom Navigation - Only visible on mobile */}
      {showBottomNav && <BottomNav />}
    </div>
  );
};

/**
 * TwoColumnLayout Component
 *
 * Creates a responsive two-column layout:
 * - Mobile: Single column, stacked vertically
 * - Desktop: Two columns side by side
 */
interface TwoColumnLayoutProps {
  /** Main/primary content - takes more space on desktop */
  mainContent: ReactNode;
  /** Sidebar/secondary content */
  sideContent: ReactNode;
  /** Reverse order on mobile (side content first) */
  reverseMobile?: boolean;
  /** Custom gap between columns */
  gap?: string;
}

export const TwoColumnLayout = ({
  mainContent,
  sideContent,
  reverseMobile = false,
  gap = "gap-6 lg:gap-8",
}: TwoColumnLayoutProps) => {
  return (
    <div className={`
      flex flex-col lg:flex-row
      ${gap}
      ${reverseMobile ? 'flex-col-reverse lg:flex-row' : ''}
    `}>
      {/* Main Content - Full width on mobile, 2/3 on desktop */}
      <div className="w-full lg:w-2/3 xl:w-3/5">
        {mainContent}
      </div>

      {/* Side Content - Full width on mobile, 1/3 on desktop */}
      <div className="w-full lg:w-1/3 xl:w-2/5">
        {sideContent}
      </div>
    </div>
  );
};

/**
 * ContentSection Component
 *
 * Provides consistent padding and max-width for content sections
 */
interface ContentSectionProps {
  children: ReactNode;
  className?: string;
  /** Remove horizontal padding */
  noPadding?: boolean;
}

export const ContentSection = ({
  children,
  className = "",
  noPadding = false,
}: ContentSectionProps) => {
  return (
    <div className={`
      ${noPadding ? '' : 'px-4 sm:px-6 lg:px-8'}
      py-4 sm:py-6 lg:py-8
      ${className}
    `}>
      {children}
    </div>
  );
};

/**
 * PageHeader Component (Responsive)
 *
 * Creates a sticky header for pages with proper responsive styling
 */
interface ResponsivePageHeaderProps {
  children: ReactNode;
  className?: string;
}

export const ResponsivePageHeader = ({
  children,
  className = "",
}: ResponsivePageHeaderProps) => {
  return (
    <header className={`
      bg-card/95 backdrop-blur-lg
      px-4 py-4 sm:px-6 lg:px-8 lg:py-6
      border-b border-border
      sticky top-0 z-40
      ${className}
    `}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </header>
  );
};

/**
 * CardGrid Component
 *
 * Responsive grid for cards:
 * - 1 column on mobile
 * - 2 columns on tablet
 * - 3 columns on desktop
 * - 4 columns on large desktop
 */
interface CardGridProps {
  children: ReactNode;
  /** Number of columns on different breakpoints */
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  className?: string;
}

export const CardGrid = ({
  children,
  cols = { default: 1, sm: 2, lg: 3, xl: 4 },
  className = "",
}: CardGridProps) => {
  const getGridCols = () => {
    const classes = [];
    if (cols.default) classes.push(`grid-cols-${cols.default}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    return classes.join(' ');
  };

  return (
    <div className={`
      grid
      ${getGridCols()}
      gap-3 sm:gap-4 lg:gap-6
      ${className}
    `}>
      {children}
    </div>
  );
};
