"use client";
import { BranchSwitcher } from "@/components/branch-switcher";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Users,
  CreditCard,
  Scissors,
  UserCheck,
  BarChart3,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  MessageSquare,
  Sparkles,
  UserLock,
  X,
  Mail,
  Receipt,
  Wallet,
  Ticket,
  Tags,
  Banknote,
  Boxes,
  Globe,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/auth-redirect";
import { useAuth } from "@admin/hooks/use-auth";
import { hasPermission, canAccessPath } from "@admin/lib/auth-utils";
import { TenantBrand as BrandLogo } from "@/components/tenant-brand";
import {
  loadUnreadBookingIds,
  UNREAD_BOOKINGS_EVENT,
} from "@admin/lib/booking-unread";
import {
  loadUnreadInvoiceIds,
  UNREAD_INVOICES_EVENT,
} from "@admin/lib/invoice-unread";
import {
  DASH_NAV_ACTIVE,
  DASH_NAV_BASE,
  DASH_NAV_IDLE,
  DASH_NAV_RAIL,
  DASH_NAV_ICON,
  DASH_NAV_ICON_ACTIVE,
  DASH_NAV_ICON_IDLE,
} from "@admin/components/dash";
import navStyles from "./sidebar.module.css";

const navigation = [
  {
    title: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        permission: "dashboard",
      },
      {
        name: "Manager Dashboard",
        href: "/admin/manager",
        icon: UserCog,
        permission: "manager-dashboard",
      },
      {
        name: "Staff Dashboard",
        href: "/admin/staff",
        icon: UserCheck,
        permission: "staff-dashboard",
      },
      {
        name: "Artist Dashboard",
        href: "/admin/stylist",
        icon: Scissors,
        permission: "stylist-dashboard",
      },
      {
        name: "Bookings",
        href: "/admin/bookings",
        icon: Calendar,
        permission: "appointments",
      },
      {
        name: "Clients",
        href: "/admin/clients",
        icon: Users,
        permission: "clients",
      },
      {
        name: "Reports & Analysis",
        href: "/admin/reports",
        icon: BarChart3,
        permission: "reports",
      },
    ],
  },
  {
    title: "Sales & Finance",
    items: [
      {
        name: "POS",
        href: "/admin/pos",
        icon: CreditCard,
        permission: "invoice",
      },
      {
        name: "Invoices",
        href: "/admin/invoices",
        icon: Receipt,
        permission: "invoice",
      },
      {
        name: "Income & Expense",
        href: "/admin/finance",
        icon: Wallet,
        permission: "invoice",
      },
      {
        name: "Vouchers",
        href: "/admin/vouchers",
        icon: Ticket,
        permission: "invoice",
      },
      {
        name: "Custom Categories",
        href: "/admin/finance-categories",
        icon: Tags,
        permission: "invoice",
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      {
        name: "Services",
        href: "/admin/services",
        icon: Scissors,
        permission: "service",
      },
      {
        name: "Packages",
        href: "/admin/manage-packages",
        icon: Sparkles,
        permission: "makeover-packages",
      },
      {
        name: "Inventory",
        href: "/admin/inventory",
        icon: Boxes,
        permission: "inventory",
      },
    ],
  },
  {
    title: "Team",
    items: [
      {
        name: "Employees",
        href: "/admin/employees",
        icon: UserCheck,
        permission: "employee",
      },
      {
        name: "Attendance",
        href: "/admin/attendance",
        icon: ClipboardCheck,
        permission: "attendance",
      },
      {
        name: "Leave Requests",
        href: "/admin/leave-request",
        icon: CalendarDays,
        permission: "leave-request",
      },
      {
        name: "Payroll",
        href: "/admin/manage-payrolls",
        icon: Banknote,
        permission: "hr-payroll",
      },
      {
        name: "Staff Reports",
        href: "/admin/staff-reports",
        icon: ClipboardList,
        permission: "reports",
      },
    ],
  },
  {
    title: "Website",
    items: [
      {
        name: "Newsletter Subscribers",
        href: "/admin/news-letter-subscriber",
        icon: Mail,
        permission: "news-letter-subscriber",
      },
      {
        name: "Home",
        href: "/admin/customization/home",
        icon: Globe,
        permission: "settings",
        children: [
          {
            name: "Why Choose Us",
            href: "/admin/customization/home/why-choose-us",
          },
          {
            name: "Appreciate Excellence",
            href: "/admin/customization/home/appreciate-excellence",
          },
          {
            name: "Testimonials",
            href: "/admin/customization/home/testimonials",
          },
          {
            name: "Begin Your Journey",
            href: "/admin/customization/home/begin-your-journey",
          },
          {
            name: "Sister Concerns",
            href: "/admin/customization/home/sister-concerns",
          },
        ],
      },
      {
        name: "Contact",
        href: "/admin/customization/contact",
        icon: MessageSquare,
        permission: "settings",
        children: [
          {
            name: "Contact Section",
            href: "/admin/customization/contact/contact-section",
          },
        ],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        name: "Branches",
        href: "/admin/branches",
        icon: Globe,
        permission: "user-management",
      },
      {
        name: "Roles & Permissions",
        href: "/admin/roles-permissions",
        icon: UserLock,
        permission: "user-management",
      },
      {
        name: "Settings",
        href: "/admin/settings",
        icon: Settings,
        permission: "settings",
        children: [
          { name: "Business settings", href: "/admin/settings" },
          { name: "Booking settings", href: "/admin/settings/booking" },
          { name: "Invoice settings", href: "/admin/settings/invoice" },
        ],
      },
      {
        name: "Custom Roles",
        href: "/admin/settings/roles",
        icon: UserLock,
        permission: "roles",
      },
      {
        name: "Staff Invitations",
        href: "/admin/settings/invitations",
        icon: Users,
        permission: "user-management",
      },
      {
        name: "Domains",
        href: "/admin/settings/domains",
        icon: Globe,
        permission: "domains",
      },
      {
        name: "Online Payments",
        href: "/admin/settings/payments",
        icon: CreditCard,
        permission: "online-payments",
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onClose: () => void;
}

function NavRail({
  active,
  collapsed,
}: {
  active: boolean;
  collapsed?: boolean;
}) {
  if (collapsed) return null;
  return (
    <span
      className={cn(
        DASH_NAV_RAIL,
        navStyles.rail,
        active ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

function NavIcon({
  icon: Icon,
  active,
  collapsed,
}: {
  icon: LucideIcon;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <span
      className={cn(
        DASH_NAV_ICON,
        navStyles.icon,
        collapsed && "size-8 rounded-xl",
        active
          ? cn(DASH_NAV_ICON_ACTIVE, navStyles.iconActive)
          : cn(DASH_NAV_ICON_IDLE, navStyles.iconIdle),
      )}
    >
      <Icon className={cn("shrink-0", collapsed ? "size-[18px]" : "size-4")} />
    </span>
  );
}

function SidebarAccountFooter({
  user,
  collapsed,
  pathname,
  onNavClick,
  onLogout,
}: {
  user: ReturnType<typeof useAuth>["user"];
  collapsed: boolean;
  pathname: string;
  onNavClick: () => void;
  onLogout: (e: React.MouseEvent) => void;
}) {
  const passwordActive = pathname === "/admin/update-password";

  return (
    <>
      <Link
        href="/admin/update-password"
        onClick={onNavClick}
        title={collapsed ? "Profile & Security" : undefined}
        className={cn(
          DASH_NAV_BASE,
          collapsed
            ? "justify-center p-1.5 hover:translate-x-0 hover:scale-[1.03]"
            : "gap-2.5 px-2 py-1.5",
          passwordActive
            ? cn(DASH_NAV_ACTIVE, navStyles.active)
            : cn(DASH_NAV_IDLE, navStyles.idle),
        )}
      >
        <NavRail active={passwordActive} collapsed={collapsed} />
        <NavIcon
          icon={UserLock}
          active={passwordActive}
          collapsed={collapsed}
        />
        <span
          className={cn(
            "truncate whitespace-nowrap transition-opacity duration-200",
            collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100",
          )}
        >
          Profile & Security
        </span>
      </Link>

      {user && (
        <div
          className={cn(
            "mt-2 flex min-w-0 items-center gap-3",
            collapsed ? "justify-center p-1.5" : "p-2.5",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm ring-1 ring-brand-line">
            <span className="text-sm font-semibold uppercase">
              {user.useremail?.charAt(0) || "A"}
            </span>
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 transition-opacity duration-200",
              collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100",
            )}
          >
            <p className="mb-1 truncate whitespace-nowrap text-[13px] font-bold capitalize leading-none text-brand-ink">
              {(user as any).name ||
                (user as any).username ||
                user.useremail?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, " ") ||
                "Admin"}
            </p>
            <p className="truncate whitespace-nowrap text-[11px] leading-none text-brand-muted">
              {user.useremail}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={cn("shrink-0 rounded-lg p-2 text-brand-muted hover:bg-brand-mist hover:text-rose-500", collapsed && "hidden")}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

export function Sidebar({ isOpen, collapsed, onCollapseChange: setCollapsed, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const [unreadBookings, setUnreadBookings] = useState(0);
  const [unreadInvoices, setUnreadInvoices] = useState(0);
  const { user, loading } = useAuth();

  useEffect(() => {
    const syncBookings = () => setUnreadBookings(loadUnreadBookingIds().size);
    const syncInvoices = () => setUnreadInvoices(loadUnreadInvoiceIds().size);
    syncBookings();
    syncInvoices();
    window.addEventListener(UNREAD_BOOKINGS_EVENT, syncBookings);
    window.addEventListener(UNREAD_INVOICES_EVENT, syncInvoices);
    window.addEventListener("storage", syncBookings);
    window.addEventListener("storage", syncInvoices);
    const onFocus = () => {
      syncBookings();
      syncInvoices();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(UNREAD_BOOKINGS_EVENT, syncBookings);
      window.removeEventListener(UNREAD_INVOICES_EVENT, syncInvoices);
      window.removeEventListener("storage", syncBookings);
      window.removeEventListener("storage", syncInvoices);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    setUnreadBookings(loadUnreadBookingIds().size);
    setUnreadInvoices(loadUnreadInvoiceIds().size);
  }, [pathname]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const section of navigation) {
      for (const item of section.items) {
        if ("children" in item && item.children?.length) {
          if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
            next[item.href] = true;
          }
        }
      }
    }
    setOpenMenus((prev) => ({ ...prev, ...next }));
  }, [pathname]);

  const toggleMenu = (href: string) => {
    setOpenMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const handleLogout = () => signOut("/login");

  const handleNavClick = () => {
    onClose();
  };

  const handleLogoutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await handleLogout();
    } catch (err) {
      console.error("Logout failed:", err);
      window.location.href = "/admin/login";
    }
  };

  return (
    <aside
      id="tenant-navigation"
      aria-label="Tenant navigation"
      data-open={isOpen}
      className={cn(
        "admin-sidebar flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-brand-line bg-card",
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-brand-line bg-white transition-all duration-300 ease-in-out",
          collapsed
            ? "flex h-[72px] items-center justify-center px-2"
            : "px-3 py-3.5",
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <BrandLogo variant="mark" />
            <button
              onClick={() => setCollapsed(false)}
              className="admin-sidebar-collapse size-7 items-center justify-center rounded-md text-brand-muted hover:bg-brand-soft hover:text-brand-primary"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <BrandLogo variant="sidebar" className="min-w-0 flex-1" />
            <button
              onClick={() => setCollapsed(true)}
              className="admin-sidebar-collapse size-8 shrink-0 items-center justify-center rounded-md text-brand-muted hover:bg-brand-soft hover:text-brand-primary"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              onClick={onClose}
              className="admin-sidebar-close rounded-md p-2 text-brand-muted hover:bg-brand-mist hover:text-brand-ink"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <BranchSwitcher
          admin={user?.role === "admin" || user?.branchScope === "tenant"}
          homeBranch={user?.branchId}
        />
      )}
      {!collapsed && (
        <div className="relative mx-3 mb-2 mt-1">
          <Search className="absolute left-3 top-2.5 size-4 text-brand-muted" aria-hidden />
          <Input type="search" aria-label="Search navigation" placeholder="Find a page..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 rounded-lg border-brand-line bg-card pl-9 text-xs shadow-none" />
        </div>
      )}
      <nav
        className={cn(
          "min-h-0 flex-1 overflow-y-auto py-3 pb-6",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-brand-line",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          collapsed ? "space-y-3 px-2" : "space-y-4 px-2.5",
        )}
        style={{ overscrollBehavior: "none" }}
      >
        {loading ? (
          <div className="space-y-4 px-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-brand-mist" />
                <div className="space-y-1">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-9 animate-pulse rounded-xl bg-brand-mist/70"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          navigation.map((section) => {
            const visibleItems = section.items.filter((item) =>
              ("children" in item
                ? item.children?.some((child) =>
                    canAccessPath(user, child.href),
                  )
                : canAccessPath(user, item.href)) &&
              (collapsed || !query || section.title.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) ||
                ("children" in item && item.children?.some((child) => child.name.toLowerCase().includes(query) && canAccessPath(user, child.href)))),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    collapsed ? "mb-0 h-0 opacity-0" : "mb-1.5 h-5 opacity-100",
                  )}
                >
                  <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted/80 whitespace-nowrap">
                    {section.title}
                  </p>
                </div>

                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const children =
                      "children" in item
                        ? item.children?.filter((child) =>
                            canAccessPath(user, child.href) && (!query || collapsed || section.title.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) || child.name.toLowerCase().includes(query)),
                          )
                        : undefined;
                    const hasChildren = Boolean(children?.length);
                    const isChildActive = hasChildren
                      ? children!.some((child) => pathname === child.href)
                      : false;
                    const isActive =
                      item.href === "/admin"
                        ? pathname === "/admin" ||
                          pathname === "/admin/dashboard"
                        : hasChildren
                          ? isChildActive ||
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`)
                          : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const isOpen = !!query || (openMenus[item.href] ?? isActive);
                    const parentHref = hasChildren
                      ? children![0].href
                      : item.href;
                    const badgeCount =
                      item.href === "/admin/bookings"
                        ? unreadBookings
                        : item.href === "/admin/invoices"
                          ? unreadInvoices
                          : 0;
                    const badgeLabel =
                      badgeCount > 99 ? "99+" : String(badgeCount);

                    return (
                      <li key={item.name}>
                        {hasChildren && !collapsed ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleMenu(item.href)}
                              title={item.name}
                              aria-expanded={isOpen}
                              className={cn(
                                DASH_NAV_BASE,
                                "w-full gap-2.5 px-2 py-1.5",
                                isActive
                                  ? cn(DASH_NAV_ACTIVE, navStyles.active)
                                  : cn(DASH_NAV_IDLE, navStyles.idle),
                              )}
                            >
                              <NavRail active={isActive} />
                              <NavIcon icon={item.icon} active={isActive} />
                              <span className="flex-1 truncate text-left">
                                {item.name}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "size-3.5 shrink-0 transition-transform duration-200 ease-out",
                                  isOpen ? "rotate-180" : "rotate-0",
                                  isActive
                                    ? navStyles.chevronActive
                                    : navStyles.chevronIdle,
                                )}
                              />
                            </button>
                            <div
                              className={cn(
                                "grid transition-[grid-template-rows] duration-300 ease-out",
                                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                              )}
                            >
                              <ul
                                className="mt-0.5 min-h-0 space-y-0.5 overflow-hidden border-l border-brand-line ml-5.5 pl-2"
                                inert={isOpen ? undefined : true}
                              >
                                {children!.map((child) => {
                                  const childActive = pathname === child.href;
                                  return (
                                    <li key={child.href}>
                                      <Link
                                        href={child.href}
                                        aria-current={childActive ? "page" : undefined}
                                        onClick={handleNavClick}
                                        className={cn(
                                          DASH_NAV_BASE,
                                          "gap-2 px-2.5 py-1.5 text-[12px]",
                                          childActive
                                            ? cn(
                                                DASH_NAV_ACTIVE,
                                                navStyles.active,
                                              )
                                            : cn(DASH_NAV_IDLE, navStyles.idle),
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "size-1.5 shrink-0 rounded-full transition-all duration-200",
                                            navStyles.childDot,
                                          )}
                                        />
                                        <span className="truncate">
                                          {child.name}
                                        </span>
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </>
                        ) : (
                          <Link
                            href={parentHref}
                            aria-current={isActive ? "page" : undefined}
                            onClick={handleNavClick}
                            title={
                              collapsed
                                ? badgeCount > 0
                                  ? `${item.name} (${badgeLabel})`
                                  : item.name
                                : undefined
                            }
                            className={cn(
                              DASH_NAV_BASE,
                              collapsed
                                ? "justify-center p-1.5 hover:translate-x-0 hover:scale-[1.03]"
                                : "gap-2.5 px-2 py-1.5",
                              isActive
                                ? cn(DASH_NAV_ACTIVE, navStyles.active)
                                : cn(DASH_NAV_IDLE, navStyles.idle),
                            )}
                          >
                            <NavRail active={isActive} collapsed={collapsed} />
                            <div className="relative shrink-0">
                              <NavIcon
                                icon={item.icon}
                                active={isActive}
                                collapsed={collapsed}
                              />
                              {isActive && collapsed && badgeCount === 0 && (
                                <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-brand-primary" />
                              )}
                              {collapsed && badgeCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">
                                  {badgeLabel}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "truncate whitespace-nowrap transition-all duration-300 ease-in-out",
                                collapsed
                                  ? "w-0 overflow-hidden opacity-0"
                                  : "flex-1 opacity-100",
                              )}
                            >
                              {item.name}
                            </span>
                            {!collapsed && badgeCount > 0 && (
                              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white">
                                {badgeLabel}
                              </span>
                            )}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </nav>

      {!loading && (
        <div
          className={cn(
            "shrink-0 border-t border-brand-line bg-white",
            collapsed ? "px-2 py-2" : "px-2.5 py-3",
          )}
        >
          <SidebarAccountFooter
            user={user}
            collapsed={collapsed}
            pathname={pathname}
            onNavClick={handleNavClick}
            onLogout={handleLogoutClick}
          />
        </div>
      )}
    </aside>
  );
}
