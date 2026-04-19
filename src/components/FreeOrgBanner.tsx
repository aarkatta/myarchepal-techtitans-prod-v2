import { Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { DEFAULT_ORGANIZATION_ID, SUBSCRIPTION_LEVELS } from "@/types/organization";

export const FreeOrgBanner = () => {
  const { isAuthenticated } = useAuth();
  const { organization } = useUser();

  if (!isAuthenticated) return null;

  const isDefaultOrg = !organization || organization.id === DEFAULT_ORGANIZATION_ID;
  const isFreeSubscription =
    organization?.subscriptionLevel === SUBSCRIPTION_LEVELS.FREE;

  if (!isDefaultOrg && !isFreeSubscription) return null;

  return (
    <div className="overflow-hidden">
      <div className="banner-flyin w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-3 py-2 sm:px-4">
        <div className="max-w-7xl mx-auto flex items-start gap-2 sm:items-center">
          <Info className="banner-icon w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-amber-600 dark:text-amber-400" />
          <p className="banner-text flex-1 text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-snug">
            You are currently associated with Demo Organization. To use ArchePal for your Archaeology organization data management contact us at{" "}
            <a
              href="mailto:techtitansnc@gmail.com"
              className="banner-link font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
            >
              techtitansnc@gmail.com
            </a>{" "}
            and we can setup your private organization to support Data Security &amp; Privacy.
          </p>
        </div>
      </div>
    </div>
  );
};
