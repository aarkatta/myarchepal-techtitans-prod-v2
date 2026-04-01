import { Heart, Landmark, Users, BookOpen, ExternalLink } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DONATION_TIERS = [
  {
    label: "Supporter",
    amount: "$10",
    description: "Helps digitize one archaeological site record",
    color: "text-green-600",
    bg: "bg-green-500/10",
  },
  {
    label: "Contributor",
    amount: "$25",
    description: "Funds AI-assisted form extraction for a batch of 5 sites",
    color: "text-blue-600",
    bg: "bg-blue-500/10",
  },
  {
    label: "Advocate",
    amount: "$50",
    description: "Sponsors a full field survey digitization session",
    color: "text-purple-600",
    bg: "bg-purple-500/10",
  },
  {
    label: "Champion",
    amount: "$100+",
    description: "Enables a community workshop on digital heritage preservation",
    color: "text-amber-600",
    bg: "bg-amber-500/10",
  },
];

const IMPACT_ITEMS = [
  {
    icon: Landmark,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    title: "65,000+ Sites",
    desc: "NC archaeological sites waiting to be digitized and preserved",
  },
  {
    icon: BookOpen,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "100+ Form Types",
    desc: "Unique site form types converted into searchable digital records",
  },
  {
    icon: Users,
    color: "text-green-500",
    bg: "bg-green-500/10",
    title: "Open Access",
    desc: "Free tools for researchers, archaeologists, and communities",
  },
];

const Giveback = () => {
  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 border-b border-border sticky top-0 z-40 lg:static">
        <PageHeader />
      </header>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in mx-auto max-w-3xl">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10">
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">Give Back</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto font-sans">
            Help preserve North Carolina's archaeological heritage for future generations.
            Every contribution directly funds the digitization and protection of irreplaceable historical sites.
          </p>
        </div>

        {/* Impact stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {IMPACT_ITEMS.map(({ icon: Icon, color, bg, title, desc }) => (
            <Card key={title} className="border-border/50">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="font-semibold text-sm font-sans">{title}</p>
                <p className="text-[11px] text-muted-foreground font-sans">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Donation tiers */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Choose Your Impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DONATION_TIERS.map(({ label, amount, description, color, bg }) => (
              <div
                key={label}
                className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                  <span className={`text-sm font-bold ${color}`}>{amount}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm font-sans">{label}</p>
                  <p className="text-xs text-muted-foreground font-sans">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Donate CTA */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-5 sm:p-6 text-center space-y-4">
            <p className="text-sm sm:text-base text-foreground font-sans">
              Donations are processed securely. 100% of proceeds go toward digitization
              infrastructure, field consultant tools, and open-access archaeological research.
            </p>
            <Button asChild className="w-full sm:w-auto gap-2">
              <a
                href="mailto:fllseason2526@gmail.com?subject=Donation%20Inquiry%20-%20ArchePal&body=Hi%2C%20I%20would%20like%20to%20make%20a%20donation%20to%20support%20ArchePal."
                target="_blank"
                rel="noopener noreferrer"
              >
                <Heart className="w-4 h-4" />
                Donate Now
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground font-sans">
              Questions? Email us at{" "}
              <a href="mailto:fllseason2526@gmail.com" className="text-primary hover:underline">
                fllseason2526@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>

      </div>
    </ResponsiveLayout>
  );
};

export default Giveback;
