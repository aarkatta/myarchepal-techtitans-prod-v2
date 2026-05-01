import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Download as DownloadIcon, Smartphone, Wifi, Camera, MapPin } from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/us/app/archepal/id6756281728";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.archepal.app";

const AppStoreBadge = () => (
  <a
    href={APP_STORE_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Download ArchePal on the App Store"
    className="inline-flex items-center gap-3 rounded-xl bg-black px-5 py-3 text-white transition-transform hover:scale-105 hover:shadow-lg"
  >
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
      <path d="M17.564 12.65c-.029-2.97 2.43-4.401 2.541-4.471-1.385-2.025-3.541-2.301-4.305-2.331-1.832-.187-3.578 1.083-4.508 1.083-.93 0-2.367-1.054-3.892-1.026-2.003.029-3.85 1.16-4.881 2.946-2.083 3.612-.531 8.953 1.499 11.886.992 1.434 2.171 3.044 3.717 2.985 1.493-.06 2.057-.965 3.86-.965 1.804 0 2.31.965 3.892.936 1.609-.029 2.626-1.461 3.609-2.904 1.137-1.667 1.604-3.281 1.633-3.366-.036-.018-3.131-1.202-3.165-4.773zM14.624 4.066c.823-.998 1.379-2.382 1.227-3.762-1.187.048-2.625.79-3.476 1.788-.762.882-1.43 2.291-1.25 3.643 1.323.103 2.676-.671 3.499-1.669z" />
    </svg>
    <div className="flex flex-col items-start leading-tight">
      <span className="text-xs font-light">Download on the</span>
      <span className="text-lg font-semibold -mt-0.5">App Store</span>
    </div>
  </a>
);

const PlayStoreBadge = () => (
  <a
    href={PLAY_STORE_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Get ArchePal on Google Play"
    className="inline-flex items-center gap-3 rounded-xl bg-black px-5 py-3 text-white transition-transform hover:scale-105 hover:shadow-lg"
  >
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
      <path
        fill="#34A853"
        d="M3.609 1.814 13.792 12 3.61 22.186a1.51 1.51 0 0 1-.61-1.214V3.028a1.51 1.51 0 0 1 .609-1.214z"
      />
      <path
        fill="#34A853"
        d="M16.806 15.014 13.792 12l3.014-3.014 4.482 2.547c.957.544.957 1.39 0 1.934l-4.482 2.547z"
      />
      <path
        fill="#FBBC04"
        d="m16.806 15.014-3.014-3.014-10.183 10.186c.379.404 1.014.46 1.49.16l11.707-6.66z"
      />
      <path
        fill="#EA4335"
        d="M16.806 8.986 5.099 2.326a1.124 1.124 0 0 0-1.49.16l10.183 9.514 3.014-3.014z"
      />
      <path
        fill="#4285F4"
        d="M3.609 1.814 13.792 12 3.61 22.186a1.51 1.51 0 0 1-.61-1.214V3.028a1.51 1.51 0 0 1 .609-1.214z"
      />
    </svg>
    <div className="flex flex-col items-start leading-tight">
      <span className="text-xs font-light">GET IT ON</span>
      <span className="text-lg font-semibold -mt-0.5">Google Play</span>
    </div>
  </a>
);

export default function Download() {
  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 border-b border-border sticky top-0 z-40 lg:static">
        <PageHeader />
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in mx-auto max-w-5xl">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10">
            <DownloadIcon className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">
            Download the ArchePal App
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto font-sans">
            Take ArchePal with you to the field. Record sites, capture finds, and
            sync your work whenever you reconnect.
          </p>
        </div>

        {/* Store Badges */}
        <Card className="border-border/50">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <AppStoreBadge />
              <PlayStoreBadge />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-5 font-sans">
              Available on iPhone, iPad, and Android devices.
            </p>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-border/50 p-3 sm:p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              </div>
              <h3 className="font-semibold text-xs sm:text-sm font-sans">Native Mobile</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-sans">
                Optimized for iOS and Android
              </p>
            </div>
          </Card>

          <Card className="border-border/50 p-3 sm:p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wifi className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
              </div>
              <h3 className="font-semibold text-xs sm:text-sm font-sans">Offline Ready</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-sans">
                Keep working without signal
              </p>
            </div>
          </Card>

          <Card className="border-border/50 p-3 sm:p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              </div>
              <h3 className="font-semibold text-xs sm:text-sm font-sans">Camera + Media</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-sans">
                Capture artifacts and field photos
              </p>
            </div>
          </Card>

          <Card className="border-border/50 p-3 sm:p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
              </div>
              <h3 className="font-semibold text-xs sm:text-sm font-sans">Location Aware</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-sans">
                Auto-tag GPS coordinates
              </p>
            </div>
          </Card>
        </div>

        {/* Why install */}
        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6 space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold font-heading">
              Why install the app?
            </h2>
            <ul className="space-y-2 text-sm sm:text-base text-foreground font-sans">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Faster site logging from your pocket — no laptop required.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Work offline in remote dig sites; data syncs automatically when you reconnect.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Use the device camera to attach photos directly to artifacts and forms.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>GPS-aware coordinates capture for accurate site mapping.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
