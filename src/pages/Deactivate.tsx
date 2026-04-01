import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, AlertTriangle, ShieldOff, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveLayout, ContentSection } from "@/components/ResponsiveLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { UserService } from "@/services/users";

const Deactivate = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);

  const userEmail = user?.email ?? "";
  const isConfirmed = confirmEmail.trim().toLowerCase() === userEmail.toLowerCase();

  const handleDeactivate = async () => {
    if (!user?.uid || !isConfirmed) return;

    setIsDeactivating(true);
    try {
      // Soft delete — set status to INACTIVE in Firestore
      await UserService.updateStatus(user.uid, "INACTIVE");
      toast.success("Account deactivated. You have been signed out.");
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error deactivating account:", error);
      toast.error("Failed to deactivate account. Please try again.");
      setIsDeactivating(false);
    }
  };

  return (
    <ResponsiveLayout>
      <ContentSection>
        <div className="max-w-lg mx-auto">

          {/* Page heading */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Deactivate Account</h1>
              <p className="text-sm text-muted-foreground">This action cannot be undone easily</p>
            </div>
          </div>

          {/* Warning card */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <span className="font-semibold text-destructive">Before you deactivate</span>
            </div>
            <ul className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-2.5">
                <ShieldOff className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>Your account will be marked <strong>inactive</strong> and you will lose access to all sites, artifacts, and content.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <EyeOff className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>Your data will be <strong>preserved</strong> but hidden. An administrator can reactivate your account.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <LogOut className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>You will be <strong>signed out immediately</strong> and cannot sign back in while inactive.</span>
              </li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2 mb-6">
            <Label htmlFor="confirm-email" className="text-sm font-medium">
              Type your email address to confirm
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Enter <span className="font-mono font-semibold text-foreground">{userEmail}</span> to continue
            </p>
            <Input
              id="confirm-email"
              type="email"
              placeholder={userEmail}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className={isConfirmed ? "border-destructive/60 focus-visible:ring-destructive/30" : ""}
              autoComplete="off"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!isConfirmed || isDeactivating}
              onClick={handleDeactivate}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeactivating ? "Deactivating…" : "Deactivate My Account"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
          </div>

        </div>
      </ContentSection>
    </ResponsiveLayout>
  );
};

export default Deactivate;
