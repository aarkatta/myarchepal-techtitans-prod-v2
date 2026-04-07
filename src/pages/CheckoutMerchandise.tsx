import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingCart, CreditCard, MapPin, Loader2, CheckCircle2, Gift } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { MerchandiseService, Merchandise } from "@/services/merchandise";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CheckoutMerchandise = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [merchandise, setMerchandise] = useState<Merchandise | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [sameAsShipping, setSameAsShipping] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  const [purchaseData, setPurchaseData] = useState({
    quantity: 1,
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingZipCode: "",
    billingCountry: ""
  });

  useEffect(() => {
    const loadMerchandise = async () => {
      if (!id) {
        toast({
          title: "Error",
          description: "Merchandise ID not found",
          variant: "destructive"
        });
        navigate("/gift-shop");
        return;
      }

      try {
        setLoading(true);
        const merchandiseData = await MerchandiseService.getMerchandiseById(id);

        if (!merchandiseData) {
          toast({
            title: "Error",
            description: "Merchandise not found",
            variant: "destructive"
          });
          navigate("/gift-shop");
          return;
        }

        if (!merchandiseData.quantity || merchandiseData.quantity === 0) {
          toast({
            title: "Not Available",
            description: "This item is not available for purchase",
            variant: "destructive"
          });
          navigate("/gift-shop");
          return;
        }

        setMerchandise(merchandiseData);
      } catch (error) {
        console.error("Error loading merchandise:", error);
        toast({
          title: "Error",
          description: "Failed to load merchandise",
          variant: "destructive"
        });
        navigate("/gift-shop");
      } finally {
        setLoading(false);
      }
    };

    loadMerchandise();
  }, [id, navigate, toast]);

  // When gift option is selected, disable same as shipping
  useEffect(() => {
    if (isGift) {
      setSameAsShipping(false);
    }
  }, [isGift]);

  // Sync billing address with shipping address when checkbox is checked
  useEffect(() => {
    if (sameAsShipping && !isGift) {
      setPurchaseData(prev => ({
        ...prev,
        billingAddress: prev.address,
        billingCity: prev.city,
        billingState: prev.state,
        billingZipCode: prev.zipCode,
        billingCountry: prev.country
      }));
    }
  }, [sameAsShipping, isGift, purchaseData.address, purchaseData.city, purchaseData.state, purchaseData.zipCode, purchaseData.country]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPurchaseData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleQuantityChange = (value: string) => {
    setPurchaseData(prev => ({
      ...prev,
      quantity: parseInt(value)
    }));
  };


  const validateForm = () => {
    if (!purchaseData.cardNumber || !purchaseData.cardName || !purchaseData.expiryDate || !purchaseData.cvv) {
      toast({
        title: "Validation Error",
        description: "Please fill in all credit card information",
        variant: "destructive"
      });
      return false;
    }

    if (!purchaseData.address || !purchaseData.city || !purchaseData.state || !purchaseData.zipCode || !purchaseData.country) {
      toast({
        title: "Validation Error",
        description: "Please fill in all shipping address information",
        variant: "destructive"
      });
      return false;
    }

    if (!sameAsShipping) {
      if (!purchaseData.billingAddress || !purchaseData.billingCity || !purchaseData.billingState || !purchaseData.billingZipCode || !purchaseData.billingCountry) {
        toast({
          title: "Validation Error",
          description: "Please fill in all billing address information",
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !merchandise || !id) {
      return;
    }

    setProcessing(true);

    try {
      // Calculate new quantity
      const newQuantity = (merchandise.quantity || 0) - purchaseData.quantity;

      // Update merchandise quantity in database
      await MerchandiseService.updateQuantity(id, newQuantity);

      // Show success
      setPurchaseComplete(true);

      // Navigate back after a delay
      setTimeout(() => {
        navigate("/gift-shop");
      }, 5000);

    } catch (error) {
      console.error("Error processing purchase:", error);
      toast({
        title: "Error",
        description: "Failed to process purchase. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading checkout...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  if (purchaseComplete) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center min-h-[50vh] p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Thank You for Your Purchase!</h2>
              <p className="text-muted-foreground mb-4">
                Your order has been received successfully.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                We will contact you soon when the order is ready for delivery.
              </p>
              <div className="bg-muted p-4 rounded-lg mb-6">
                <p className="text-sm font-medium mb-2">Order Summary:</p>
                <p className="text-xs text-muted-foreground">{merchandise?.name}</p>
                <p className="text-xs text-muted-foreground">Quantity: {purchaseData.quantity}</p>
                {isGift && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Gift className="w-3 h-3" />
                    Gift Order
                  </p>
                )}
                <p className="text-sm font-bold text-primary mt-2">
                  Total: {merchandise?.currency} ${((merchandise?.price || 0) * purchaseData.quantity).toFixed(2)}
                </p>
              </div>

              {isGift && giftMessage && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-6">
                  <p className="text-sm font-medium mb-2 text-blue-800 dark:text-blue-200">Gift Message:</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 italic">"{giftMessage}"</p>
                </div>
              )}
              <Button onClick={() => navigate("/gift-shop")} className="w-full">
                Back to Gift Shop
              </Button>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  if (!merchandise) {
    return null;
  }

  const totalPrice = (merchandise.price || 0) * purchaseData.quantity;

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
            <ShoppingCart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Complete Your Purchase</h1>
          <p className="text-muted-foreground">
            Review your order and complete the checkout process.
          </p>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4 mx-auto max-w-7xl">
          {/* Merchandise Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img
                    src={merchandise.imageUrl}
                    alt={merchandise.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<span class="text-3xl">🎁</span>';
                      }
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">{merchandise.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{merchandise.description}</p>
                  <p className="text-lg font-bold text-blue-600">
                    {merchandise.currency} ${merchandise.price.toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-1">per item</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Select
                    value={purchaseData.quantity.toString()}
                    onValueChange={handleQuantityChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: Math.min(merchandise.quantity || 0, 10) }, (_, i) => i + 1).map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: {merchandise.quantity}
                  </p>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">
                      {merchandise.currency} ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <form onSubmit={handlePurchase} className="space-y-4">
            {/* Gift Option */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Gift Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isGift"
                    checked={isGift}
                    onCheckedChange={(checked) => setIsGift(checked === true)}
                  />
                  <label
                    htmlFor="isGift"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    This is a gift for someone else
                  </label>
                </div>

                {isGift && (
                  <div>
                    <Label htmlFor="giftMessage">Gift Message (Optional)</Label>
                    <Textarea
                      id="giftMessage"
                      placeholder="Write a personal message for the recipient..."
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      className="min-h-24 border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This message will be included with the gift
                    </p>
                  </div>
                )}

                {isGift && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      📦 Since this is a gift, the billing and shipping addresses must be different.
                      The shipping address will be for the recipient.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    name="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={purchaseData.cardNumber}
                    onChange={handleInputChange}
                    maxLength={19}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cardName">Cardholder Name</Label>
                  <Input
                    id="cardName"
                    name="cardName"
                    placeholder="John Doe"
                    value={purchaseData.cardName}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      name="expiryDate"
                      placeholder="MM/YY"
                      value={purchaseData.expiryDate}
                      onChange={handleInputChange}
                      maxLength={5}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      name="cvv"
                      placeholder="123"
                      value={purchaseData.cvv}
                      onChange={handleInputChange}
                      maxLength={4}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {isGift ? "Recipient's Shipping Address" : "Shipping Address"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="123 Main Street"
                    value={purchaseData.address}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="New York"
                      value={purchaseData.city}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="NY"
                      value={purchaseData.state}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      placeholder="10001"
                      value={purchaseData.zipCode}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      name="country"
                      placeholder="USA"
                      value={purchaseData.country}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sameAsShipping"
                    checked={sameAsShipping}
                    disabled={isGift}
                    onCheckedChange={(checked) => setSameAsShipping(checked === true)}
                  />
                  <label
                    htmlFor="sameAsShipping"
                    className={`text-sm font-medium leading-none ${isGift ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                  >
                    Billing address is the same as shipping address
                  </label>
                </div>

                {isGift && (
                  <p className="text-xs text-muted-foreground">
                    This option is disabled because you selected this as a gift
                  </p>
                )}

                {!sameAsShipping && (
                  <>
                    <div>
                      <Label htmlFor="billingAddress">Street Address</Label>
                      <Input
                        id="billingAddress"
                        name="billingAddress"
                        placeholder="123 Main Street"
                        value={purchaseData.billingAddress}
                        onChange={handleInputChange}
                        required={!sameAsShipping}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billingCity">City</Label>
                        <Input
                          id="billingCity"
                          name="billingCity"
                          placeholder="New York"
                          value={purchaseData.billingCity}
                          onChange={handleInputChange}
                          required={!sameAsShipping}
                        />
                      </div>
                      <div>
                        <Label htmlFor="billingState">State</Label>
                        <Input
                          id="billingState"
                          name="billingState"
                          placeholder="NY"
                          value={purchaseData.billingState}
                          onChange={handleInputChange}
                          required={!sameAsShipping}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="billingZipCode">ZIP Code</Label>
                        <Input
                          id="billingZipCode"
                          name="billingZipCode"
                          placeholder="10001"
                          value={purchaseData.billingZipCode}
                          onChange={handleInputChange}
                          required={!sameAsShipping}
                        />
                      </div>
                      <div>
                        <Label htmlFor="billingCountry">Country</Label>
                        <Input
                          id="billingCountry"
                          name="billingCountry"
                          placeholder="USA"
                          value={purchaseData.billingCountry}
                          onChange={handleInputChange}
                          required={!sameAsShipping}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Complete Purchase
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
    </ResponsiveLayout>
  );
};

export default CheckoutMerchandise;
