import { EmployeeRole } from './entities/employee.entity.js';

// User-facing label; stored DB enum value remains "Stylist".
export const EMPLOYEE_ROLE_ARTIST = 'Artist';
export const STORED_EMPLOYEE_ROLE_STYLIST = 'Stylist';

// ONLY DB enum values — NEVER include user-facing labels like 'Artist'.
// The PostgreSQL employee_role_enum is: Stylist | Manager | Receptionist | Assistant | Other.
export const ARTIST_EMPLOYEE_ROLES: readonly string[] = [
  STORED_EMPLOYEE_ROLE_STYLIST,
];

export function isArtistEmployeeRole(role: EmployeeRole | string | null | undefined): boolean {
  const normalized = String(role ?? '').trim().toLowerCase();
  return normalized === 'artist' || normalized === 'stylist';
}
