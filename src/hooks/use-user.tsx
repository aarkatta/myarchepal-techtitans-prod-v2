import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { UserService } from '@/services/users';
import { OrganizationService } from '@/services/organizations';
import { UserRoleService } from '@/services/userRoles';
import { User, Organization, UserRoleMapping, UserRole, DEFAULT_ORGANIZATION_ID, ROLE_IDS } from '@/types/organization';
import { policy, type AppPermission } from '@/lib/permissions';

interface UseUserResult {
  user: User | null;
  organization: Organization | null;
  userRoles: UserRoleMapping[];
  highestRole: UserRole | null;
  /** Highest role across both user_roles collection and legacy users/{uid}.role — use this for PermissionProvider */
  effectiveRole: UserRole | null;
  loading: boolean;
  error: string | null;
  isUser: boolean;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isAdmin: boolean;
  isMember: boolean;
  /** PermzPlus-backed permission check. Prefer this over boolean flags for new code. */
  can: (permission: AppPermission) => boolean;
  refreshUser: () => Promise<void>;
}

export const useUser = (): UseUserResult => {
  const { user: authUser, isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleMapping[]>([]);
  const [highestRole, setHighestRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!isAuthenticated || !authUser) {
      setUser(null);
      setOrganization(null);
      setUserRoles([]);
      setHighestRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user from users collection
      const userData = await UserService.getByUid(authUser.uid);
      setUser(userData);

      // Fetch user roles from user_roles collection
      const roles = await UserRoleService.getByUserId(authUser.uid);
      setUserRoles(roles);

      // Get highest role
      const highest = await UserRoleService.getHighestRole(authUser.uid);
      setHighestRole(highest);

      // Fetch organization if user exists
      if (userData?.organizationId) {
        const orgData = await OrganizationService.getById(userData.organizationId);
        setOrganization(orgData);
      } else {
        setOrganization(null);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to fetch user data');
      setUser(null);
      setOrganization(null);
      setUserRoles([]);
      setHighestRole(null);
    } finally {
      setLoading(false);
    }
  }, [authUser, isAuthenticated]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const refreshUser = useCallback(async () => {
    await fetchUserData();
  }, [fetchUserData]);

  // Computed properties - check both user.role (legacy) and user_roles collection
  // Treat missing status as ACTIVE for backward compat (manually-created users may omit it)
  const isUser = user !== null && (user.status === 'ACTIVE' || !user.status);

  // Check user_roles first, fallback to user.role for backward compatibility
  const isSuperAdmin = isUser && (
    highestRole === 'SUPER_ADMIN' ||
    userRoles.some(r => r.roleId === ROLE_IDS.SUPER_ADMIN) ||
    user?.role === 'SUPER_ADMIN'
  );

  const isOrgAdmin = isUser && (
    highestRole === 'ORG_ADMIN' ||
    userRoles.some(r => r.roleId === ROLE_IDS.ORG_ADMIN) ||
    user?.role === 'ORG_ADMIN'
  );

  const isAdmin = isSuperAdmin || isOrgAdmin;

  const isMember = isUser && (
    highestRole === 'MEMBER' ||
    userRoles.some(r => r.roleId === ROLE_IDS.MEMBER) ||
    user?.role === 'MEMBER'
  );

  // Take the highest role across both sources: user_roles collection and legacy users/{uid}.role
  const ROLE_LEVEL: Record<UserRole, number> = { MEMBER: 1, ORG_ADMIN: 2, SUPER_ADMIN: 3 };
  const legacyRole = (user?.role as UserRole | undefined) ?? null;
  const effectiveRole: UserRole | null = (() => {
    if (!highestRole && !legacyRole) return null;
    if (!highestRole) return legacyRole;
    if (!legacyRole) return highestRole;
    return ROLE_LEVEL[highestRole] >= ROLE_LEVEL[legacyRole] ? highestRole : legacyRole;
  })();

  const can = useCallback(
    (permission: AppPermission): boolean => {
      if (!effectiveRole) return false;
      try {
        return policy.can(effectiveRole, permission);
      } catch {
        return false;
      }
    },
    [effectiveRole],
  );

  return {
    user,
    organization,
    userRoles,
    highestRole,
    effectiveRole,
    loading,
    error,
    isUser,
    isSuperAdmin,
    isOrgAdmin,
    isAdmin,
    isMember,
    can,
    refreshUser,
  };
};

/**
 * Hook to check if current user belongs to a specific organization
 */
export const useOrganizationAccess = (targetOrgId: string): {
  hasAccess: boolean;
  loading: boolean;
} => {
  const { user, isSuperAdmin, loading } = useUser();

  // Super admins have access to all organizations
  if (isSuperAdmin) {
    return { hasAccess: true, loading };
  }

  // Check if user belongs to the target organization
  const hasAccess = user?.organizationId === targetOrgId;

  return { hasAccess, loading };
};
