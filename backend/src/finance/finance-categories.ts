export type FinanceCategoryCode =
  | 'service_revenue'
  | 'membership'
  | 'due_collection'
  | 'other_income'
  | 'employee_salary'
  | 'employee_bonus'
  | 'rent'
  | 'utilities'
  | 'inventory_purchase'
  | 'marketing'
  | 'maintenance'
  | 'other_expense';

export type SystemFinanceCategorySeed = {
  code: FinanceCategoryCode;
  type: 'income' | 'expense';
  /** Default display name (safe to rename later). */
  name: string;
  /** Known historical / alternate names for backfill. */
  aliases: string[];
};

/** System-bound categories — linked by `code`, not display name. */
export const SYSTEM_FINANCE_CATEGORIES: SystemFinanceCategorySeed[] = [
  {
    code: 'service_revenue',
    type: 'income',
    name: 'Service/Package Revenue',
    aliases: [
      'Service Revenue',
      'Service/Package Revenue',
      'Service / Package Revenue',
      'Package Revenue',
      'Services Revenue',
    ],
  },
  {
    code: 'membership',
    type: 'income',
    name: 'Membership',
    aliases: ['Membership'],
  },
  {
    code: 'due_collection',
    type: 'income',
    name: 'Due Collection',
    aliases: ['Due Collection'],
  },
  {
    code: 'other_income',
    type: 'income',
    name: 'Other Income',
    aliases: ['Other Income', 'Misc Income', 'Miscellaneous Income'],
  },
  {
    code: 'employee_salary',
    type: 'expense',
    name: 'Employee Salary & Bonus',
    aliases: ['Employee Salary', 'Employee Salary & Bonus'],
  },
  {
    code: 'employee_bonus',
    type: 'expense',
    name: 'Employee Bonus',
    aliases: ['Employee Bonus', 'Bonus', 'Staff Bonus'],
  },
  {
    code: 'rent',
    type: 'expense',
    name: 'Rent',
    aliases: ['Rent'],
  },
  {
    code: 'utilities',
    type: 'expense',
    name: 'Utilities',
    aliases: ['Utilities'],
  },
  {
    code: 'inventory_purchase',
    type: 'expense',
    name: 'Inventory Purchase',
    aliases: ['Inventory Purchase'],
  },
  {
    code: 'marketing',
    type: 'expense',
    name: 'Marketing',
    aliases: ['Marketing'],
  },
  {
    code: 'maintenance',
    type: 'expense',
    name: 'Maintenance',
    aliases: ['Maintenance'],
  },
  {
    code: 'other_expense',
    type: 'expense',
    name: 'Other Expense',
    aliases: ['Other Expense', 'Misc Expense', 'Miscellaneous Expense'],
  },
];

/**
 * Expense categories owned by Manage Payroll. Their totals are derived from Paid
 * payroll records only — a manual ledger entry must never land in one, or the
 * Expense Summary would show salary money that no payroll ever paid out.
 */
export const PAYROLL_OWNED_EXPENSE_CODES: FinanceCategoryCode[] = [
  'employee_salary',
  'employee_bonus',
];

/** Where a manual expense goes when it has no usable category of its own. */
export const FALLBACK_EXPENSE_CODE: FinanceCategoryCode = 'other_expense';

export function isPayrollOwnedExpenseCode(
  code: string | null | undefined,
): boolean {
  return !!code && PAYROLL_OWNED_EXPENSE_CODES.includes(code as FinanceCategoryCode);
}

/** True for 'Employee Salary & Bonus' / 'Employee Bonus' and their historical names. */
export function isPayrollOwnedExpenseName(
  name: string | null | undefined,
): boolean {
  if (!name?.trim()) return false;
  const seed = findSystemSeedByName(name);
  return isPayrollOwnedExpenseCode(seed?.code);
}

/** @deprecated Prefer SYSTEM_FINANCE_CATEGORIES — kept for any residual imports. */
export const INCOME_CATEGORY_LABELS = SYSTEM_FINANCE_CATEGORIES.filter(
  (c) => c.type === 'income',
).map((c) => c.name);

/** @deprecated Prefer SYSTEM_FINANCE_CATEGORIES */
export const EXPENSE_CATEGORY_LABELS = SYSTEM_FINANCE_CATEGORIES.filter(
  (c) => c.type === 'expense',
).map((c) => c.name);

export type IncomeCategoryLabel = string;
export type ExpenseCategoryLabel = string;

export const MONTH_TABLE_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'June',
  'July',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findSystemSeedByName(name: string): SystemFinanceCategorySeed | undefined {
  const needle = normalizeCategoryName(name);
  return SYSTEM_FINANCE_CATEGORIES.find(
    (seed) =>
      normalizeCategoryName(seed.name) === needle ||
      seed.aliases.some((a) => normalizeCategoryName(a) === needle),
  );
}

/**
 * Classifies a MANUAL ledger entry only (never an invoice row — those are classified by
 * `pickInvoiceIncomeCategory`). 'service_revenue' and 'due_collection' are reserved for
 * income that is automatically derived from the Invoices table: a manual entry that got
 * classified into either of those buckets would be visually indistinguishable from real
 * invoice income and silently inflate Finance overview/trend totals if a staff member
 * re-logs a sale (or a due payment) that was already recorded as/against an invoice.
 * Manual entries default to 'other_income' unless explicitly re-categorized by an admin.
 */
export function categorizeIncomeEntryCode(
  title: string,
  description?: string | null,
): FinanceCategoryCode {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  if (/membership/.test(text)) return 'membership';
  return 'other_income';
}

/**
 * Classifies a MANUAL ledger entry only (never a payroll row — those are written with an
 * explicit category by FinanceService). 'employee_salary' and 'employee_bonus' are reserved
 * for expenses automatically derived from Paid payrolls: a manual entry that got classified
 * into either of them (any note mentioning "salary", "payroll", "staff bonus", …) would be
 * indistinguishable from real payroll spend and would show up under Employee Salary & Bonus
 * even when every payroll is Unpaid. Unmatched manual expenses fall back to 'other_expense'.
 */
export function categorizeExpenseEntryCode(
  title: string,
  description?: string | null,
): FinanceCategoryCode {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  if (/rent|lease/.test(text)) return 'rent';
  if (/electric|water|utility|internet|bill|wasa|isp|gas/.test(text)) return 'utilities';
  if (/inventory|purchase|stock|product|supplies/.test(text)) return 'inventory_purchase';
  if (/marketing|ads|facebook|instagram|promo/.test(text)) return 'marketing';
  if (/repair|maintenance|equipment|uniform|cleaning/.test(text)) return 'maintenance';
  return FALLBACK_EXPENSE_CODE;
}

/** Legacy helpers — return default display names (not live DB names). */
export function categorizeIncomeEntry(
  title: string,
  description?: string | null,
): string {
  const code = categorizeIncomeEntryCode(title, description);
  return SYSTEM_FINANCE_CATEGORIES.find((c) => c.code === code)?.name ?? 'Other Income';
}

export function categorizeExpenseEntry(
  title: string,
  description?: string | null,
): string {
  const code = categorizeExpenseEntryCode(title, description);
  return SYSTEM_FINANCE_CATEGORIES.find((c) => c.code === code)?.name ?? 'Other Expense';
}
