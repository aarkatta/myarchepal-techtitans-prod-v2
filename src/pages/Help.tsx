import { ResponsiveLayout } from "@/components/ResponsiveLayout";

const videos = [
  {
    id: "2jiy1DVv8mw",
    title: "ArchePal - The future of the past is in our hands!",
  },
  // Add remaining 17 videos here:
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
  // { id: "YOUTUBE_ID", title: "Video Title" },
];

const Help = () => {
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
              <a href="mailto:support@myarchepal.com" className="text-primary hover:underline">
                support@myarchepal.com
              </a>
            </p>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Responsive 16:9 embed */}
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${video.id}`}
                    title={video.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{video.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Help;
