"use client";
import { SecretInput } from "@/components/ui/secret-input";
import { ModernSelect } from "@/components/ui/modern-select";
import { useRemoteCursor } from "@/lib/pagination/use-cursor";
import { Table } from "@/components/ui/table"
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from '@/components/brand-logo';
import { AdminPageHeader } from '@/app/admin/components/admin-page-header';
import { PlatformListStats, PlatformOverview, platformMetricKeys } from './admin-insights';
import { useDebounce } from '@/hooks/use-debounce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCallback, useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  Building2,
  Layers,
  Receipt,
  CreditCard,
  Users,
  Shield,
  Globe,
  ScrollText,
  Settings,
  LogOut,
  Plus,
  X,
  Search,
  ArrowUpRight, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, ChevronRight,
} from "lucide-react";
import { consoleApi } from "@/lib/console-api";
import { ThemeToggle } from "@/components/theme-toggle";
import "./platform.css";
const navigation = [
  ["overview", "Overview", LayoutDashboard],
  ["tenants", "Tenants", Building2],
  ["packages", "Packages", Layers],
  ["subscriptions", "Subscriptions", Receipt],
  ["payments", "Payments", CreditCard],
  ["gateways", "Payment gateways", CreditCard],
  ["users", "Platform users", Users],
  ["roles", "Roles", Shield],
  ["domains", "Domains", Globe],
  ["audit", "Audit log", ScrollText],
  ["settings", "Settings", Settings],
] as const;
const actions = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "invite",
  "manage",
];
function permission(user: any, resource: string, action = "view") {
  return (
    user?.permissions?.includes("*") ||
    user?.permissions?.includes(`${resource}:${action}`) ||
    user?.permissions?.includes(`${resource}:manage`)
  );
}
export function Badge({ value }: { value: unknown }) {
  const text = String(value ?? "pending");
  return (
    <span
      className={
        "platform-badge " +
        (["failed", "expired", "suspended", "cancelled", "false"].includes(text)
          ? "bad"
          : ["pending", "past_due", "trial", "provisioning"].includes(text)
            ? "warning"
            : "")
      }
    >
      {text.replaceAll("_", " ")}
    </span>
  );
}
function formatMoney(v: any, currency = "BDT") {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(v ?? 0));
}
function shortDate(v: any) {
  return v
    ? new Date(v).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })
    : "—";
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="platform-modal-backdrop" onClick={close}>
      <section
        ref={ref}
        className="platform-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Portalled pickers handle their own Escape and Tab keys first.
          if ((e.target as HTMLElement).closest('[data-slot="select-content"], [data-slot="dropdown-menu-content"]')) return;
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const items = ref.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]):not([aria-hidden]),textarea:not([disabled])",
            );
            if (items?.length) {
              const first = items[0],
                last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <div className="platform-modal-head">
          <h2>{title}</h2>
          <button
            className="platform-btn"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Form({
  save,
  children,
  submitLabel = "Save changes",
}: {
  submitLabel?: string;
  save: (f: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="platform-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await save(new FormData(e.currentTarget));
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <p className="platform-error" role="alert">
          {error}
        </p>
      )}
      {children}
      <button className="platform-btn primary" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
export function PermissionMatrix({
  resources,
  value,
  onChange,
}: {
  resources: { key: string; label: string }[];
  value: string[];
  onChange: (p: string[]) => void;
}) {
  return (
    <div style={{ overflow: "auto", maxHeight: 360 }}>
      <Table className="platform-table">
        <thead>
          <tr>
            <th>Access</th>
            {actions.map((a) => (
              <th key={a}>{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              {actions.map((a) => {
                const key = `${r.key}:${a}`;
                return (
                  <td key={a}>
                    <input
                      type="checkbox"
                      aria-label={`${r.label} ${a}`}
                      checked={value.includes(key)}
                      onChange={(e) =>
                        onChange(
                          e.target.checked
                            ? [...value, key]
                            : value.filter((p) => p !== key),
                        )
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
export function PlatformPanel({ section }: { section: string[] }) {
  const current = section[0] ?? "overview",
    [user, setUser] = useState<any>(null),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [statusFilter, setStatusFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<any>(null),
    [catalog, setCatalog] = useState<any>(null),
    [roles, setRoles] = useState<any[]>([]),
    [packages, setPackages] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultMetric = current === 'tenants' ? 'businesses' : 'all';
  const requestedMetric = searchParams.get('metric') ?? defaultMetric;
  const metricFilter = [...(platformMetricKeys[current] ?? []), ...(current==='tenants' ? ['expiring_trials','overdue'] : [])].includes(requestedMetric) ? requestedMetric : defaultMetric;
  const selectMetric = (key: string) => {
    setStatusFilter('all'); setSearch('');
    router.replace(`/admin/${current}${key===defaultMetric ? '' : '?metric='+key}`, {scroll:false});
  };
  const gatewayRows = Array.isArray(data) ? data.filter((g:any)=>metricFilter==='configured' ? g.is_configured : metricFilter==='tenant' ? g.enabled_for_tenants : metricFilter==='platform' ? g.enabled_for_platform : true) : [];
  const debouncedSearch = useDebounce(search, 300);
  useEffect(() => {
    if (!mobileOpen) return;
    sidebar.current?.querySelector<HTMLAnchorElement>("nav a")?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobileOpen]);
  const cursorTable = useRemoteCursor<any>('/platform/' + current, {
    _search: debouncedSearch,
    _filters: JSON.stringify([...(metricFilter==='all' ? [] : [{field:'metrics.'+metricFilter,op:'eq',value:true}]), ...(statusFilter === 'all' ? [] : [{field:'status',op:'eq',value:statusFilter}])]),
  }, !['overview', 'settings', 'gateways'].includes(current) && !!user && permission(user, current))
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await consoleApi("/platform/me");
      setUser(me);
      if (!navigation.some((n) => n[0] === current) || !permission(me, current))
        throw new Error("You do not have access to this page");
      const path = current === "overview" ? "stats" : current;
      const isList = !['overview', 'settings', 'gateways'].includes(current);
      const r = isList ? [] : await consoleApi('/platform/' + path);
      setData(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [current]);
  useEffect(() => {
    load();
    consoleApi("/platform/catalog")
      .then(setCatalog)
      .catch(() => {});
    consoleApi("/platform/roles")
      .then(setRoles)
      .catch(() => {});
    consoleApi("/platform/packages")
      .then(setPackages)
      .catch(() => {});
  }, [load]);
  const done = () => {
    setModal(null);
    load();
    cursorTable.refresh();
  };
  const title = navigation.find((n) => n[0] === current)?.[1] ?? "Workspace";
  return (
    <main className={"platform-app platform-admin" + (collapsed ? " is-collapsed" : "")}>
      {mobileOpen && <button className="platform-sidebar-backdrop" aria-label="Close navigation" onClick={()=>{setMobileOpen(false);menuButton.current?.focus()}} />}
      <aside ref={sidebar} onKeyDown={event=>{
        if (!mobileOpen || event.key !== "Tab") return;
        const items = sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
        if (!items?.length) return;
        const first=items[0],last=items[items.length-1];
        if (event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus()}
        else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus()}
      }} id="platform-sidebar" className={'platform-sidebar' + (mobileOpen ? ' is-open' : '')} aria-label="Platform navigation">
        <div className="platform-sidebar-brand"><BrandLogo variant={collapsed ? 'mark' : 'sidebar'} href="/admin"/><button className="platform-sidebar-close" aria-label="Close navigation" onClick={()=>{setMobileOpen(false);menuButton.current?.focus()}}><X size={18}/></button></div>
        <nav>
          {[{label:'Overview',resources:['overview']},{label:'Business & billing',resources:['tenants','packages','subscriptions','payments','gateways']},{label:'Administration',resources:['users','roles','domains','audit','settings']}].map(group=><div className="platform-nav-group" key={group.label}><p className="platform-nav-label">{group.label}</p>{navigation.filter(([r])=>group.resources.includes(r)&&permission(user,r)).map(([r,label,Icon])=><Link key={r} href={r==='overview'?'/admin':'/admin/'+r} className={current===r?'active':''} aria-current={current===r?'page':undefined} title={label} onClick={()=>setMobileOpen(false)}><Icon size={18}/><span>{label}</span></Link>)}</div>)}
        </nav>
        <div className="account"><div className="platform-account-avatar" aria-hidden="true">{user?.email?.slice(0,1).toUpperCase()??'A'}</div><div className="platform-account-copy"><strong>{user?.role??'Platform admin'}</strong><span>{user?.email}</span></div><button className="platform-account-logout" aria-label="Sign out" title="Sign out" onClick={async()=>{await consoleApi('/platform/logout','POST');location.assign('/login')}}><LogOut size={17}/></button></div>
      </aside>
      <div className="platform-workspace">
        <div className="platform-admin-topbar"><div className="platform-topbar-leading"><button ref={menuButton} className="platform-mobile-menu platform-icon-button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="platform-sidebar" onClick={()=>setMobileOpen(true)}><Menu size={19}/></button><button className="platform-collapse-menu platform-icon-button" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="platform-sidebar" onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button><Link href="/admin">Platform</Link><ChevronRight size={14}/><span>{title}</span></div><div className="platform-topbar-actions"><button className="platform-icon-button" aria-label="Refresh workspace" disabled={loading||cursorTable.loading} onClick={()=>{load();cursorTable.refresh()}}><RefreshCw size={16} className={loading?'animate-spin':''}/></button><ThemeToggle/><span className="platform-topbar-avatar" title={user?.email}>{user?.email?.slice(0,1).toUpperCase()??'A'}</span></div></div>
      <section className="platform-content">

        <AdminPageHeader title={title} eyebrow="Platform workspace" subtitle={current === 'overview' ? 'A clear view of your platform and the businesses you support.' : 'Manage ' + title.toLowerCase() + ' across your platform.'} breadcrumbs={[{label:'Platform',href:'/admin'},{label:title}]} actions={<div className="platform-actions" style={{ margin: 0 }}>
            {current === "tenants" && (
              <button
                className="platform-btn"
                disabled={!permission(user, "tenants", "invite")}
                onClick={() => setModal({ type: "inviteTenant" })}
              >
                <Plus size={16} />
                Invite tenant
              </button>
            )}
            {["packages", "roles"].includes(current) &&
              permission(user, current, "create") && (
                <button
                  className="platform-btn primary"
                  onClick={() => setModal({ type: current, value: null })}
                >
                  <Plus size={16} />
                  New {current === "packages" ? "package" : "role"}
                </button>
              )}
            {current === "users" && permission(user, "users", "invite") && (
              <button
                className="platform-btn primary"
                onClick={() => setModal({ type: "invite" })}
              >
                <Plus size={16} />
                Invite user
              </button>
            )}
          </div>} />
        {error && (
          <p className="platform-error" role="alert">
            {error}{" "}
            <button className="platform-btn" onClick={load}>
              Retry
            </button>
          </p>
        )}
        {loading ? (
          <div className="platform-skeleton" />
        ) : (
          data && (
            <>
              {Array.isArray(data) && <PlatformListStats section={current} data={data} summary={cursorTable.summary} selected={metricFilter} onFilter={selectMetric} />}
              {current === "overview" ? (
                <PlatformOverview data={data} />
              ) : current === "settings" ? (
                <Form
                  save={async (f) => {
                    await consoleApi("/platform/settings", "PATCH", {
                      trialDays: Number(f.get("trialDays")),
                      graceDays: Number(f.get("graceDays")),
                    });
                    load();
                  }}
                >
                  <div className="platform-card platform-form-grid">
                    <label>
                      Default trial days
                      <input placeholder="e.g. 14"
                        type="number"
                        min={0}
                        max={365}
                        name="trialDays"
                        defaultValue={data.settings.trialDays}
                      />
                    </label>
                    <label>
                      Renewal grace days
                      <input placeholder="e.g. 3"
                        type="number"
                        min={0}
                        max={30}
                        name="graceDays"
                        defaultValue={data.settings.graceDays}
                      />
                    </label>
                    <p className="platform-muted">
                      Package versions preserve existing subscription terms. Set
                      package-specific trials in Packages.
                    </p>
                  </div>
                </Form>
              ) : current === "gateways" ? (
                <div className="platform-grid">
                  {gatewayRows.map((g: any) => (
                    <article className="platform-card" key={g.slug}>
                      <h3>{g.name}</h3>
                      <p>
                        <Badge
                          value={g.is_configured ? "configured" : "pending"}
                        />
                      </p>
                      <p className="platform-muted">
                        Tenant checkout:{" "}
                        {g.enabled_for_tenants ? "Enabled" : "Disabled"}
                        <br />
                        Platform subscriptions:{" "}
                        {g.enabled_for_platform ? "Enabled" : "Disabled"}
                        <br />
                        {g.sandbox ? "Sandbox" : "Live"}
                      </p>
                      <button
                        className="platform-btn"
                        disabled={!permission(user, current, "edit")}
                        onClick={() => setModal({ type: "gateway", value: g })}
                      >
                        Configure
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <>
                  <div className="platform-list-toolbar">
                    <label className="platform-list-search"><span className="sr-only">Search {title.toLowerCase()}</span><Search size={16}/><input className="platform-input" placeholder={`Search ${title.toLowerCase()}…`} value={search} onChange={event=>setSearch(event.target.value)}/></label>
                    <div className="flex items-center gap-3"><span className="platform-muted text-xs">{cursorTable.pageInfo.total} results</span>{metricFilter!==defaultMetric && <button className="platform-btn" onClick={()=>selectMetric(defaultMetric)}>Clear card filter</button>}
                      {['tenants','subscriptions','payments','domains'].includes(current) && <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px]" aria-label="Filter by status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{(cursorTable.summary?.statuses ?? []).map(value=><SelectItem key={value} value={value}>{value.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select>}
                    </div>
                  </div>
                  <div className="platform-table-wrap">
                    <Table cursorPagination={cursorTable} className="platform-table">
                      <thead>
                        <tr>
                          {columns(current).map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cursorTable.data
                          .map((row: any) => (
                            <tr key={row.id ?? row.tenant_id}>
                              {cells(current, row).map((v, i) => (
                                <td key={i}>{v}</td>
                              ))}
                              {[
                                "tenants",
                                "packages",
                                "roles",
                                "users",
                              ].includes(current) && (
                                <td>
                                  {current==='tenants' && row.record_type==='invitation' ? <span className="platform-muted">Awaiting acceptance</span> : <div className="platform-actions">
                                  <button
                                    className="platform-btn"
                                    disabled={
                                      current !== "tenants" &&
                                      !permission(user, current, "edit")
                                    }
                                    onClick={() =>
                                      setModal({ type: current, value: row })
                                    }
                                  >
                                    {current === "tenants" ? "Open" : "Edit"}
                                    <ArrowUpRight size={14} />
                                  </button>
                                  {current==='tenants' && permission(user,'tenants','edit') && <button className="platform-btn" onClick={()=>setModal({type:'tenantAccess',value:row})}>{row.active ? 'Deactivate' : 'Activate'}</button>}
                                  </div>}
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                    {!cursorTable.loading && !cursorTable.data.length && !cursorTable.error && (
                      <p className="platform-empty">
                        {search || statusFilter !== "all" || metricFilter !== defaultMetric ? "No matching records. Try another search or status." : `No ${title.toLowerCase()} yet.`}
                        {(search || statusFilter !== "all" || metricFilter !== defaultMetric) && <button className="platform-btn" onClick={()=>{setSearch("");setStatusFilter("all");selectMetric(defaultMetric)}}>Clear filters</button>}
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )
        )}
        {modal && (
          <Dialog
            title={
              modal.type === "tenantAccess" ? (modal.value.active ? "Deactivate tenant" : "Activate tenant") : modal.type === "invite"
                ? "Invite platform user"
                : modal.type === "inviteTenant"
                  ? "Invite a business"
                  : modal.type === "tenants"
                    ? "Tenant workspace"
                    : modal.type === "gateway"
                      ? "Configure " + modal.value.name
                      : modal.type === "packages"
                        ? "Package settings"
                        : modal.type === "roles"
                          ? "Role permissions"
                          : "Platform account"
            }
            close={() => setModal(null)}
          >
            {modal.type === 'tenantAccess' && <Form submitLabel={modal.value.active ? 'Deactivate tenant' : 'Activate tenant'} save={async f=>{
              await consoleApi('/platform/tenants/'+modal.value.id,'PATCH',{active:!modal.value.active,reason:f.get('reason')});
              done();
            }}><h3>{modal.value.active ? 'Deactivate' : 'Activate'} {modal.value.name}</h3>
              <p className="platform-muted">{modal.value.active ? 'Deactivation blocks access to this tenant workspace. Its data and subscription are retained.' : 'Activation restores workspace access when its email verification and subscription requirements are satisfied.'}</p>
              <label>Reason<textarea name="reason" placeholder="e.g. Temporary suspension requested by the owner" required maxLength={1000}/></label>
            </Form>}
            {modal.type === "packages" && (
              <PackageEditor
                value={modal.value}
                catalog={catalog}
                done={done}
              />
            )}
            {modal.type === "roles" && (
              <RoleEditor value={modal.value} catalog={catalog} done={done} />
            )}
            {modal.type === "gateway" && (
              <GatewayEditor value={modal.value} done={done} />
            )}
            {modal.type === "tenants" && (
              <TenantEditor
                value={modal.value}
                packages={packages}
                catalog={catalog}
                user={user}
                done={done}
              />
            )}
            {["invite", "inviteTenant"].includes(modal.type) && (
              <Form
                save={async (f) => {
                  await consoleApi(
                    modal.type === "invite"
                      ? "/platform/users/invite"
                      : "/platform/tenants/invite",
                    "POST",
                    {
                      email: f.get("email"),
                      role_id: f.get("role_id"),
                      package_id: f.get("package_id"),
                    },
                  );
                  done();
                }}
              >
                <label>
                  Email
                  <input placeholder="e.g. alex@example.com" name="email" type="email" required />
                </label>
                {modal.type === "invite" ? (
                  <label>
                    Role
                    <ModernSelect name="role_id" required>
                      {roles
                        .filter((r) => !r.protected)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </ModernSelect>
                  </label>
                ) : (
                  <label>
                    Package
                    <ModernSelect name="package_id" required>
                      {packages
                        .filter((p) => p.published)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </ModernSelect>
                  </label>
                )}
                <p className="platform-muted">
                  An expiring invitation link will be sent by email.
                </p>
              </Form>
            )}
            {modal.type === "users" && (
              <Form
                save={async (f) => {
                  await consoleApi(
                    "/platform/users/" + modal.value.id,
                    "PATCH",
                    {
                      role_id: f.get("role_id"),
                      name: f.get("name"),
                      active: f.get("active") === "on",
                    },
                  );
                  done();
                }}
              >
                <label>
                  Role
                  <ModernSelect name="role_id" defaultValue={modal.value.role_id}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </ModernSelect>
                </label>
                <label className="check">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={modal.value.active}
                  />
                  Account active
                </label>
              </Form>
            )}
          </Dialog>
        )}
      </section>
      </div>
    </main>
  );
}
function columns(section: string): string[] {
  return (
    (
      {
        tenants: [
          "Business",
          "Subscription",
          "Staff",
          "Customers",
          "Status",
          "",
        ],
        packages: ["Package", "Monthly / yearly", "Limits", "Published", ""],
        subscriptions: ["Business", "Package", "Status", "Billing", "Expires"],
        payments: [
          "Business",
          "Reference",
          "Amount",
          "Gateway",
          "Status",
          "Date",
        ],
        users: ["Email", "Role", "Active", "Created", ""],
        roles: ["Role", "Permissions", "Protected", ""],
        domains: ["Domain", "Business", "Status", "Primary", "Last error"],
        audit: ["Action", "Actor", "Business", "Reason", "Date"],
      } as Record<string, string[]>
    )[section] ?? []
  );
}
function Usage({ used, cap }: { used: number; cap: number }) {
  return (
    <div>
      {used} / {cap}
      <div className="platform-progress">
        <span
          style={{
            width: Math.min(100, (used / Math.max(1, cap)) * 100) + "%",
          }}
        />
      </div>
    </div>
  );
}
function cells(s: string, r: any): React.ReactNode[] {
  switch (s) {
    case "tenants":
      if (r.record_type==='invitation') return [<div key="invite"><strong>{r.email}</strong><div className="platform-muted">Invited owner · {r.package ?? 'Package pending'}</div></div>, <Badge key="invited" value="invited"/>, '—', '—', <div key="expires"><Badge value={r.invitation_status}/><div className="platform-muted">Expires {shortDate(r.expires_at)}</div></div>];
      return [
        <div key="name">
          <strong>{r.name}</strong>
          <div className="platform-muted">{r.slug}</div>
        </div>,
        <Badge key="status" value={r.status} />,
        <Usage
          key="staff"
          used={Number(r.usage.staff) + Number(r.usage.reserved)}
          cap={r.staff_limit_override ?? r.staff_limit}
        />,
        <Usage
          key="customers"
          used={Number(r.usage.customers)}
          cap={r.customer_limit_override ?? r.customer_limit}
        />,
        <Badge key="active" value={r.active ? "active" : "suspended"} />,
      ];
    case "packages":
      return [
        r.name,
        formatMoney(r.monthly, r.currency) +
          " / " +
          formatMoney(r.yearly, r.currency),
        `${r.staff_limit} staff · ${r.customer_limit} customers`,
        r.published ? "Yes" : "No",
      ];
    case "subscriptions":
      return [
        r.name,
        r.package,
        <Badge key="s" value={r.status} />,
        `${r.interval}${r.stripe_subscription ? " · automatic" : " · checkout renewal"}`,
        shortDate(r.ends_at),
      ];
    case "payments":
      return [
        r.name,
        r.tran_id,
        formatMoney(r.amount, r.currency),
        r.gateway_slug,
        <Badge key="s" value={r.status} />,
        shortDate(r.created_at),
      ];
    case "users":
      return [
        r.email,
        r.role,
        <Badge key="a" value={r.active ? "active" : "disabled"} />,
        shortDate(r.created_at),
      ];
    case "roles":
      return [
        r.name,
        r.permissions.includes("*")
          ? "All platform permissions"
          : r.permissions.length + " permissions",
        r.protected ? "Yes" : "No",
      ];
    case "domains":
      return [
        r.hostname,
        r.tenant,
        <Badge key="s" value={r.status} />,
        r.is_primary ? "Yes" : "No",
        r.last_error ?? "—",
      ];
    case "audit":
      return [
        r.action,
        r.actor_id?.slice(0, 8) ?? "System",
        r.tenant_id?.slice(0, 8) ?? "Platform",
        r.reason || "—",
        shortDate(r.created_at),
      ];
    default:
      return [];
  }
}

function PackageEditor({ value, catalog, done }: any) {
  const [features, setFeatures] = useState<string[]>(value?.features ?? []);
  return (
    <Form
      save={async (f) => {
        await consoleApi(
          "/platform/packages" + (value ? "/" + value.id : ""),
          value ? "PATCH" : "POST",
          {
            name: f.get("name"),
            slug: f.get("slug"),
            monthly: Number(f.get("monthly")),
            yearly: Number(f.get("yearly")),
            currency: f.get("currency"),
            staff_limit: Number(f.get("staff")),
            customer_limit: Number(f.get("customers")),
            trial_days: Number(f.get("trial")),
            features,
            published: f.get("published") === "on",
            demo: f.get("demo") === "on",
          },
        );
        done();
      }}
    >
      <div className="platform-form-grid">
        <label>
          Name
          <input placeholder="e.g. Growth" name="name" defaultValue={value?.name} required />
        </label>
        {!value && (
          <label>
            Package identifier
            <input placeholder="e.g. growth" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </label>
        )}
        <label>
          Currency
          <input placeholder="e.g. BDT"
            name="currency"
            defaultValue={value?.currency ?? "BDT"}
            required
            maxLength={3}
          />
        </label>
        <label>
          Monthly price
          <input placeholder="e.g. 1500"
            name="monthly"
            type="number"
            min={0}
            step="0.01"
            defaultValue={value?.monthly ?? 0}
          />
        </label>
        <label>
          Yearly price
          <input placeholder="e.g. 1500"
            name="yearly"
            type="number"
            min={0}
            step="0.01"
            defaultValue={value?.yearly ?? 0}
          />
        </label>
        <label>
          Staff accounts
          <input placeholder="e.g. 5"
            name="staff"
            type="number"
            min={1}
            defaultValue={value?.staff_limit ?? 5}
          />
        </label>
        <label>
          Customer accounts
          <input placeholder="e.g. 200"
            name="customers"
            type="number"
            min={0}
            defaultValue={value?.customer_limit ?? 200}
          />
        </label>
        <label>
          Trial days
          <input placeholder="e.g. 14"
            name="trial"
            type="number"
            min={0}
            max={365}
            defaultValue={value?.trial_days ?? 0}
          />
        </label>
      </div>
      <label className="check">
        <input
          name="published"
          type="checkbox"
          defaultChecked={value?.published}
        />
        Publish on pricing page
      </label>
      <label className="check">
        <input
          name="demo"
          type="checkbox"
          defaultChecked={value?.demo ?? true}
        />
        Mark prices as demonstration prices
      </label>
      <div className="platform-matrix">
        {catalog?.features?.map((r: any) => (
          <label className="check" key={r.key}>
            <input
              type="checkbox"
              checked={features.includes(r.key)}
              onChange={(e) =>
                setFeatures(
                  e.target.checked
                    ? [...new Set([...features, r.key, ...r.dependencies])]
                    : features.filter((k) => k !== r.key),
                )
              }
            />
            {r.label}
          </label>
        ))}
      </div>
      <p className="platform-muted">
        Saving creates a new version. Existing subscriptions retain their agreed
        terms.
      </p>
    </Form>
  );
}
function RoleEditor({ value, catalog, done }: any) {
  const [permissions, setPermissions] = useState<string[]>(
    value?.permissions ?? [],
  );
  if (value?.protected)
    return (
      <p className="platform-muted">
        The superadmin role is protected and always has full platform access.
      </p>
    );
  return (
    <Form
      save={async (f) => {
        await consoleApi(
          "/platform/roles" + (value ? "/" + value.id : ""),
          value ? "PATCH" : "POST",
          { name: f.get("name"), permissions },
        );
        done();
      }}
    >
      <label>
        Role name
        <input placeholder="e.g. Support manager" name="name" required defaultValue={value?.name} />
      </label>
      <PermissionMatrix
        resources={(catalog?.platformResources ?? []).map((key: string) => ({
          key,
          label: key,
        }))}
        value={permissions}
        onChange={setPermissions}
      />
    </Form>
  );
}
export function GatewayEditor({ value, done, tenant = false }: any) {
  return (
    <Form
      save={async (f) => {
        const credentials = Object.fromEntries(
          value.config_schema.map((r: any) => [r.key, f.get(r.key)]),
        );
        await consoleApi(
          tenant ? "/payments/gateways" : "/platform/gateways/" + value.slug,
          "PATCH",
          {
            gateway_slug: value.slug,
            credentials,
            sandbox: f.get("sandbox") === "on",
            active: f.get("active") === "on",
            enabled_for_tenants: f.get("tenants") === "on",
            enabled_for_platform: f.get("platform") === "on",
          },
        );
        done();
      }}
    >
      {value.config_schema.map((r: any) => {
        const secret = r.type === 'password' || /secret|password|token|private|api.?key/i.test(r.key);
        const Field = secret ? SecretInput : 'input';
        const example = /publishable/i.test(r.key) ? 'e.g. pk_test_…'
          : /webhook/i.test(r.key) ? 'e.g. whsec_…'
          : /secret_key/i.test(r.key) ? 'e.g. sk_test_…'
          : /store_id/i.test(r.key) ? 'e.g. yourstore123'
          : secret ? 'e.g. Your merchant secret' : 'e.g. Your merchant identifier';
        return (
        <label key={r.key}>
          {r.label}
          <Field
            name={r.key}
            aria-label={r.label}
            type={secret ? "password" : "text"}
            autoComplete="off"
            placeholder={
              value.is_configured ? "Saved · leave blank to keep" : example
            }
          />
        </label>
        );
      })}
      <label className="check">
        <input
          name="sandbox"
          type="checkbox"
          defaultChecked={value.sandbox ?? value.is_sandbox}
        />
        Sandbox mode
      </label>
      {tenant ? (
        <label className="check">
          <input name="active" type="checkbox" defaultChecked={value.active} />
          Enable customer checkout
        </label>
      ) : (
        <>
          <label className="check">
            <input
              name="tenants"
              type="checkbox"
              defaultChecked={value.enabled_for_tenants}
            />
            Allow tenants to configure this gateway
          </label>
          <label className="check">
            <input
              name="platform"
              type="checkbox"
              defaultChecked={value.enabled_for_platform}
            />
            Enable platform subscription checkout
          </label>
        </>
      )}
      <p className="platform-muted">
        Credentials are stored securely and are never returned. Disabling
        checkout does not cancel existing subscriptions or invalidate earlier
        payments.
      </p>
    </Form>
  );
}
function TenantEditor({ value, packages, catalog, user, done }: any) {
  const [data, setData] = useState<any>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState("");
  useEffect(() => {
    consoleApi("/platform/tenants/" + value.id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [value.id]);
  if (error) return <p className="platform-error">{error}</p>;
  if (!data) return <div className="platform-skeleton" />;
  const s = data.subscription;
  return (
    <>
      <div className="platform-tabs">
        {["overview", "features", "domains", "invitations", "audit"].map(
          (t) => (
            <button
              className={"platform-btn " + (tab === t ? "primary" : "")}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {tab === "overview" && (
        <>
          <h3>{data.name}</h3>
          <p className="platform-muted">
            {data.slug} · {data.branches.length} branches
            <br />
            Staff: {data.usage.staff} active · {data.usage.reserved} reserved ·{" "}
            {data.usage.staffDisabled ?? 0} disabled /{" "}
            {s.staff_limit_override ?? data.terms.staff_limit} seats
            <br />
            Customers: {data.usage.customers} active ·{" "}
            {data.usage.customerDisabled ?? 0} disabled /{" "}
            {s.customer_limit_override ?? data.terms.customer_limit} seats
            <br />
            Subscription: {s.status} · Email{" "}
            {s.email_verified ? "verified" : "pending"} · Payment{" "}
            {s.payment_verified ? "verified" : "pending"}
          </p>
          {permission(user, "tenants", "edit") && (
            <Form
              save={async (f) => {
                await consoleApi("/platform/tenants/" + data.id, "PATCH", {
                  name: f.get("name"),
                  active: f.get("active") === "on",
                  package_id: f.get("package"),
                  staff_limit: f.get("staff") ? Number(f.get("staff")) : null,
                  customer_limit: f.get("customers")
                    ? Number(f.get("customers"))
                    : null,
                  complimentary_until: f.get("complimentary")
                    ? new Date(String(f.get("complimentary"))).toISOString()
                    : undefined,
                  reason: f.get("reason"),
                });
                done();
              }}
            >
              <label>
                Business name
                <input placeholder="e.g. Glow Studio" name="name" defaultValue={data.name} required />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={data.active}
                />
                Business active
              </label>
              <label>
                Package
                <ModernSelect name="package" defaultValue={s.package_id}>
                  {packages.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </ModernSelect>
              </label>
              <div className="platform-form-grid">
                <label>
                  Staff limit override
                  <input
                    name="staff"
                    type="number"
                    min={1}
                    defaultValue={s.staff_limit_override ?? ""}
                    placeholder="Package default"
                  />
                </label>
                <label>
                  Customer limit override
                  <input
                    name="customers"
                    type="number"
                    min={0}
                    defaultValue={s.customer_limit_override ?? ""}
                    placeholder="Package default"
                  />
                </label>
                <label>
                  Complimentary access until
                  <input name="complimentary" type="datetime-local" />
                </label>
              </div>
              <label>
                Reason
                <textarea placeholder="e.g. Temporary limit for the seasonal team" name="reason" required />
              </label>
            </Form>
          )}
        </>
      )}
      {error && (
        <p className="platform-error" role="alert">
          {error}
        </p>
      )}
      {tab === "features" && permission(user, "tenants", "edit") && (
        <Form
          save={async (f) => {
            const overrides = Object.fromEntries(
              catalog.features.map((r: any) => [
                r.key,
                f.get(r.key) === "default" ? null : f.get(r.key) === "on",
              ]),
            );
            await consoleApi("/platform/tenants/" + data.id, "PATCH", {
              overrides,
              reason: f.get("reason"),
            });
            done();
          }}
        >
          <div className="platform-matrix">
            {catalog.features.map((r: any) => (
              <label key={r.key}>
                {r.label}
                <ModernSelect
                  name={r.key}
                  defaultValue={
                    s.overrides[r.key] === undefined
                      ? "default"
                      : s.overrides[r.key]
                        ? "on"
                        : "off"
                  }
                >
                  <option value="default">Package default</option>
                  <option value="on">Enable</option>
                  <option value="off">Disable</option>
                </ModernSelect>
              </label>
            ))}
          </div>
          <label>
            Reason
            <textarea placeholder="e.g. Temporary limit for the seasonal team" name="reason" required />
          </label>
          <h3>Per-tenant gateway availability</h3>
          {["stripe", "sslcommerz"].map((slug) => (
            <div className="platform-actions" key={slug}>
              <span>{slug}</span>
              {[true, false].map((allowed) => (
                <button
                  key={String(allowed)}
                  type="button"
                  className="platform-btn"
                  onClick={async () => {
                    try {
                      await consoleApi(
                        `/platform/tenants/${data.id}/gateways/${slug}`,
                        "PATCH",
                        { allowed },
                      );
                      setError("");
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  {allowed ? "Enable" : "Disable"}
                </button>
              ))}
            </div>
          ))}
        </Form>
      )}
      {["domains", "invitations", "audit"].includes(tab) && (
        <div className="platform-table-wrap">
          <Table className="platform-table">
            <tbody>
              {data[tab].map((r: any) => (
                <tr key={r.id}>
                  <td>{r.hostname ?? r.email ?? r.action}</td>
                  <td>
                    <Badge
                      value={
                        r.status ??
                        (r.accepted_at
                          ? "accepted"
                          : r.revoked_at
                            ? "revoked"
                            : "pending")
                      }
                    />
                  </td>
                  <td>{r.last_error ?? r.reason ?? shortDate(r.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!data[tab].length && <p className="platform-empty">No {tab} yet.</p>}
        </div>
      )}
    </>
  );
}
