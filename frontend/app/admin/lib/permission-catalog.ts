export type PermissionItem = {
  id: string
  label: string
  /** Extra pages this one permission unlocks in the sidebar. */
  pages?: string[]
}

export type PermissionGroup = {
  title: string
  items: PermissionItem[]
}

const ROLE_DASHBOARD: Record<string, PermissionItem> = {
  storeManager: { id: "manager-dashboard", label: "Manager Dashboard" },
  staff: { id: "staff-dashboard", label: "Staff Dashboard" },
  stylist: { id: "stylist-dashboard", label: "Artist Dashboard" },
}

const BASE_GROUPS: PermissionGroup[] = [
  {
    title: "Overview",
    items: [
      { id: "appointments", label: "Requested Bookings" },
      { id: "clients", label: "Clients Details" },
      {
        id: "reports",
        label: "Reports",
        pages: ["Report and Analysis", "Staff Reports"],
      },
    ],
  },
  {
    title: "Sales & Finance",
    items: [
      {
        id: "invoice",
        label: "Sales tools",
        pages: ["POS", "Invoices", "Income & Expense", "Vouchers", "Custom Categories"],
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      { id: "service", label: "Manage Services" },
      { id: "makeover-packages", label: "Manage Packages" },
      { id: "inventory", label: "Inventory" },
    ],
  },
  {
    title: "Team",
    items: [
      { id: "employee", label: "Employees" },
      { id: "attendance", label: "Attendance" },
      { id: "leave-request", label: "Leave Requests" },
      { id: "hr-payroll", label: "Manage Payrolls" },
    ],
  },
  {
    title: "Website",
    items: [
      { id: "news-letter-subscriber", label: "Newsletter Subscribers" },
      {
        id: "settings",
        label: "Website & settings",
        pages: ["Settings", "Home content", "Contact content"],
      },
    ],
  },
  {
    title: "System",
    items: [{ id: "user-management", label: "Roles & Permissions" }],
  },
]

const ACCOUNT_EXTRA_GROUPS: PermissionGroup[] = [
  {
    title: "Dashboards",
    items: [
      { id: "dashboard", label: "Admin Dashboard" },
      { id: "manager-dashboard", label: "Manager Dashboard" },
      { id: "staff-dashboard", label: "Staff Dashboard" },
      { id: "stylist-dashboard", label: "Artist Dashboard" },
    ],
  },
  {
    title: "Other",
    items: [
      { id: "announcement", label: "Announcements" },
      { id: "testimonial", label: "Testimonials" },
    ],
  },
]

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  storeManager: "Manager",
  staff: "Staff",
  stylist: "Artist",
  custom: "Custom",
}

export function buildRolePermissionGroups(
  role: string,
  includeUserManagement: boolean,
): PermissionGroup[] {
  const dashboard = ROLE_DASHBOARD[role]
  return BASE_GROUPS.map((group) => {
    let items = group.items
    if (group.title === "Overview" && dashboard) {
      items = [dashboard, ...items]
    }
    if (group.title === "System" && !includeUserManagement) {
      items = items.filter((item) => item.id !== "user-management")
    }
    return { ...group, items }
  }).filter((group) => group.items.length > 0)
}

export function buildAccountPermissionGroups(): PermissionGroup[] {
  return [...ACCOUNT_EXTRA_GROUPS, ...BASE_GROUPS]
}

const ALL_ITEMS: PermissionItem[] = [
  ...Object.values(ROLE_DASHBOARD),
  ...BASE_GROUPS.flatMap((g) => g.items),
  ...ACCOUNT_EXTRA_GROUPS.flatMap((g) => g.items),
]

const LABEL_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item.label]))

export function permissionLabel(id: string) {
  return LABEL_BY_ID.get(id) ?? id.replace(/-/g, " ")
}

export function groupPermissionIds(groups: PermissionGroup[]) {
  return groups.flatMap((group) => group.items.map((item) => item.id))
}
