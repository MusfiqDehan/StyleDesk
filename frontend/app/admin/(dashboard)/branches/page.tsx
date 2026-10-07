"use client";
import { useEffect, useState } from "react";
import api from "@/app/admin/api/base";
import { selectedBranch, selectBranch } from "@/lib/branch-selection";
import { hasPermission } from "@/app/admin/lib/auth-utils";
import { useAuth } from "@/app/admin/hooks/use-auth";
import { AdminPageHeader } from "@admin/components/admin-page-header";
import { DashPage, DashSpinner } from "@admin/components/dash/page-shell";
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash/kpi-card";
import { Building2, CircleCheck, CirclePause, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TABLE_CARD_CLASS, SEARCH_INPUT_CLASS, FILTER_TRIGGER, HEAD_CLASS, CELL_CLASS } from "@admin/lib/table-styles";
type Branch = { id: string; name: string; slug: string; active: boolean };
export default function BranchesPage() {
  const { user, loading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [fetching, setFetching] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  async function load() {
    setBranches((await api.get("/branches")).data);
  }
  useEffect(() => {
    if (user && hasPermission(user, "branches", "view"))
      load().catch(() => setError("Unable to load branches")).finally(() => setFetching(false));
  }, [user]);
  if (loading) return <DashSpinner />;
  if (!hasPermission(user, "branches", "view"))
    return <p>Branch access required.</p>;
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/branches", { name, slug });
      setName("");
      setSlug("");
      await load();
    } catch {
      setError("Could not create branch. Check the name and unique slug.");
    } finally {
      setSaving(false);
    }
  }
  async function toggle(branch: Branch) {
    setUpdating(branch.id);
    setError("");
    try {
      await api.patch(`/branches/${branch.id}`, { active: !branch.active });
      if (branch.active && selectedBranch() === branch.id) {
        const next = branches.find(
          (item) => item.active && item.id !== branch.id,
        );
        if (next) selectBranch(next.id);
      }
      await load();
    } catch {
      setError("Could not update branch. Keep at least one branch active.");
    } finally {
      setUpdating(null);
    }
  }
  const filtered = branches.filter((branch) =>
    `${branch.name} ${branch.slug}`.toLowerCase().includes(search.toLowerCase()) &&
    (status === "all" || branch.active === (status === "active"))
  );
  return (
    <DashPage className="space-y-6">
      <AdminPageHeader title="Branches" subtitle="Manage your salon locations and their availability." />
      <DashKpiGrid className="xl:grid-cols-3">
        <DashKpiCard title="Matching branches" value={fetching ? "..." : filtered.length} icon={Building2} subtitle="Current search and filters" />
        <DashKpiCard title="Active" value={fetching ? "..." : filtered.filter((branch) => branch.active).length} icon={CircleCheck} tone="success" subtitle="In matching results" />
        <DashKpiCard title="Inactive" value={fetching ? "..." : filtered.filter((branch) => !branch.active).length} icon={CirclePause} tone="warning" subtitle="In matching results" />
      </DashKpiGrid>
      {hasPermission(user, "branches", "create") && (
        <form onSubmit={create} className="flex flex-wrap items-end gap-3 border-b border-brand-line pb-6">
          <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="branch-name">Branch name</Label>
          <Input
            id="branch-name"
            aria-label="Branch name"
            placeholder="e.g. Dhanmondi Studio"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          /></div>
          <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="branch-slug">Branch slug</Label>
          <Input
            id="branch-slug"
            aria-label="Branch slug"
            placeholder="e.g. dhanmondi"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={63}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          /></div>
          <Button type="submit"
            disabled={saving}
          >
            <Plus className="size-4" />{saving ? "Creating..." : "Create branch"}
          </Button>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className={TABLE_CARD_CLASS}>
        <div className="flex flex-wrap items-center gap-3 border-b border-brand-line p-4">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-brand-muted" /><Input aria-label="Search branches" placeholder="Search branches..." value={search} onChange={(event) => setSearch(event.target.value)} className={SEARCH_INPUT_CLASS} /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Branch status" className={FILTER_TRIGGER}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
          <span className="text-xs text-brand-muted">{filtered.length} results</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px]">
          <thead><tr><th className={HEAD_CLASS}>Branch</th><th className={HEAD_CLASS}>Slug</th><th className={HEAD_CLASS}>Status</th><th className={HEAD_CLASS}>Availability</th></tr></thead>
          <tbody>
        {filtered.map((branch) => (
          <tr key={branch.id} className="border-b border-brand-line last:border-0 hover:bg-brand-mist">
            <td className={CELL_CLASS}>{branch.name}</td><td className={CELL_CLASS}>{branch.slug}</td>
            <td className={CELL_CLASS}><span className={branch.active ? "text-emerald-600" : "text-brand-muted"}>{branch.active ? "Active" : "Inactive"}</span></td>
            <td className={CELL_CLASS}>
            {hasPermission(user, "branches", "edit") && (
              <Switch aria-label={`Active status for ${branch.name}`} checked={branch.active} disabled={updating !== null} onCheckedChange={() => toggle(branch)} />
            )}
            </td>
          </tr>
        ))}
          {(fetching || !filtered.length) && <tr><td colSpan={4} className="p-8 text-center text-sm text-brand-muted">{fetching ? "Loading branches..." : "No branches match your filters."}</td></tr>}
          </tbody>
        </table></div>
      </div>
    </DashPage>
  );
}
