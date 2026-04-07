import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ShoppingCart, Loader2, Plus, Minus } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MerchandiseService, Merchandise } from "@/services/merchandise";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";

const GiftShop = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [merchandise, setMerchandise] = useState<Merchandise[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadMerchandise();
  }, []);

  const loadMerchandise = async () => {
    try {
      setLoading(true);

      // First, try to get existing merchandise
      let items = await MerchandiseService.getAllMerchandise();

      // If no items exist, sync from storage
      if (items.length === 0) {
        setSyncing(true);
        items = await MerchandiseService.syncMerchandiseFromStorage();
        setSyncing(false);
      }

      setMerchandise(items);
    } catch (err) {
      console.error("Error loading merchandise:", err);
      // Silently fail - no error UI shown to user
    } finally {
      setLoading(false);
    }
  };

  const handleBuyClick = (item: Merchandise) => {
    if (!item.id) {
      toast({
        title: "Error",
        description: "Unable to purchase this item",
        variant: "destructive"
      });
      return;
    }

    if (item.quantity === 0) {
      toast({
        title: "Out of Stock",
        description: "This item is currently unavailable",
        variant: "destructive"
      });
      return;
    }

    // Navigate to merchandise checkout page
    navigate(`/checkout-merchandise/${item.id}`);
  };

  const handleSyncFromStorage = async () => {
    try {
      setSyncing(true);
      const items = await MerchandiseService.syncMerchandiseFromStorage();
      setMerchandise(items);

      if (items.length === 0) {
        toast({
          title: "No Items Found",
          description: "Please upload merchandise images to Firebase Storage in the 'merchandise' folder",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: `Loaded ${items.length} items from storage`
        });
      }
    } catch (err) {
      console.error("Error syncing merchandise:", err);
      toast({
        title: "Error",
        description: "Failed to sync merchandise. Check Firebase Storage permissions and ensure the 'merchandise' folder exists.",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            {syncing ? "Syncing merchandise from storage..." : "Loading gift shop..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-4">
          <PageHeader mobileLogoOnly />
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/create-merchandise")}
                className="hover:bg-muted hover:text-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFromStorage}
              disabled={syncing}
              className="hover:bg-muted hover:text-primary"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
            <AccountButton />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Gift Shop</h1>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold text-primary">{merchandise.length}</p>
            <p className="text-xs text-muted-foreground">Items Available</p>
          </Card>
          <Card className="p-3 border-border text-center">
            <p className="text-2xl font-bold text-green-600">
              {merchandise.filter(item => item.quantity > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">In Stock</p>
          </Card>
        </div>
      </header>

      <div className="p-4 lg:p-6 mx-auto max-w-7xl">
          {merchandise.length === 0 ? (
            <Card className="p-8 text-center border-border">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No merchandise available yet.
              </p>
              <Button onClick={handleSyncFromStorage} variant="outline">
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Load from Storage"
                )}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {merchandise.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden border-border hover:shadow-md transition-all"
                >
                  <div className="relative h-48 bg-muted">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="flex items-center justify-center h-full"><span class="text-6xl">🎁</span></div>';
                        }
                      }}
                    />
                    {item.quantity === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg px-4 py-2">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        {item.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">
                            ${item.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.currency} per item
                          </p>
                        </div>
                        <Badge variant="outline" className="text-sm">
                          {item.quantity > 0 ? `${item.quantity} available` : 'Sold Out'}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleBuyClick(item)}
                      disabled={item.quantity === 0}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {item.quantity === 0 ? 'Out of Stock' : 'Buy Now'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </div>
    </ResponsiveLayout>
  );
};

export default GiftShop;
