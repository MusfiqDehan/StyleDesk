import { getCursorCollection } from "@/lib/pagination/collection"
import api from '../base';
import { CACHE, consumeStale, clearCacheByPrefix, markStale } from '@admin/lib/cache';

// Module-level dirty flag: set after any mutation so the very next fetch bypasses cache
let payrollDirty = false;

/** Call after employee salary/name changes so manage-payrolls refetches fresh rows. */
export function markPayrollDirty() {
  payrollDirty = true;
  clearCacheByPrefix(CACHE.PAYROLL);
  markStale(CACHE.PAYROLL);
}

export type PayrollStatus = 'Paid' | 'Pending' | 'Processing';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  status: PayrollStatus;
  payDate: string;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollResponse {
  data: PayrollRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreatePayrollDto {
  employeeId: string;
  employeeName: string;
  role: string;
  baseSalary: number;
  bonus?: number;
  deductions?: number;
  netSalary: number;
  status?: PayrollStatus;
  payDate?: string;
  month: number;
  year: number;
}

function payrollCacheKey(month?: number, year?: number, page = 1, limit = 10, search?: string, status?: string) {
  return `${CACHE.PAYROLL}:${year ?? 'all'}:${month ?? 'all'}:${page}:${limit}:${search ?? ""}:${status ?? ""}`;
}

export async function getPayrollRecords(
  month?: number,
  year?: number,
  page = 1,
  limit = 10,
  search?: string,
  status?: string,
): Promise<PayrollResponse> {
  if (limit >= 100) return await getCursorCollection('/payroll', { month, year, search, status }) as unknown as PayrollResponse
  const key = payrollCacheKey(month, year, page, limit, search, status);
  const bypass = payrollDirty || consumeStale(CACHE.PAYROLL) || consumeStale(key);
  if (payrollDirty) payrollDirty = false;

  if (bypass) {
    clearCacheByPrefix(CACHE.PAYROLL);
  }

  const params: Record<string, any> = { page, limit };
  if (month) params.month = month;
  if (year) params.year = year;
  if (search) params.search = search;
  if (status) params.status = status;

  const { data } = await api.get('/payroll', {
    params,
    id: key,
    cache: bypass ? false : { ttl: 5 * 60 * 1000 },
  } as any);
  return data;
}

export async function createPayrollRecord(dto: CreatePayrollDto): Promise<PayrollRecord> {
  const { data } = await api.post('/payroll', dto);
  clearCacheByPrefix(CACHE.PAYROLL);
  markStale(CACHE.FINANCE, CACHE.DASHBOARD);
  payrollDirty = true;
  return data;
}

export async function updatePayrollRecord(id: string, dto: Partial<CreatePayrollDto>): Promise<PayrollRecord> {
  const { data } = await api.patch(`/payroll/${id}`, dto);
  clearCacheByPrefix(CACHE.PAYROLL);
  markStale(CACHE.FINANCE, CACHE.DASHBOARD);
  payrollDirty = true;
  return data;
}

export async function deletePayrollRecord(id: string): Promise<void> {
  await api.delete(`/payroll/${id}`);
  clearCacheByPrefix(CACHE.PAYROLL);
  // Deleting a Paid payroll drops its Employee Salary & Bonus expense server-side.
  markStale(CACHE.FINANCE, CACHE.DASHBOARD);
  payrollDirty = true;
}
