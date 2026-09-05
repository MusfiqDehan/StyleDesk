import { UserRole } from '../auth/entities/auth.entity.js';

/** All toggleable admin modules (aligned with sidebar / AuthGuard). */
export const ALL_MODULE_PERMISSIONS = [
  'dashboard',
  'manager-dashboard',
  'staff-dashboard',
  'stylist-dashboard',
  'appointments',
  'clients',
  'reports',
  'invoice',
  'service',
  'StyleDesk-packages',
  'employee',
  'inventory',
  'attendance',
  'leave-request',
  'hr-payroll',
  'news-letter-subscriber',
  'settings',
  'user-management',
  'update-password',
  'testimonial',
  'announcement',
] as const;

export type ModulePermission = (typeof ALL_MODULE_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<
  UserRole.STORE_MANAGER | UserRole.STAFF | UserRole.STYLIST,
  string[]
> = {
  [UserRole.STORE_MANAGER]: ALL_MODULE_PERMISSIONS.filter(
    (p) => p !== 'user-management' && p !== 'staff-dashboard' && p !== 'stylist-dashboard',
  ),
  [UserRole.STAFF]: [
    'staff-dashboard',
    'appointments',
    'clients',
    'attendance',
    'service',
    'StyleDesk-packages',
    'inventory',
    'invoice',
    'leave-request',
    'update-password',
  ],
  [UserRole.STYLIST]: [
    'stylist-dashboard',
    'appointments',
    'service',
    'StyleDesk-packages',
    'attendance',
    'leave-request',
    'update-password',
  ],
};

export const EDITABLE_ROLES = [
  UserRole.STORE_MANAGER,
  UserRole.STAFF,
  UserRole.STYLIST,
] as const;
