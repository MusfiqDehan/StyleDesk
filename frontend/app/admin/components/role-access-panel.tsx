"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Shield } from "lucide-react"
import { toast } from "@/lib/toast"
import {
  getRolePermissions,
  updateRolePermissions,
  type RolePermissionRow,
} from "@admin/api/role-permissions/role-permissions"
import { cn } from "@/lib/utils"
import { PermissionChecklist } from "@admin/components/permission-checklist"
import {
  ROLE_LABELS,
  buildRolePermissionGroups,
  groupPermissionIds,
} from "@admin/lib/permission-catalog"

const DASHBOARD_PERMISSION_IDS = new Set([
  "dashboard",
  "manager-dashboard",
  "staff-dashboard",
  "stylist-dashboard",
])

interface RoleAccessPanelProps {
  canEditManagerRole: boolean
}

export function RoleAccessPanel({ canEditManagerRole }: RoleAccessPanelProps) {
  const editableRoles = useMemo(
    () =>
      canEditManagerRole
        ? (["storeManager", "staff", "stylist"] as const)
        : (["staff", "stylist"] as const),
    [canEditManagerRole],
  )

  const [activeRole, setActiveRole] = useState<string>(editableRoles[0])
  const [rows, setRows] = useState<RolePermissionRow[]>([])
  const [draft, setDraft] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const groups = useMemo(
    () => buildRolePermissionGroups(activeRole, canEditManagerRole),
    [activeRole, canEditManagerRole],
  )
  const groupIds = useMemo(() => groupPermissionIds(groups), [groups])
  const saved = useMemo(
    () => rows.find((r) => r.role === activeRole)?.permissions ?? [],
    [rows, activeRole],
  )
  const dirty = useMemo(() => {
    const a = [...draft].sort().join("|")
    const b = [...saved].sort().join("|")
    return a !== b
  }, [draft, saved])
  const enabledCount = groupIds.filter((id) => draft.includes(id)).length

  const load = async () => {
    setLoading(true)
    try {
      const data = await getRolePermissions()
      setRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const message = err?.response?.data?.message
      toast.error(
        Array.isArray(message) ? message.join(", ") : message || "Failed to load role permissions",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!editableRoles.includes(activeRole as any)) {
      setActiveRole(editableRoles[0])
    }
  }, [editableRoles, activeRole])

  useEffect(() => {
    const row = rows.find((r) => r.role === activeRole)
    setDraft([...(row?.permissions ?? [])])
  }, [rows, activeRole])

  const toggle = (perm: string) => {
    if (!canEditManagerRole && perm === "user-management") return
    setDraft((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    )
  }

  const toggleGroup = (ids: string[], nextChecked: boolean) => {
    setDraft((prev) => {
      if (nextChecked) {
        return [...new Set([...prev, ...ids])]
      }
      return prev.filter((id) => !ids.includes(id))
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const roleDashboardId = groups
        .flatMap((g) => g.items)
        .find((item) => DASHBOARD_PERMISSION_IDS.has(item.id))?.id
      let next = draft.filter(
        (p) => !DASHBOARD_PERMISSION_IDS.has(p) || p === roleDashboardId,
      )
      if (!next.includes("update-password")) {
        next = [...next, "update-password"]
      }
      const result = await updateRolePermissions(activeRole, next)
      toast.success(
        result.message ||
          `Saved ${ROLE_LABELS[activeRole] || activeRole} permissions · ${result.invalidatedSessions} session(s) will re-login`,
      )
      await load()
    } catch (err: any) {
      const message = err?.response?.data?.message
      toast.error(
        Array.isArray(message) ? message.join(", ") : message || "Failed to save permissions",
      )
    } finally {
      setSaving(false)
    }
  }

  const roleName = ROLE_LABELS[activeRole] || activeRole

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <header className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="size-4" />
            </span>
            <h2 className="text-[16px] font-semibold text-foreground">
              What can the {roleName} role open?
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Turn on the areas this role should see in the sidebar. Pages that share one
            permission are grouped so you don&apos;t have to guess.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Button onClick={() => void handleSave()} disabled={saving || loading || !dirty} accessAction="edit">
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save {roleName} access
          </Button>
          <p className="text-right text-[12px] text-muted-foreground">
            {dirty ? "Unsaved changes" : `${enabledCount} of ${groupIds.length} areas on`}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
        {editableRoles.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setActiveRole(role)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeRole === role
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-muted-foreground ring-1 ring-border hover:text-primary hover:ring-primary/30",
            )}
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-2.5 text-[13px] text-amber-900">
        Saving signs out everyone with the {roleName} role so the new access applies on their
        next login.
      </div>

      <div className="px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading permissions…
          </div>
        ) : (
          <PermissionChecklist
            groups={groups}
            selected={draft}
            onToggle={toggle}
            onToggleGroup={toggleGroup}
            disabledIds={canEditManagerRole ? [] : ["user-management"]}
          />
        )}
      </div>
    </section>
  )
}
