import { useEffect, useState } from "react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpService, type HelpVideo } from "@/services/help";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Play } from "lucide-react";

const Help = () => {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  const openOnYouTube = async (youtubeId: string) => {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`;
    if (isNative) {
      await Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await HelpService.listVideos();
        if (!cancelled) setVideos(rows);
      } catch (err) {
        console.error("Failed to load help videos", err);
        if (!cancelled) toast.error("Failed to load help videos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ResponsiveLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Help &amp; Tutorials</h1>
            <p className="mt-2 text-muted-foreground">
              Watch our video guides to get started with ArchePal. More videos coming soon.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Need more help? Contact us at{" "}
              <a href="mailto:techtitansnc@gmail.com" className="text-primary hover:underline">
                techtitansnc@gmail.com
              </a>
            </p>
          </div>

          {/* Video Grid — two columns */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="w-full" style={{ paddingBottom: "56.25%" }} />
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No help videos available yet. Check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {videos.map((video) => (
                <div
                  key={video.id ?? video.youtubeId}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{video.title}</p>
                  </div>
                  {/* Responsive 16:9 area */}
                  <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                    {isNative ? (
                      <button
                        type="button"
                        onClick={() => openOnYouTube(video.youtubeId)}
                        aria-label={`Play ${video.title} on YouTube`}
                        className="absolute inset-0 w-full h-full group"
                      >
                        <img
                          src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`;
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-600 shadow-lg">
                            <Play className="w-8 h-8 text-white fill-white ml-1" />
                          </div>
                        </div>
                      </button>
                    ) : (
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?playsinline=1&rel=0`}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="no-referrer"
                        allowFullScreen
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Help;
