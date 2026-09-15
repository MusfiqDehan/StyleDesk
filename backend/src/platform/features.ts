/** Stable entitlement keys. This catalog is also the frontend's navigation contract. */
export const FEATURES = [
  ['dashboard', 'Overview', '/admin'],
  ['manager-dashboard', 'Manager dashboard', '/admin/manager'],
  ['staff-dashboard', 'Staff dashboard', '/admin/staff'],
  ['stylist-dashboard', 'Artist dashboard', '/admin/stylist'],
  ['appointments', 'Bookings', '/admin/bookings'],
  ['clients', 'Clients', '/admin/clients'],
  ['reports', 'Reports', '/admin/reports'],
  ['staff-reports', 'Staff reports', '/admin/staff-reports'],
  ['pos', 'POS', '/admin/pos'],
  ['invoice', 'Invoices', '/admin/invoices'],
  ['finance', 'Income & expense', '/admin/finance'],
  ['vouchers', 'Vouchers', '/admin/vouchers'],
  ['finance-categories', 'Categories', '/admin/finance-categories'],
  ['service', 'Services', '/admin/services'],
  ['StyleDesk-packages', 'Salon packages', '/admin/manage-packages'],
  ['inventory', 'Inventory', '/admin/inventory'],
  ['employee', 'Employees', '/admin/employees'],
  ['attendance', 'Attendance', '/admin/attendance'],
  ['leave-request', 'Leave', '/admin/leave-request'],
  ['hr-payroll', 'Payroll', '/admin/manage-payrolls'],
  ['news-letter-subscriber', 'Newsletter', '/admin/news-letter-subscriber'],
  [
    'website.why-choose-us',
    'Why choose us',
    '/admin/customization/home/why-choose-us',
  ],
  [
    'website.appreciate-excellence',
    'Appreciate excellence',
    '/admin/customization/home/appreciate-excellence',
  ],
  [
    'website.testimonials',
    'Testimonials',
    '/admin/customization/home/testimonials',
  ],
  [
    'website.begin-your-journey',
    'Begin your journey',
    '/admin/customization/home/begin-your-journey',
  ],
  [
    'website.sister-concerns',
    'Sister concerns',
    '/admin/customization/home/sister-concerns',
  ],
  [
    'website.contact',
    'Contact section',
    '/admin/customization/contact/contact-section',
  ],
  ['branches', 'Branches', '/admin/branches'],
  ['roles', 'Roles & permissions', '/admin/roles-permissions'],
  ['user-management', 'Users', '/admin/employee-account'],
  ['settings', 'Business settings', '/admin/settings'],
  ['settings.booking', 'Booking settings', '/admin/settings/booking'],
  ['settings.invoice', 'Invoice settings', '/admin/settings/invoice'],
  ['settings.devices', 'Devices', '/admin/ip-config'],
  ['domains', 'Domains', '/admin/settings/domains'],
  ['online-payments', 'Online payments', '/admin/settings/payments'],
  ['landing-page', 'Public website', ''],
  ['announcement', 'Announcements', ''],
  ['update-password', 'Password', '/admin/update-password'],
] as const;
export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'invite',
  'manage',
] as const;
export const featureKeys = FEATURES.map((f) => f[0]) as string[];
export const DEPENDENCIES: Record<string, string[]> = {
  'online-payments': ['invoice'],
  'hr-payroll': ['employee'],
  attendance: ['employee'],
  'leave-request': ['employee'],
  'staff-reports': ['reports'],
  'website.why-choose-us': ['landing-page'],
  'website.appreciate-excellence': ['landing-page'],
  'website.testimonials': ['landing-page'],
  'website.begin-your-journey': ['landing-page'],
  'website.sister-concerns': ['landing-page'],
  'website.contact': ['landing-page'],
};
export const PLATFORM_RESOURCES = [
  'overview',
  'tenants',
  'packages',
  'subscriptions',
  'payments',
  'gateways',
  'users',
  'roles',
  'domains',
  'audit',
  'settings',
];
export function effectiveFeatures(
  base: string[],
  overrides: Record<string, boolean> = {},
): string[] {
  const enabled = new Set(base.filter((k) => featureKeys.includes(k)));
  for (const [key, value] of Object.entries(overrides))
    value ? enabled.add(key) : enabled.delete(key);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of enabled)
      if ((DEPENDENCIES[key] ?? []).some((d) => !enabled.has(d))) {
        enabled.delete(key);
        changed = true;
      }
  }
  return [...enabled];
}
export function expandLegacy(permissions: string[]): string[] {
  const aliases: Record<string, string[]> = {
    invoice: ['invoice', 'pos', 'finance', 'vouchers', 'finance-categories'],
    reports: ['reports', 'staff-reports'],
    settings: [
      'settings',
      'settings.booking',
      'settings.invoice',
      'settings.devices',
      ...featureKeys.filter((k) => k.startsWith('website.')),
    ],
    'user-management': ['user-management', 'roles', 'branches'],
    'makeover-packages': ['StyleDesk-packages'],
    testimonial: ['website.testimonials'],
  };
  return [
    ...new Set(
      permissions.flatMap((p) =>
        p.includes(':')
          ? [p]
          : (aliases[p] ?? [p]).flatMap((k) => ACTIONS.map((a) => `${k}:${a}`)),
      ),
    ),
  ];
}
export function can(
  permissions: string[],
  key: string,
  action: string,
): boolean {
  return permissions.includes('*') || permissions.includes(`${key}:${action}`);
}
export function featureForRoute(path: string, method: string): string | null {
  const root = path.split('/')[1];
  if (
    root === 'auth' ||
    root === 'access' ||
    root === 'tenant-console' ||
    root === 'payments' ||
    root === 'health' ||
    root === 'domain-proof' ||
    root === 'uploads' ||
    path === '/'
  )
    return null;
  if (
    path === '/bussiness-info/contact' ||
    path === '/bussiness-info/resolve-map-embed'
  )
    return 'website.contact';
  if (path === '/bussiness-info/sort/services') return 'service';
  if (path === '/bussiness-info/sort/packages') return 'StyleDesk-packages';
  if (root === 'finance')
    return path.startsWith('/finance/categories')
      ? 'finance-categories'
      : path.includes('voucher')
        ? 'vouchers'
        : 'finance';
  if (
    (root === 'dashboard' || root === 'manager-dashboard') &&
    path.endsWith('/charts/finance')
  )
    return 'finance';
  if (root === 'dashboard')
    return /manager/.test(path)
      ? 'manager-dashboard'
      : /stylist/.test(path)
        ? 'stylist-dashboard'
        : /staff/.test(path)
          ? 'staff-dashboard'
          : 'dashboard';
  const map: Record<string, string> = {
    'manager-dashboard': 'manager-dashboard',
    vouchers: 'vouchers',
    pos: 'pos',
    appointments: 'appointments',
    clients: 'clients',
    invoice: 'invoice',
    service: 'service',
    'StyleDesk-packages': 'StyleDesk-packages',
    inventory: 'inventory',
    employee: 'employee',
    attendance: 'attendance',
    iclock: 'attendance',
    'device-users': 'attendance',
    payroll: 'hr-payroll',
    'leave-request': 'leave-request',
    reports: 'reports',
    'staff-reports': 'staff-reports',
    branches: 'branches',
    'role-permissions': 'roles',
    'user-management': 'user-management',
    users: 'user-management',
    devices: 'settings.devices',
    'device-config': 'settings.devices',
    'device-discovery': 'settings.devices',
    'appointment-setting': 'settings.booking',
    'invoice-setting': 'settings.invoice',
    'bussiness-info': method === 'GET' ? 'settings' : 'settings',
    'why-choose-us-image': 'website.why-choose-us',
    'appreciate-excellence': 'website.appreciate-excellence',
    testimonial: 'website.testimonials',
    'begin-your-journey': 'website.begin-your-journey',
    'sister-concerns': 'website.sister-concerns',
    'news-letter-subscriber': 'news-letter-subscriber',
    announcement: 'announcement',
  };
  return map[root] ?? '__unclassified__';
}
export const STARTER = featureKeys.filter(
  (k) =>
    ![
      'reports',
      'staff-reports',
      'finance',
      'vouchers',
      'finance-categories',
      'inventory',
      'branches',
      'online-payments',
      'attendance',
      'leave-request',
      'hr-payroll',
      'news-letter-subscriber',
      'domains',
      'settings.devices',
    ].includes(k) && !k.startsWith('website.'),
);
export const GROWTH = featureKeys.filter(
  (k) =>
    ![
      'attendance',
      'leave-request',
      'hr-payroll',
      'news-letter-subscriber',
      'domains',
      'settings.devices',
    ].includes(k),
);

/** Staff historically used the bundled invoice flag only for POS. */
export function migratePermissions(
  permissions: string[],
  role: string,
): string[] {
  return expandLegacy(
    role === 'staff'
      ? permissions.map((p) => (p === 'invoice' ? 'pos' : p))
      : permissions,
  );
}
