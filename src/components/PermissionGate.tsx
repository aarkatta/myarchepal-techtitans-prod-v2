import { Can, CanAll, CanAny } from 'permzplus/react';
import type { AppPermission } from '@/lib/permissions';

interface PermissionGateProps {
  permission: AppPermission;
  condition?: () => boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user has the given permission.
 * Typed to AppPermission for IDE autocomplete and compile-time safety.
 *
 * @example
 * <PermissionGate permission="templates:edit">
 *   <EditButton />
 * </PermissionGate>
 *
 * <PermissionGate permission="admin:panel" fallback={<AccessDenied />}>
 *   <SuperAdminPanel />
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  condition,
  fallback = null,
  children,
}) => (
  <Can permission={permission} condition={condition} fallback={fallback}>
    {children}
  </Can>
);

interface AllPermissionsGateProps {
  permissions: AppPermission[];
  condition?: () => boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the user has ALL of the given permissions.
 */
export const AllPermissionsGate: React.FC<AllPermissionsGateProps> = ({
  permissions,
  condition,
  fallback = null,
  children,
}) => (
  <CanAll permissions={permissions} condition={condition} fallback={fallback}>
    {children}
  </CanAll>
);

interface AnyPermissionGateProps {
  permissions: AppPermission[];
  condition?: () => boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children when the user has AT LEAST ONE of the given permissions.
 */
export const AnyPermissionGate: React.FC<AnyPermissionGateProps> = ({
  permissions,
  condition,
  fallback = null,
  children,
}) => (
  <CanAny permissions={permissions} condition={condition} fallback={fallback}>
    {children}
  </CanAny>
);
