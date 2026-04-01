import { usePermission, useCanAll, useCanAny } from 'permzplus/react';
import type { AppPermission } from '@/lib/permissions';

/**
 * Single-permission hook. Returns true if the current user has the permission.
 * Constrained to AppPermission for IDE autocomplete and type safety.
 *
 * Must be called at the top level of a component (standard React hook rules).
 *
 * @example
 * const canEdit = useCan('templates:edit');
 * const canDelete = useCan('sites:delete');
 */
export const useCan = (permission: AppPermission, condition?: () => boolean): boolean =>
  usePermission(permission, condition);

/**
 * Returns true only if the user has ALL of the given permissions.
 *
 * @example
 * const canManage = useCanAll(['templates:edit', 'templates:publish']);
 */
export const useAllPerms = (
  permissions: AppPermission[],
  condition?: () => boolean,
): boolean => useCanAll(permissions, condition);

/**
 * Returns true if the user has AT LEAST ONE of the given permissions.
 *
 * @example
 * const canModifyContent = useAnyPerm(['content:edit', 'content:delete']);
 */
export const useAnyPerm = (
  permissions: AppPermission[],
  condition?: () => boolean,
): boolean => useCanAny(permissions, condition);
