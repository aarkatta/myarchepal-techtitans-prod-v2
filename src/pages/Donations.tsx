import { Heart, ExternalLink, Building2, Mail } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// External donation URL
const DONATION_URL = "https://www.archepal.com/#/donations";

const Donations = () => {
  const handleDonateClick = async () => {
    // Opens in external browser (Safari on iOS)
    await Browser.open({ url: DONATION_URL });
  };

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader mobileLogoOnly />
          <AccountButton />
        </div>
      </header>

      {/* Header Section */}
      <div className="p-4 lg:p-6 space-y-4 mx-auto max-w-7xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Support Our Mission</h1>
          <p className="text-muted-foreground">
            Help us preserve and discover archaeological treasures. Your donation makes a difference.
          </p>
        </div>
      </div>

      {/* Donation Information */}
      <div className="px-4 lg:px-6 pb-6 space-y-6 mx-auto max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Make a Donation</CardTitle>
            <CardDescription>
              Every contribution helps us continue our archaeological research and preservation efforts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Your generous donation supports:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Archaeological excavations and research projects</li>
                <li>Preservation of historical artifacts and sites</li>
                <li>Educational programs and community outreach</li>
                <li>Development of digital preservation technologies</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Donations are processed securely through our website. You will be redirected to complete your donation.
              </p>
            </div>

            <Button onClick={handleDonateClick} className="w-full" size="lg">
              <ExternalLink className="w-4 h-4 mr-2" />
              Donate via Website
            </Button>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Other Ways to Help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Bank Transfer</h4>
                <p className="text-sm text-muted-foreground">
                  Contact us for direct bank transfer details for larger donations.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Contact Us</h4>
                <p className="text-sm text-muted-foreground">
                  Email us at donations@archepal.org for any questions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
};

export default Donations;
