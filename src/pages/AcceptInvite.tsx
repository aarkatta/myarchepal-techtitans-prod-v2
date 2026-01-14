import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { InvitationService } from '@/services/invitations';
import { OrganizationService } from '@/services/organizations';
import { UserService } from '@/services/users';
import { Invitation, Organization } from '@/types/organization';
import {
  Loader2,
  Mail,
  Building2,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // For new users - sign up form
  const [isNewUser, setIsNewUser] = useState(false);
  const [signUpForm, setSignUpForm] = useState({
    displayName: '',
    password: '',
    confirmPassword: '',
  });

  // For existing users - sign in form
  const [signInForm, setSignInForm] = useState({
    password: '',
  });

  // Validate invitation token on load
  useEffect(() => {
    const validateInvitation = async () => {
      if (!token) {
        setError('No invitation token provided');
        setLoading(false);
        return;
      }

      try {
        const validInvitation = await InvitationService.validateToken(token);

        if (!validInvitation) {
          setError('Invalid or expired invitation');
          setLoading(false);
          return;
        }

        setInvitation(validInvitation);

        // Get organization details
        const org = await OrganizationService.getById(validInvitation.organizationId);
        setOrganization(org);

        // Check if user with this email already exists
        // (They would need to sign in to accept)
      } catch (err: any) {
        setError(err.message || 'Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    };

    validateInvitation();
  }, [token]);

  // If user is authenticated and email matches, auto-process
  useEffect(() => {
    const processForAuthenticatedUser = async () => {
      if (authLoading || !invitation) return;

      if (isAuthenticated && user) {
        // Check if the authenticated user's email matches the invitation
        if (user.email?.toLowerCase() === invitation.email.toLowerCase()) {
          // Auto-accept for authenticated user
          handleAcceptInvitation();
        } else {
          toast({
            title: 'Email Mismatch',
            description: `This invitation is for ${invitation.email}. Please sign out and use the correct account.`,
            variant: 'destructive',
          });
        }
      }
    };

    processForAuthenticatedUser();
  }, [isAuthenticated, user, authLoading, invitation]);

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    setAccepting(true);
    try {
      // Accept the invitation
      await InvitationService.accept(invitation.token);

      // Update user's organization and role
      if (user) {
        const existingUser = await UserService.getByUid(user.uid);

        if (existingUser) {
          // Update existing user's organization
          await UserService.updateProfile(user.uid, {});
          // We need a method to update organization - let's add it inline
          const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          if (db) {
            const userDoc = doc(db, 'users', user.uid);
            await updateDoc(userDoc, {
              organizationId: invitation.organizationId,
              role: invitation.role,
              updatedAt: Timestamp.now(),
            });
          }
        } else {
          // Create new user record
          await UserService.create({
            uid: user.uid,
            email: user.email || invitation.email,
            displayName: user.displayName || signUpForm.displayName,
            organizationId: invitation.organizationId,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
          });
        }
      }

      toast({
        title: 'Welcome!',
        description: `You have joined ${organization?.name || 'the organization'}`,
      });

      // Navigate to the org admin dashboard or home
      navigate('/org-dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation || !auth) return;

    if (signUpForm.password !== signUpForm.confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (signUpForm.password.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setAccepting(true);
    try {
      // Create Firebase auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invitation.email,
        signUpForm.password
      );

      // Accept invitation
      await InvitationService.accept(invitation.token);

      // Create user in Firestore
      await UserService.create({
        uid: userCredential.user.uid,
        email: invitation.email,
        displayName: signUpForm.displayName,
        organizationId: invitation.organizationId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      });

      toast({
        title: 'Account Created!',
        description: `Welcome to ${organization?.name || 'the organization'}`,
      });

      navigate('/org-dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create account',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation || !auth) return;

    setAccepting(true);
    try {
      // Sign in with existing account
      await signInWithEmailAndPassword(auth, invitation.email, signInForm.password);

      // The useEffect will handle the rest after authentication
    } catch (error: any) {
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Invalid password',
        variant: 'destructive',
      });
      setAccepting(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    );
  }

  // Error state
  if (error || !invitation) {
    return (
      <ResponsiveLayout>
        <div className="container max-w-md mx-auto py-12">
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <XCircle className="w-16 h-16 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold">Invalid Invitation</h2>
              <p className="text-muted-foreground">
                {error || 'This invitation link is invalid or has expired.'}
              </p>
              <Button onClick={() => navigate('/')} className="w-full">
                Go to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  // If user is authenticated with matching email, show accepting state
  if (isAuthenticated && user?.email?.toLowerCase() === invitation.email.toLowerCase()) {
    return (
      <ResponsiveLayout>
        <div className="container max-w-md mx-auto py-12">
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Joining Organization...</h2>
              <p className="text-muted-foreground">
                Please wait while we add you to {organization?.name}
              </p>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  // Show the invitation acceptance form
  return (
    <ResponsiveLayout>
      <div className="container max-w-md mx-auto py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to join an organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invitation Details */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{organization?.name || 'Organization'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{invitation.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Role: {invitation.role}</span>
              </div>
            </div>

            <Separator />

            {/* Auth Forms */}
            <div className="space-y-4">
              {!isNewUser ? (
                <>
                  <p className="text-sm text-center text-muted-foreground">
                    Do you already have an account with this email?
                  </p>

                  {/* Sign In Form */}
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Enter your password to accept</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="Your existing password"
                          className="pl-10"
                          value={signInForm.password}
                          onChange={(e) => setSignInForm({ password: e.target.value })}
                          disabled={accepting}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={accepting}>
                      {accepting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Sign In & Accept
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsNewUser(true)}
                  >
                    Create New Account
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-center text-muted-foreground">
                    Create a new account to join the organization
                  </p>

                  {/* Sign Up Form */}
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Your Name</Label>
                      <Input
                        id="displayName"
                        placeholder="John Doe"
                        value={signUpForm.displayName}
                        onChange={(e) => setSignUpForm({ ...signUpForm, displayName: e.target.value })}
                        disabled={accepting}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          type="password"
                          placeholder="Min 6 characters"
                          className="pl-10"
                          value={signUpForm.password}
                          onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                          disabled={accepting}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Confirm password"
                          className="pl-10"
                          value={signUpForm.confirmPassword}
                          onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                          disabled={accepting}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={accepting}>
                      {accepting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Create Account & Join
                        </>
                      )}
                    </Button>
                  </form>

                  <Button
                    variant="link"
                    className="w-full"
                    onClick={() => setIsNewUser(false)}
                  >
                    Already have an account? Sign in
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              This invitation is for {invitation.email} only
            </p>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
};

export default AcceptInvite;
