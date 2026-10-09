"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Fingerprint,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  UserPlus,
  Wifi,
  WifiOff,
} from "lucide-react"
import { toast } from '@/lib/toast'
import { formatEmployeeRoleLabel } from "@/lib/employee-roles"
import { cn } from "@/lib/utils"
import {
  HEAD_CLASS,
  CELL_CLASS,
  FILTER_TRIGGER,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_SECONDARY,
  ACTION_DELETE,
} from "@admin/lib/table-styles"
import {
  getUnlinkedDeviceUsers,
  linkDeviceUser,
  deleteDeviceUser,
  deleteAllDeviceUsers,
  syncDeviceUsers,
  getDeviceStatus,
  type DeviceUser,
} from "@admin/api/biometric/biometric"
import { getBasicEmployees, createEmployee } from "@admin/api/employees/employees"
import { CACHE, markStale } from "@admin/lib/cache"
import { useBiometricSocket } from "@/hooks/use-biometric-socket"
import { StatCard } from "@admin/components/stat-card"
import { TablePagination, TABLE_PAGE_SIZE } from "@admin/components/table-pagination"
import { AdminPageHeader, AdminHeaderSecondaryButton, AdminHeaderDangerButton } from "@admin/components/admin-page-header"

interface BasicEmployee {
  id: string
  name: string
  role?: string
}

export default function DeviceUsersPage() {
  const [deviceUsers, setDeviceUsers] = useState<DeviceUser[]>([])
  const [employees, setEmployees] = useState<BasicEmployee[]>([])
  const [deviceConnected, setDeviceConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceFilter, setDeviceFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  // link dialog
  const [linkTarget, setLinkTarget] = useState<DeviceUser | null>(null)
  const [linkMode, setLinkMode] = useState<"existing" | "create">("existing")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [newEmpName, setNewEmpName] = useState("")
  const [newEmpPhone, setNewEmpPhone] = useState("")
  const [newEmpPhoneError, setNewEmpPhoneError] = useState("")
  const [newEmpRole, setNewEmpRole] = useState("")
  const [isLinking, startLinkTransition] = useTransition()

  // single delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<DeviceUser | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  // delete-all confirmation dialog
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [isDeletingAll, startDeleteAllTransition] = useTransition()

  async function fetchData() {
    setLoading(true)
    try {
      // Sync first so the device's current user list is reflected in the DB
      await syncDeviceUsers()
      const [users, status] = await Promise.all([
        getUnlinkedDeviceUsers(),
        getDeviceStatus(),
      ])
      setDeviceUsers(users)
      setDeviceConnected(status.connected)
    } catch {
      toast.error("Failed to sync with device")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    getBasicEmployees(true)
      .then((list) => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => toast.error("Failed to load employees"))
  }, [])

  // Real-time: when a new fingerprint is pushed from the device via cloud, refresh the list
  const handleNewDeviceUser = useCallback(() => {
    getUnlinkedDeviceUsers()
      .then(setDeviceUsers)
      .catch(() => { })
    getDeviceStatus()
      .then((s) => setDeviceConnected(s.connected))
      .catch(() => { })
  }, [])

  useBiometricSocket({ onNewDeviceUser: handleNewDeviceUser })

  // ── Link ──────────────────────────────────────────────────────────────────

  function openLinkDialog(user: DeviceUser) {
    setLinkTarget(user)
    setLinkMode("existing")
    setSelectedEmployeeId("")
    setNewEmpName("")
    setNewEmpPhone("")
    setNewEmpPhoneError("")
    setNewEmpRole("")
  }

  function handleLink() {
    if (!linkTarget) return
    if (linkMode === "existing" && !selectedEmployeeId) return
    if (linkMode === "create" && (!newEmpName.trim() || !newEmpPhone.trim())) return

    startLinkTransition(async () => {
      try {
        let employeeId = selectedEmployeeId
        let employeeName: string | undefined

        if (linkMode === "create") {
          const created = await createEmployee({
            name: newEmpName.trim(),
            phone: newEmpPhone.trim(),
            ...(newEmpRole ? { role: newEmpRole } : {}),
          })
          employeeId = created.id
          employeeName = created.name
          setEmployees((prev) => [...prev, { id: created.id, name: created.name, role: created.role }])
        } else {
          employeeName = employees.find((e) => e.id === selectedEmployeeId)?.name
        }

        await linkDeviceUser(linkTarget.deviceUid, employeeId)
        markStale(CACHE.EMPLOYEES, CACHE.EMPLOYEES_BASIC, CACHE.EMPLOYEES_STYLISTS)
        toast.success(`Linked to ${employeeName ?? "employee"} successfully`)
        setLinkTarget(null)
        setDeviceUsers((prev) => prev.filter((u) => u.deviceUid !== linkTarget.deviceUid))
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Link failed")
      }
    })
  }

  // ── Delete all ────────────────────────────────────────────────────────────

  function handleDeleteAll() {
    startDeleteAllTransition(async () => {
      try {
        const { deleted, failed } = await deleteAllDeviceUsers()
        setDeviceUsers([])
        setDeleteAllOpen(false)
        if (failed === 0) {
          toast.success(`${deleted} device user${deleted !== 1 ? "s" : ""} deleted`)
        } else {
          toast.warning(`${deleted} deleted, ${failed} failed — device may be unreachable`)
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Delete all failed")
      }
    })
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!deleteTarget) return
    startDeleteTransition(async () => {
      try {
        await deleteDeviceUser(deleteTarget.deviceUid)
        toast.success(`User ${deleteTarget.name ?? deleteTarget.deviceUid} deleted from device and database`)
        setDeleteTarget(null)
        setDeviceUsers((prev) => prev.filter((u) => u.deviceUid !== deleteTarget.deviceUid))
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Delete failed")
      }
    })
  }

  const deviceOptions = Array.from(
    new Set(deviceUsers.map((u) => u.deviceSerial).filter((sn): sn is string => !!sn)),
  ).sort((a, b) => a.localeCompare(b))

  const filteredUsers =
    deviceFilter === "all"
      ? deviceUsers
      : deviceUsers.filter((u) => u.deviceSerial === deviceFilter)

  useEffect(() => {
    setCurrentPage(1)
  }, [deviceFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / TABLE_PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredUsers, row => String(row.id))
  const paginatedUsers = cursorTable.data

  return (
    <div className={`${DASH_PAGE} space-y-6`}>

      <AdminPageHeader
        title="Unlinked Users"
        subtitle="Link biometric device users to employee profiles"
        actions={
          <>
            {deviceConnected !== null && (
              <Badge
                variant="outline"
                className={
                  deviceConnected
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-red-300 bg-red-50 text-red-600"
                }
              >
                {deviceConnected ? (
                  <>
                    <Wifi className="mr-1 h-3 w-3" />
                    Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="mr-1 h-3 w-3" />
                    Disconnected
                  </>
                )}
              </Badge>
            )}
            <AdminHeaderSecondaryButton onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Refresh
            </AdminHeaderSecondaryButton>
            <AdminHeaderDangerButton
              onClick={() => setDeleteAllOpen(true)}
              disabled={loading || deviceUsers.length === 0}
             accessAction="delete">
              <Trash2 />
              Delete All
            </AdminHeaderDangerButton>
          </>
        }
      />

      {/* ── Stats card ──────────────────────────────────────────────────── */}
      <div className="max-w-sm">
        <StatCard
          title="Unlinked Device Users"
          value={loading ? "—" : deviceUsers.length}
          icon={Fingerprint}
          iconWrapperClassName="bg-amber-50 text-amber-500"
          className="border-t-4 border-t-transparent hover:border-t-amber-500 transition-all"
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={TABLE_CARD_CLASS}>
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            {deviceOptions.length > 0 && (
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className={cn(FILTER_TRIGGER, "w-[200px]")}>
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-sm">All devices</SelectItem>
                  {deviceOptions.map((sn) => (
                    <SelectItem key={sn} value={sn} className="rounded-lg text-sm">
                      {sn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-sm text-[#666] whitespace-nowrap">
              {loading ? "Loading..." : `${filteredUsers.length} results`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table cursorPagination={cursorTable} className="table-fixed min-w-[900px]">
            <colgroup>
              <col className="w-[56px]" />
              <col className="w-[120px]" />
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
            </colgroup>
            <TableHeader>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead className={HEAD_CLASS}>SL.</TableHead>
                <TableHead className={HEAD_CLASS}>Device UID</TableHead>
                <TableHead className={HEAD_CLASS}>Device (SN)</TableHead>
                <TableHead className={HEAD_CLASS}>Name on Device</TableHead>
                <TableHead className={HEAD_CLASS}>Detected On</TableHead>
                <TableHead className={HEAD_CLASS}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-4 py-10 text-sm text-muted-foreground">
                    Loading unlinked users…
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-4 py-10 text-sm text-muted-foreground">
                    {deviceFilter === "all"
                      ? "All device users are linked."
                      : "No unlinked users for this device."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user, index) => (
                  <TableRow key={user.deviceUid} className={TABLE_ROW_CLASS}>
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <span className="inline-flex rounded-full border border-[#e7e7e7] bg-[#f8fafc] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#555]">
                        {user.deviceUid}
                      </span>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      {user.deviceSerial ? (
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-700">
                          {user.deviceSerial}
                        </span>
                      ) : (
                        <span className="text-[12px] italic text-[#888]">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      {user.name ? (
                        <span className="font-medium" title={user.name}>{user.name}</span>
                      ) : (
                        <span className="text-[12px] italic text-[#888]">No name set</span>
                      )}
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "text-[#666]")}>
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_SECONDARY}
                          aria-label="Link employee"
                          title="Link employee"
                          onClick={() => openLinkDialog(user)}
                        >
                          <Link2 className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_DELETE}
                          aria-label="Delete device user"
                          title="Delete"
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {!loading && (
          <></>
        )}
      </div>

      {/* ── Link dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={!!linkTarget}
        onOpenChange={(open) => {
          if (!open && !isLinking) setLinkTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Link to Employee</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  Device UID:{" "}
                  <Badge variant="outline" className="font-mono text-xs">
                    {linkTarget?.deviceUid}
                  </Badge>
                  {linkTarget?.name && (
                    <span className="ml-2 text-muted-foreground">· {linkTarget.name}</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={linkMode} onValueChange={(v) => setLinkMode(v as "existing" | "create")} className="mt-3 pb-2">
            <TabsList className="w-full">
              <TabsTrigger value="existing" className="flex-1">
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Existing Employee
              </TabsTrigger>
              <TabsTrigger value="create" className="flex-1">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Create New Employee
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="mt-3 space-y-1.5">
              <Label htmlFor="emp-select">Select employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger id="emp-select">
                  <SelectValue placeholder="Choose employee…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <SelectItem value="__loading" disabled>
                      Loading…
                    </SelectItem>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                        {emp.role && (
                          <span className="ml-2 text-xs text-muted-foreground">· {emp.role}</span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="create" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-emp-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="new-emp-name"
                  placeholder="e.g. Riya Akter"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-emp-phone">Phone <span className="text-destructive">*</span></Label>
                <Input
                  id="new-emp-phone"
                  placeholder="e.g. 01712345678"
                  value={newEmpPhone}
                  onChange={(e) => {
                    const val = e.target.value
                    setNewEmpPhone(val)
                    const stripped = val.replace(/[\s-]/g, "")
                    if (val.trim() && !/^(?:\+88|88)?01[3-9]\d{8}$/.test(stripped)) {
                      setNewEmpPhoneError("Enter a valid Bangladeshi phone number (e.g. 01712345678)")
                    } else {
                      setNewEmpPhoneError("")
                    }
                  }}
                  className={newEmpPhoneError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {newEmpPhoneError && (
                  <p className="text-xs text-destructive">{newEmpPhoneError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-emp-role">Role <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={newEmpRole} onValueChange={setNewEmpRole}>
                  <SelectTrigger id="new-emp-role">
                    <SelectValue placeholder="Select role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Stylist", "Manager", "Receptionist", "Assistant", "Other"].map((r) => (
                      <SelectItem key={r} value={r}>{formatEmployeeRoleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setLinkTarget(null)}
              disabled={isLinking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={
                isLinking ||
                (linkMode === "existing" && !selectedEmployeeId) ||
                (linkMode === "create" && (!newEmpName.trim() || !newEmpPhone.trim() || !!newEmpPhoneError))
              }
             accessAction="create">
              {isLinking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : linkMode === "create" ? (
                <UserPlus className="mr-2 h-4 w-4" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {linkMode === "create" ? "Create & Link" : "Confirm Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete-all confirmation dialog ──────────────────────────────── */}
      <Dialog
        open={deleteAllOpen}
        onOpenChange={(open) => {
          if (!open && !isDeletingAll) setDeleteAllOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Delete All Device Users</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  {deviceUsers.length} unlinked user{deviceUsers.length !== 1 ? "s" : ""} will be removed
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <p className="mt-2 text-sm text-muted-foreground">
            This will permanently remove all{" "}
            <span className="font-medium text-foreground">{deviceUsers.length} unlinked</span>{" "}
            users from the ZKTeco device and the database. Their fingerprint data on the device
            will be erased. This cannot be undone.
          </p>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setDeleteAllOpen(false)}
              disabled={isDeletingAll}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
             accessAction="delete">
              {isDeletingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Delete Device User</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  UID:{" "}
                  <Badge variant="outline" className="font-mono text-xs">
                    {deleteTarget?.deviceUid}
                  </Badge>
                  {deleteTarget?.name && (
                    <span className="ml-2 text-muted-foreground">· {deleteTarget.name}</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <p className="mt-2 text-sm text-muted-foreground">
            This will permanently remove the user from the{" "}
            <span className="font-medium text-foreground">ZKTeco device</span> and from the
            database. Their fingerprint data on the device will be erased. This cannot be undone.
          </p>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
             accessAction="delete">
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete from Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
