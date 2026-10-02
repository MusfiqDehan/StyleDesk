"use client";
import { ModernSelect } from "@/components/ui/modern-select";
import { Table } from "@/components/ui/table"
import { useCallback, useEffect, useState } from "react";
import { consoleApi } from "@/lib/console-api";
import { GatewayPicker } from "./auth";
import { GatewayEditor, PermissionMatrix, Badge } from "./panel";
import "./platform.css";
import { AdminPageHeader, AdminHeaderSecondaryButton } from "@admin/components/admin-page-header";
import { RefreshCw, Search, Layers, CircleCheck, Clock } from "lucide-react";
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash/kpi-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILTER_TRIGGER, SEARCH_INPUT_CLASS } from "@admin/lib/table-styles";
export function TenantSettings({
  section,
}: {
  section: "domains" | "payments" | "roles" | "invitations" | "billing";
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<any>(null),
    [permissions, setPermissions] = useState<string[]>([]),
    [access, setAccess] = useState<any>(null),
    [catalog, setCatalog] = useState<any[]>([]),
    [roles, setRoles] = useState<any[]>([]),
    [branches, setBranches] = useState<any[]>([]),
    [gateway, setGateway] = useState(""),
    [gateways, setGateways] = useState<any[]>([]);
  const path =
    section === "payments"
      ? "/payments/gateways"
      : "/tenant-console/" + (section === "billing" ? "subscription" : section);
  const load = useCallback(() => {
    setError("");
    consoleApi(path)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => {
    load();
    consoleApi("/access/bootstrap")
      .then((r) => {
        setCatalog(r.catalog);
        setAccess(r);
      })
      .catch(() => {});
    if (section === "invitations") {
      consoleApi("/tenant-console/roles")
        .then(setRoles)
        .catch(() => {});
      consoleApi("/branches")
        .then(setBranches)
        .catch(() => {});
    }
    if (section === "billing")
      consoleApi("/tenant-console/subscription/gateways")
        .then(setGateways)
        .catch(() => {
          consoleApi("/tenant-console/subscription/gateways")
            .then(setGateways)
            .catch(() => {});
        });
  }, [load, section]);
  const capability =
    section === "invitations"
      ? "user-management"
      : section === "payments"
        ? "online-payments"
        : section;
  const action = section === "invitations" ? "invite" : "manage";
  const mayEdit =
    section === "billing" ||
    (!!access?.features.includes(capability) &&
      (access.permissions.includes("*") ||
        access.permissions.includes(`${capability}:${action}`)));
  async function submit(work: () => Promise<any>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await work();
      setMessage(r.message ?? "Saved");
      setEditor(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const rows: any[] = section === "domains" ? data?.domains ?? [] : Array.isArray(data) ? data : [];
  const rowStatus = (row: any): string => {
    if (section === "invitations") return row.accepted_at ? "accepted" : row.revoked_at ? "revoked" : new Date(row.expires_at) < new Date() ? "expired" : "pending";
    if (section === "roles") return row.branch_scope === "tenant" ? "tenant" : "home";
    if (section === "payments") return !row.allowed ? "disabled" : row.is_configured ? "configured" : "pending";
    return row.status;
  };
  const statusOptions: Record<string, string[]> = { domains: ["active", "pending", "provisioning", "disabled", "failed"], invitations: ["pending", "accepted", "expired", "revoked"], roles: ["tenant", "home"], payments: ["configured", "pending", "disabled"] };
  const visibleRows = rows.filter((row) => String(row.hostname ?? row.email ?? row.name ?? "").toLowerCase().includes(search.toLowerCase()) && (status === "all" || rowStatus(row) === status));
  const primaryStatus = section === "roles" ? "tenant" : section === "invitations" ? "accepted" : section === "payments" ? "configured" : "active";
  const secondaryStatus = section === "roles" ? "home" : "pending";
  return (
    <section className="platform-app admin-page space-y-6">
      <AdminPageHeader
        eyebrow="Settings"
        title={section === "billing"
              ? "Subscription & billing"
              : section[0].toUpperCase() + section.slice(1)}
        subtitle={{ domains: "Manage your salon's website addresses and domain verification.", payments: "Manage payment methods available to your customers.", roles: "Manage staff roles and branch access.", invitations: "Invite staff and manage their account access.", billing: "Manage your subscription and billing details." }[section]}
        actions={<AdminHeaderSecondaryButton onClick={load}><RefreshCw />Refresh</AdminHeaderSecondaryButton>}
      />
      {section !== "billing" && data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-brand-muted" /><Input aria-label={`Search ${section}`} placeholder={`Search ${section}...`} value={search} onChange={(event) => setSearch(event.target.value)} className={SEARCH_INPUT_CLASS} /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className={FILTER_TRIGGER} aria-label={section === "roles" ? "Branch access filter" : "Status filter"}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{section === "roles" ? "All access" : "All statuses"}</SelectItem>{statusOptions[section].map((value) => <SelectItem key={value} value={value}>{value === "tenant" ? "Tenant-wide" : value === "home" ? "Home branch" : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select>
          </div>
          <DashKpiGrid className="xl:grid-cols-3">
            <DashKpiCard title={`Matching ${section}`} value={visibleRows.length} icon={Layers} subtitle="Current search and filters" />
            <DashKpiCard title={section === "roles" ? "Tenant-wide access" : primaryStatus[0].toUpperCase() + primaryStatus.slice(1)} value={visibleRows.filter((row) => rowStatus(row) === primaryStatus).length} icon={CircleCheck} tone="success" subtitle="In matching results" />
            <DashKpiCard title={section === "roles" ? "Home branch access" : "Pending"} value={visibleRows.filter((row) => rowStatus(row) === secondaryStatus).length} icon={Clock} tone="warning" subtitle="In matching results" />
          </DashKpiGrid>
          {!visibleRows.length && <p className="text-sm text-brand-muted">No {section} match your filters.</p>}
        </>
      )}
      {error && (
        <p className="platform-error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="platform-success">{message}</p>}
      {!data && !error ? (
        <div className="platform-skeleton" />
      ) : (
        <>
          <fieldset disabled={!mayEdit} className="contents">
            {section === "domains" && data && (
              <>
                <article className="platform-card">
                  <p className="platform-muted">
                    Default address:{" "}
                    <a href={data.default_url}>{data.default_url}</a>
                  </p>
                  <form
                    className="platform-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      submit(() =>
                        consoleApi("/tenant-console/domains", "POST", {
                          hostname: f.get("hostname"),
                        }),
                      );
                    }}
                  >
                    <label>
                      Connect a domain or subdomain
                      <input
                        name="hostname"
                        required
                        placeholder="salon.example.com"
                      />
                    </label>
                    <button className="platform-btn primary" disabled={busy}>
                      Add domain
                    </button>
                  </form>
                </article>
                {visibleRows.map((d: any) => (
                  <article
                    className="platform-card"
                    style={{ marginTop: 16 }}
                    key={d.id}
                  >
                    <div className="platform-page-head">
                      <h3>{d.hostname}</h3>
                      <Badge value={d.status} />
                    </div>
                    <p className="platform-muted">
                      Add these DNS records at your domain provider. Activation
                      and HTTPS are prepared automatically after verification.
                    </p>
                    <label>
                      TXT name
                      <div className="platform-code">
                        _styledesk.{d.hostname}
                      </div>
                    </label>
                    <label>
                      TXT value
                      <div className="platform-code">
                        {d.verification_token}
                      </div>
                    </label>
                    <button
                      className="platform-btn"
                      onClick={() =>
                        navigator.clipboard.writeText(d.verification_token)
                      }
                    >
                      Copy verification value
                    </button>
                    <p className="platform-muted">
                      CNAME target: {data.target}
                      {data.ip && (
                        <>
                          <br />
                          For an apex domain, A record: {data.ip}
                        </>
                      )}
                    </p>
                    {d.last_error && (
                      <p className="platform-error">{d.last_error}</p>
                    )}
                    <div className="platform-actions">
                      <button
                        className="platform-btn"
                        disabled={busy}
                        onClick={() =>
                          submit(() =>
                            consoleApi(
                              "/tenant-console/domains/" + d.id,
                              "PATCH",
                              { retry: true },
                            ),
                          )
                        }
                      >
                        Check again
                      </button>
                      {d.status === "active" && (
                        <button
                          className="platform-btn"
                          onClick={() =>
                            submit(() =>
                              consoleApi(
                                "/tenant-console/domains/" + d.id,
                                "PATCH",
                                { is_primary: true },
                              ),
                            )
                          }
                        >
                          {d.is_primary ? "Primary domain" : "Set primary"}
                        </button>
                      )}
                      <button
                        className="platform-btn danger"
                        onClick={() =>
                          submit(() =>
                            consoleApi(
                              "/tenant-console/domains/" + d.id,
                              "PATCH",
                              { disabled: true },
                            ),
                          )
                        }
                      >
                        Disconnect
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}
            {section === "payments" && data && (
              <div className="platform-grid">
                {visibleRows.map((g: any) => (
                  <article className="platform-card" key={g.slug}>
                    <h3>{g.name}</h3>
                    <p>
                      <Badge
                        value={
                          g.allowed
                            ? g.is_configured
                              ? "configured"
                              : "pending"
                            : "disabled"
                        }
                      />
                    </p>
                    {g.allowed ? (
                      <>
                        {editor?.slug === g.slug ? (
                          <GatewayEditor
                            value={g}
                            tenant
                            done={() => {
                              setEditor(null);
                              load();
                            }}
                          />
                        ) : (
                          <button
                            className="platform-btn"
                            onClick={() => setEditor(g)}
                          >
                            Configure gateway
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="platform-muted">
                        This gateway is disabled by the platform administrator.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
            {section === "roles" && data && (
              <>
                <div className="platform-actions">
                  <button
                    className="platform-btn primary"
                    onClick={() => {
                      setEditor({});
                      setPermissions([]);
                    }}
                  >
                    Create custom role
                  </button>
                </div>
                {editor && (
                  <form
                    className="platform-form platform-card"
                    style={{ marginTop: 20 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      submit(() =>
                        consoleApi(
                          "/tenant-console/roles" +
                            (editor.id ? "/" + editor.id : ""),
                          editor.id ? "PATCH" : "POST",
                          {
                            name: f.get("name"),
                            branch_scope: f.get("branch_scope"),
                            permissions,
                          },
                        ),
                      );
                    }}
                  >
                    <label>
                      Role name
                      <input placeholder="e.g. Front desk team" name="name" defaultValue={editor.name} required />
                    </label>
                    <label>
                      Branch access
                      <ModernSelect
                        name="branch_scope"
                        defaultValue={editor.branch_scope ?? "home"}
                      >
                        <option value="home">Home branch only</option>
                        <option value="tenant">All tenant branches</option>
                      </ModernSelect>
                    </label>
                    <PermissionMatrix
                      resources={catalog}
                      value={permissions}
                      onChange={setPermissions}
                    />
                    <button className="platform-btn primary" disabled={busy}>
                      Save role
                    </button>
                  </form>
                )}
                <div className="platform-table-wrap" style={{ marginTop: 20 }}>
                  <Table className="platform-table">
                    <thead><tr><th>Role</th><th>Branch access</th><th>Permissions</th><th>Action</th></tr></thead>
                    <tbody>
                      {visibleRows.map((r: any) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>
                            {r.branch_scope === "tenant"
                              ? "Tenant-wide"
                              : "Home branch"}
                          </td>
                          <td>{r.permissions.length} permissions</td>
                          <td>
                            <button
                              className="platform-btn"
                              onClick={() => {
                                setEditor(r);
                                setPermissions(r.permissions);
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
            {section === "invitations" && data && (
              <>
                <form
                  className="platform-form platform-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    submit(() =>
                      consoleApi("/tenant-console/invitations", "POST", {
                        email: f.get("email"),
                        role_id: f.get("role_id"),
                        branch_id: f.get("branch_id"),
                      }),
                    );
                  }}
                >
                  <div className="platform-form-grid">
                    <label>
                      Staff email
                      <input placeholder="e.g. alex@example.com" name="email" type="email" required />
                    </label>
                    <label>
                      Role
                      <ModernSelect name="role_id" required>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </ModernSelect>
                    </label>
                    <label>
                      Home branch
                      <ModernSelect name="branch_id">
                        {branches.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </ModernSelect>
                    </label>
                  </div>
                  <button
                    disabled={busy || !roles.length}
                    className="platform-btn primary"
                  >
                    Send invitation
                  </button>
                  <p className="platform-muted">
                    The invitation reserves one staff seat until accepted,
                    revoked, or expired.
                  </p>
                </form>
                <div className="platform-table-wrap" style={{ marginTop: 20 }}>
                  <Table className="platform-table">
                    <thead><tr><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {visibleRows.map((i: any) => (
                        <tr key={i.id}>
                          <td>{i.email}</td>
                          <td>
                            <Badge
                              value={
                                i.accepted_at
                                  ? "accepted"
                                  : i.revoked_at
                                    ? "revoked"
                                    : new Date(i.expires_at) < new Date()
                                      ? "expired"
                                      : "pending"
                              }
                            />
                          </td>
                          <td>
                            {!i.accepted_at && (
                              <>
                                <button
                                  className="platform-btn"
                                  onClick={() =>
                                    submit(() =>
                                      consoleApi(
                                        "/tenant-console/invitations/" +
                                          i.id +
                                          "/resend",
                                        "POST",
                                      ),
                                    )
                                  }
                                >
                                  Resend
                                </button>
                                <button
                                  className="platform-btn danger"
                                  onClick={() =>
                                    submit(() =>
                                      consoleApi(
                                        "/tenant-console/invitations/" + i.id,
                                        "DELETE",
                                      ),
                                    )
                                  }
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <AccountAssignments roles={roles} />
              </>
            )}
            {section === "billing" && data && (
              <article className="platform-card">
                <h2>{data.name}</h2>
                <Badge value={data.status} />
                <p className="platform-muted">
                  Billing: {data.interval}
                  <br />
                  Current period ends:{" "}
                  {data.ends_at
                    ? new Date(data.ends_at).toLocaleDateString()
                    : "Not started"}
                  <br />
                  Renewal:{" "}
                  {data.stripe_subscription
                    ? "Automatic with Stripe"
                    : "Hosted checkout"}
                </p>
                <div className="platform-form">
                  <GatewayPicker
                    gateways={gateways}
                    value={gateway}
                    onChange={setGateway}
                  />
                  <button
                    disabled={busy || !gateway}
                    className="platform-btn primary"
                    onClick={() =>
                      submit(async () => {
                        const r = await consoleApi(
                          "/tenant-console/subscription/checkout",
                          "POST",
                          { gateway_slug: gateway },
                        );
                        location.assign(r.gateway_url);
                        return r;
                      })
                    }
                  >
                    Renew or activate package
                  </button>
                </div>
                <form
                  className="platform-form"
                  style={{ marginTop: 30 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    submit(() =>
                      consoleApi("/tenant-console/subscription", "PATCH", {
                        package_id: f.get("package"),
                        interval: f.get("interval"),
                        cancel_at_period_end: f.get("cancel") === "on",
                      }),
                    );
                  }}
                >
                  <label>
                    Next package
                    <ModernSelect name="package" defaultValue={data.package_id}>
                      {data.packages.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.currency} {p.monthly}/month
                        </option>
                      ))}
                    </ModernSelect>
                  </label>
                  <label>
                    Next billing period
                    <ModernSelect name="interval" defaultValue={data.interval}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </ModernSelect>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      name="cancel"
                      defaultChecked={data.cancel_at_period_end}
                    />
                    Cancel at the end of the current period
                  </label>
                  <p className="platform-muted">
                    Package changes take effect at the next billing boundary,
                    with no proration.
                  </p>
                  <button disabled={busy} className="platform-btn">
                    Schedule changes
                  </button>
                </form>
              </article>
            )}
          </fieldset>
        </>
      )}
    </section>
  );
}
function AccountAssignments({ roles }: { roles: any[] }) {
  const [users, setUsers] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    consoleApi("/user-management")
      .then(setUsers)
      .catch(() => {});
  }, []);
  return (
    <article className="platform-card" style={{ marginTop: 20 }}>
      <h3>Account roles</h3>
      {error && <p className="platform-error">{error}</p>}
      {users
        .filter((u) => u.role !== "admin" && u.role !== "customer")
        .map((u) => (
          <div className="platform-preview-row" key={u.id}>
            <span>{u.useremail}</span>
            <ModernSelect
              aria-label={"Role for " + u.useremail}
              defaultValue={u.customRoleId ?? ""}
              onChange={async (e) => {
                try {
                  await consoleApi("/tenant-console/users/" + u.id, "PATCH", {
                    role_id: e.target.value,
                  });
                  setError("");
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              <option value="">Legacy role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </ModernSelect>
            <button
              className="platform-btn"
              onClick={async () => {
                try {
                  await consoleApi("/tenant-console/users/" + u.id, "PATCH", {
                    role_id: u.customRoleId ?? null,
                    active: u.active === false,
                  });
                  setUsers(
                    users.map((a) =>
                      a.id === u.id ? { ...a, active: a.active === false } : a,
                    ),
                  );
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              {u.active === false ? "Activate" : "Deactivate"}
            </button>
          </div>
        ))}
    </article>
  );
}
export function InvoiceCheckout() {
  const [invoices, setInvoices] = useState<any[]>([]),
    [gateways, setGateways] = useState<any[]>([]),
    [selected, setSelected] = useState(""),
    [gateway, setGateway] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    consoleApi("/payments/invoices")
      .then(setInvoices)
      .catch((e) => setError(e.message));
    consoleApi("/payments/available-gateways")
      .then(setGateways)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="platform-app">
      <section className="platform-card platform-auth">
        <h1>Pay your salon invoice</h1>
        {error && <p className="platform-error">{error}</p>}
        <form
          className="platform-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await consoleApi("/payments/initiate", "POST", {
                source_id: selected,
                gateway_slug: gateway,
              });
              location.assign(r.gateway_url);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <label>
            Outstanding invoice
            <ModernSelect
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose an invoice</option>
              {invoices
                .filter((i) => Number(i.total) > Number(i.paidAmount ?? 0))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} · Balance{" "}
                    {Number(i.total) - Number(i.paidAmount ?? 0)}
                  </option>
                ))}
            </ModernSelect>
          </label>
          <GatewayPicker
            gateways={gateways}
            value={gateway}
            onChange={setGateway}
          />
          <button
            className="platform-btn primary"
            disabled={!gateway || !selected}
          >
            Continue to secure checkout
          </button>
        </form>
      </section>
    </main>
  );
}
