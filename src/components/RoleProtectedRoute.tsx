import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '@/hooks/use-user';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/types/organization';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
  showAccessDenied?: boolean;
}

/**
 * Role-based protected route component
 * Restricts access based on user roles (SUPER_ADMIN, ORG_ADMIN, MEMBER)
 */
export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  allowedRoles,
  redirectTo = '/authentication/sign-in',
  showAccessDenied = true,
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { user, loading: userLoading } = useUser();

  // Show loading while checking auth and user status
  if (authLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if user has required role
  const hasRequiredRole = user && allowedRoles.includes(user.role);

  if (!hasRequiredRole) {
    if (showAccessDenied) {
      return <AccessDeniedPage />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/**
 * Access Denied page component
 */
const AccessDeniedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <ShieldAlert className="w-16 h-16 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access this page. Please contact an administrator if you believe this is an error.
          </p>
          <Button onClick={() => window.history.back()} variant="outline" className="w-full">
            Go Back
          </Button>
          <Button onClick={() => window.location.href = '/'} className="w-full">
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Convenience components for common role combinations
 */
export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['SUPER_ADMIN']}>
    {children}
  </RoleProtectedRoute>
);

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN']}>
    {children}
  </RoleProtectedRoute>
);

export default RoleProtectedRoute;
