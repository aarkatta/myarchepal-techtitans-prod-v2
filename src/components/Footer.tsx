/**
 * Footer Component
 *
 * Standard footer for ArchePal.
 * Displays at the bottom of all pages.
 */

import { Link } from "react-router-dom";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>&copy; {currentYear} ArchePal. All rights reserved.</span>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/feedback-results"
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Testimonials
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/about-us"
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            About Us
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/contact"
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Contact Us
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/giveback"
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Giveback
          </Link>
          <span className="hidden sm:inline">|</span>
          <Link
            to="/help"
            className="hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Help
          </Link>
        </div>
      </div>
    </footer>
  );
};
