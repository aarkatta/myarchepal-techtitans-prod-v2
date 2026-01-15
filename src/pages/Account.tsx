/**
 * Account Page Component
 * 
 * Displays user account information and settings options.
 * Features:
 * - User profile display (avatar, name, title, contact info)
 * - Edit profile navigation
 * - Settings menu items
 * - Logout functionality
 * 
 * Routes: /account
 * Requires: Authentication (redirects to sign-in if not authenticated)
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Settings, Bell, Shield, HelpCircle, LogOut, Building2, Award, Calendar, Loader2, MessageSquare, BookOpen, Trash2 } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { ArchaeologistService, Archaeologist } from "@/services/archaeologists";
import { UserService } from "@/services/users";
import { User, DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Timestamp } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";

const Account = () => {
  // React Router hook for navigation
  const navigate = useNavigate();
  // Auth context hook to get current user and logout/delete functions
  const { user, logout, deleteAccount } = useAuth();
  // User context hook to get organization data
  const { organization } = useUser();
  // Toast notification hook for user feedback
  const { toast } = useToast();
  // State for archaeologist profile data
  const [archaeologistProfile, setArchaeologistProfile] = useState<Archaeologist | null>(null);
  // Loading state for profile data
  const [profileLoading, setProfileLoading] = useState(false);
  // Loading state for account deletion
  const [deleteLoading, setDeleteLoading] = useState(false);
  // State for organization admins
  const [orgAdmins, setOrgAdmins] = useState<User[]>([]);
  // Loading state for org admins
  const [orgAdminsLoading, setOrgAdminsLoading] = useState(false);

  /**
   * Fetch archaeologist profile data when user is available
   */
  useEffect(() => {
    const fetchArchaeologistProfile = async () => {
      if (user?.uid) {
        setProfileLoading(true);
        try {
          const profile = await ArchaeologistService.getArchaeologistProfile(user.uid);
          setArchaeologistProfile(profile);
        } catch (error) {
          console.error('Error fetching archaeologist profile:', error);
        } finally {
          setProfileLoading(false);
        }
      }
    };

    fetchArchaeologistProfile();
  }, [user?.uid]);

  /**
   * Fetch organization admins when organization is available
   */
  useEffect(() => {
    const fetchOrgAdmins = async () => {
      if (organization && organization.id !== DEFAULT_ORGANIZATION_ID) {
        setOrgAdminsLoading(true);
        try {
          // Fetch all users in this organization who are ORG_ADMIN
          const orgUsers = await UserService.getByOrganization(organization.id);
          const admins = orgUsers.filter((u: User) => u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN');
          setOrgAdmins(admins);
        } catch (error) {
          console.error('Error fetching organization admins:', error);
        } finally {
          setOrgAdminsLoading(false);
        }
      }
    };

    fetchOrgAdmins();
  }, [organization?.id]);

  /**
   * Format date for display
   */
  const formatDate = (date: Date | Timestamp | undefined) => {
    if (!date) return "Unknown";
    const d = date instanceof Timestamp ? date.toDate() : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  /**
   * Handle logout button click
   * Signs out user, shows notification, and redirects to sign-in page
   */
  const handleLogout = () => {
    logout();  // Clear auth state from localStorage and context
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/authentication/sign-in");  // Redirect to sign-in page
  };

  /**
   * Handle account deletion
   * Deletes user data from Firestore, then deletes Firebase Auth account
   */
  const handleDeleteAccount = async () => {
    if (!user?.uid) return;

    setDeleteLoading(true);
    try {
      // First, delete user data from Firestore
      await ArchaeologistService.deleteUserData(user.uid);

      // Then delete the Firebase Auth account
      await deleteAccount();

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });

      navigate("/authentication/sign-in");
    } catch (error: any) {
      console.error("Error deleting account:", error);

      // Handle specific Firebase errors
      if (error.code === "auth/requires-recent-login") {
        toast({
          title: "Re-authentication Required",
          description: "Please sign out and sign in again before deleting your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete account. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // Redirect to sign-in if not authenticated
  // This protects the account page from unauthorized access
  if (!user) {
    navigate("/authentication/sign-in");
    return null;
  }

  // Get display name from Firebase user or archaeologist profile
  const displayName = archaeologistProfile?.displayName || user.displayName || user.email || "User";

  // Generate initials from display name for avatar fallback
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])  // Get first letter of each word
        .join("")
        .toUpperCase()
        .slice(0, 2)  // Take only first 2 letters
    : "U";  // Default fallback initial

  return (
    <ResponsiveLayout>
      <header className="bg-card p-4 border-b border-border lg:static">
        <PageHeader />
      </header>

      <div className="p-4 lg:p-6 space-y-4 mx-auto max-w-7xl">
          <Card className="p-6 border-border">
            {profileLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading profile...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={archaeologistProfile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-foreground">{displayName}</h2>
                    <p className="text-sm text-muted-foreground mb-2">
                      {archaeologistProfile?.status === 'approved' ? 'Approved Archaeologist' : 'User'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/edit-profile")}
                    >
                      Edit Profile
                    </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{user.email}</span>
                  </div>

                  {archaeologistProfile?.institution && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{archaeologistProfile.institution}</span>
                    </div>
                  )}

                  {archaeologistProfile?.specialization && (
                    <div className="flex items-center gap-3 text-sm">
                      <Award className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{archaeologistProfile.specialization}</span>
                    </div>
                  )}

                  {archaeologistProfile?.credentials && (
                    <div className="flex items-center gap-3 text-sm">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{archaeologistProfile.credentials}</span>
                    </div>
                  )}

                  {archaeologistProfile?.approvedAt && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">Approved: {formatDate(archaeologistProfile.approvedAt)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Organization Info Card - Show for users in non-default organizations */}
          {organization && organization.id !== DEFAULT_ORGANIZATION_ID && (
            <Card className="p-6 border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{organization.name}</h3>
                    {organization.subscriptionLevel === 'Pro' && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                        PRO
                      </Badge>
                    )}
                    {organization.subscriptionLevel === 'Enterprise' && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                        ENTERPRISE
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {organization.status === 'ACTIVE' ? 'Active Organization' : organization.status}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Crown className="w-4 h-4" />
                  <span>Organization Admin{orgAdmins.length > 1 ? 's' : ''}</span>
                </div>

                {orgAdminsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading admins...</span>
                  </div>
                ) : orgAdmins.length > 0 ? (
                  <div className="space-y-2">
                    {orgAdmins.map((admin) => (
                      <div key={admin.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={admin.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${admin.email}`} />
                          <AvatarFallback className="text-xs">
                            {admin.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {admin.displayName || admin.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No admins found</p>
                )}
              </div>
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground px-1">Settings</h3>
            
            <Card className="border-border divide-y divide-border">
              <button
                onClick={() => toast({ title: "Coming Soon", description: "General Settings will be available in a future update." })}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left text-foreground">General Settings</span>
              </button>

              <button
                onClick={() => toast({ title: "Coming Soon", description: "Notification settings will be available in a future update." })}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left text-foreground">Notifications</span>
              </button>

              <button
                onClick={() => toast({ title: "Coming Soon", description: "Privacy & Security settings will be available in a future update." })}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left text-foreground">Privacy & Security</span>
              </button>

              <button
                onClick={() => toast({ title: "Coming Soon", description: "Help & Support will be available in a future update." })}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left text-foreground">Help & Support</span>
              </button>

              <button
                onClick={() => navigate("/feedback")}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left text-foreground">Give Feedback</span>
              </button>

              <button
                onClick={() => navigate("/blogs")}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <BookOpen className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left text-foreground">Blogs</span>
              </button>
            </Card>
          </div>

          <Card className="border-border">
            <button
              onClick={handleLogout}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-destructive"
            >
              <LogOut className="w-5 h-5" />
              <span className="flex-1 text-left font-medium">Log Out</span>
            </button>
          </Card>

          <Card className="border-destructive/50">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="w-full p-4 flex items-center gap-3 hover:bg-destructive/10 transition-colors text-destructive"
                  disabled={deleteLoading}
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">
                    {deleteLoading ? "Deleting..." : "Delete Account"}
                  </span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>

          <div className="text-center text-xs text-muted-foreground pt-4">
            <p>ArchePal v1.0.0</p>
            <p className="mt-1">© 2025 All rights reserved</p>
          </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Account;
