"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useMemo } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Pencil, Trash2, Mail, Key, AlertTriangle, Shield, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    HEAD_CLASS,
    CELL_CLASS,
    SEARCH_INPUT_CLASS,
    TABLE_CARD_CLASS,
    TABLE_ROW_CLASS,
    TABLE_HEADER_ROW_CLASS,
    ACTION_EDIT,
    ACTION_DELETE,
} from "@admin/lib/table-styles"
import { TablePagination, TABLE_PAGE_SIZE } from "@admin/components/table-pagination"
import {
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    UserManagement
} from "@admin/api/employee-account/employee-account"
import { logout } from "@admin/api/auth/auth"
import { getBasicEmployees } from "@admin/api/employees/employees"
import { toast } from '@/lib/toast'
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@admin/hooks/use-auth"
import { useRouter } from "next/navigation"
import { hasPermission } from "@admin/lib/auth-utils"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"
import { RoleAccessPanel } from "@admin/components/role-access-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionChecklist } from "@admin/components/permission-checklist"
import {
    ROLE_LABELS,
    buildAccountPermissionGroups,
    permissionLabel,
} from "@admin/lib/permission-catalog"

const ACCOUNT_ROLE_FILTERS = [
    { id: "all", label: "All roles" },
    { id: "admin", label: "Admin" },
    { id: "storeManager", label: "Manager" },
    { id: "staff", label: "Staff" },
    { id: "stylist", label: "Artist" },
    { id: "custom", label: "Custom" },
] as const

export default function EmployeeAccountPage() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [users, setUsers] = useState<UserManagement[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const debouncedSearch = useDebounce(search, 500)
    const [currentPage, setCurrentPage] = useState(1)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [pageTab, setPageTab] = useState("roles")
    const [roleFilter, setRoleFilter] = useState("all")
    const accountPermissionGroups = useMemo(() => buildAccountPermissionGroups(), [])

    const [employees, setEmployees] = useState<any[]>([])
    const [newUser, setNewUser] = useState({
        useremail: "",
        password: "",
        role: "staff",
        permissions: [] as string[],
        employeeId: "none"
    })

    const [userToEdit, setUserToEdit] = useState<UserManagement | null>(null)
    const [userToDelete, setUserToDelete] = useState<UserManagement | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})

    // Self-delete modal state
    const [isSelfDeleteOpen, setIsSelfDeleteOpen] = useState(false)
    const [newAdminEmail, setNewAdminEmail] = useState("")
    const [newAdminPassword, setNewAdminPassword] = useState("")
    const [newAdminErrors, setNewAdminErrors] = useState<Record<string, string>>({})
    const [isSelfDeleteProcessing, setIsSelfDeleteProcessing] = useState(false)

    const fetchUsers = async () => {
        try {
            setLoading(true)

            // Fetch users (with individual error handling)
            try {
                const data = await getAllUsers(true);
                setUsers(data);
            } catch (err) {
                console.error("Failed to fetch users:", err);
                toast.error("Could not load system accounts");
            }

            // Fetch employees (with individual error handling)
            try {
                const empData = await getBasicEmployees();
                setEmployees(empData);
            } catch (err) {
                console.error("Failed to fetch employees:", err);
            }

        } catch (error) {
            console.error("Unexpected error in fetchUsers:", error)
        } finally {
            setLoading(false)
        }
    }

    const canManageAccounts =
        user?.role === "admin" ||
        (user?.role === "custom" && !!user.permissions?.includes("user-management"))
    const canEditRoleTemplates =
        user?.role === "admin" || user?.role === "storeManager"

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission(user, 'user-management')) {
                router.replace('/admin/forbidden')
                return
            }
            if (canManageAccounts) {
                fetchUsers()
            } else {
                setLoading(false)
            }
        }
    }, [user, authLoading, router, canManageAccounts])

    useEffect(() => {
        if (!isAddDialogOpen) return
        getBasicEmployees(true)
            .then(setEmployees)
            .catch(() => setEmployees([]))
    }, [isAddDialogOpen])

    const filteredUsers = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase()
        return users.filter((account) => {
            if (account.role === "customer") return false
            if (roleFilter !== "all" && account.role !== roleFilter) return false
            if (!q) return true
            const name = account.employee?.name?.toLowerCase() ?? ""
            return account.useremail.toLowerCase().includes(q) || name.includes(q)
        })
    }, [users, debouncedSearch, roleFilter])

    useEffect(() => {
        setCurrentPage(1)
    }, [debouncedSearch, roleFilter])

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / TABLE_PAGE_SIZE))
    const cursorTable = useLocalCursor(filteredUsers, row => String(row.id))
  const paginatedUsers = cursorTable.data

    const unlinkedEmployees = useMemo(() => {
        return employees.filter(emp => !users.some(user => user.employeeId === emp.id || user.employee?.id === emp.id))
    }, [employees, users])

    const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users])
    const roleCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const account of users) {
            if (account.role === "customer") continue
            counts[account.role] = (counts[account.role] ?? 0) + 1
        }
        return counts
    }, [users])

    if (authLoading || (!hasPermission(user, 'user-management') && !authLoading)) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    const handleAddUser = async () => {
        const errors: Record<string, string> = {}
        if (!newUser.useremail) errors.useremail = "Email is required"
        else if (!/\S+@\S+\.\S+/.test(newUser.useremail)) errors.useremail = "Invalid email format"

        if (!newUser.password) errors.password = "Password is required"
        else if (newUser.password.length < 6) errors.password = "Password must be at least 6 characters"

        if (!newUser.role) errors.role = "Role is required"
        if (newUser.employeeId === "none") errors.employeeId = "Please link an employee account"

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors)
            return
        }

        try {
            setIsCreating(true)
            setFormErrors({})
            const payload = {
                ...newUser,
                ...(newUser.employeeId && newUser.employeeId !== "none" && { employeeId: newUser.employeeId })
            };
            await createUser(payload)
            toast.success("User account created successfully")
            setNewUser({ useremail: "", password: "", role: "staff", permissions: [], employeeId: "none" })
            setIsAddDialogOpen(false)
            fetchUsers()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to create user")
        } finally {
            setIsCreating(false)
        }
    }

    const handleUpdateSave = async () => {
        if (userToEdit) {
            try {
                const payload = {
                    role: userToEdit.role,
                    permissions: userToEdit.permissions
                }
                await updateUser(userToEdit.id, payload)
                toast.success("User account updated successfully")
                setUserToEdit(null)
                fetchUsers()
            } catch (error: any) {
                toast.error(error.response?.data?.message || "Failed to update user")
            }
        }
    }

    const handleDelete = async () => {
        if (userToDelete) {
            try {
                const deletingSelf = isSelfDelete(userToDelete)
                await deleteUser(userToDelete.id)
                toast.success("User account deleted successfully")
                setUserToDelete(null)

                if (deletingSelf) {
                    // Current admin deleted their own account — clear session and redirect
                    try { await logout() } catch { /* ignore */ }
                    localStorage.removeItem("accessToken")
                    router.replace("/admin/login")
                } else {
                    fetchUsers()
                }
            } catch (error: any) {
                toast.error(error.response?.data?.message || "Failed to delete user")
            }
        }
    }

    // Called from the self-delete modal
    const handleSelfDeleteWithNewAdmin = async () => {
        const errors: Record<string, string> = {}
        if (!newAdminEmail) errors.useremail = "Email is required"
        else if (!/\S+@\S+\.\S+/.test(newAdminEmail)) errors.useremail = "Invalid email format"
        if (!newAdminPassword) errors.password = "Password is required"
        else if (newAdminPassword.length < 6) errors.password = "Minimum 6 characters"
        if (Object.keys(errors).length > 0) { setNewAdminErrors(errors); return }

        setIsSelfDeleteProcessing(true)
        try {
            await createUser({ useremail: newAdminEmail, password: newAdminPassword, role: "admin" })
            await deleteUser(user!.id)
            // Clear session — call server logout then wipe local token
            try { await logout() } catch { /* ignore if already invalid */ }
            localStorage.removeItem("accessToken")
            toast.success("New admin created. You have been logged out.")
            router.replace("/admin/login")
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Something went wrong. Please try again.")
            setIsSelfDeleteProcessing(false)
        }
    }

    const isSelfDelete = (u: UserManagement) => u.id === user?.id

    const getRoleBadge = (role: string) => {
        const label = ROLE_LABELS[role] || role
        const tone: Record<string, string> = {
            admin: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
            storeManager: "bg-primary/10 text-primary ring-1 ring-primary/20",
            staff: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
            stylist: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
            custom: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        }
        return (
            <Badge className={cn("rounded-full border-0 font-medium shadow-none", tone[role] || "bg-muted text-muted-foreground")}>
                {label}
            </Badge>
        )
    }

    const togglePermissionGroup = (ids: string[], nextChecked: boolean, isNew: boolean) => {
        if (isNew) {
            setNewUser((prev) => ({
                ...prev,
                permissions: nextChecked
                    ? [...new Set([...prev.permissions, ...ids])]
                    : prev.permissions.filter((p) => !ids.includes(p)),
            }))
            return
        }
        setUserToEdit((prev) => {
            if (!prev) return null
            const perms = prev.permissions || []
            return {
                ...prev,
                permissions: nextChecked
                    ? [...new Set([...perms, ...ids])]
                    : perms.filter((p) => !ids.includes(p)),
            }
        })
    }

    const accessSummary = (account: UserManagement) => {
        if (account.role === "admin") return "Full access"
        if (account.role === "custom") {
            const count = account.permissions?.length ?? 0
            if (count === 0) return "No extra pages"
            const first = permissionLabel(account.permissions[0])
            return count === 1 ? first : `${first} +${count - 1}`
        }
        return `${ROLE_LABELS[account.role] || account.role} template`
    }

    const togglePermission = (permId: string, isNew: boolean) => {
        if (isNew) {
            setNewUser(prev => ({
                ...prev,
                permissions: prev.permissions.includes(permId)
                    ? prev.permissions.filter(p => p !== permId)
                    : [...prev.permissions, permId]
            }))
        } else if (userToEdit) {
            setUserToEdit(prev => {
                if (!prev) return null
                const perms = prev.permissions || []
                return {
                    ...prev,
                    permissions: perms.includes(permId)
                        ? perms.filter(p => p !== permId)
                        : [...perms, permId]
                }
            })
        }
    }

    const showTabs = canEditRoleTemplates && canManageAccounts

    const accountsPanel = (
        <div className={TABLE_CARD_CLASS}>
            <div className="space-y-3 border-b border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[240px] flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
                        <Input
                            placeholder="Search by name or email…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={SEARCH_INPUT_CLASS}
                        />
                    </div>
                    <span className="text-sm text-[#666] whitespace-nowrap">
                        {loading ? "Loading…" : `${filteredUsers.length} ${filteredUsers.length === 1 ? "account" : "accounts"}`}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {ACCOUNT_ROLE_FILTERS.map((filter) => {
                        const count = filter.id === "all"
                            ? Object.values(roleCounts).reduce((sum, n) => sum + n, 0)
                            : roleCounts[filter.id] ?? 0
                        const active = roleFilter === filter.id
                        return (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setRoleFilter(filter.id)}
                                className={cn(
                                    "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                                    active
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-white text-muted-foreground ring-1 ring-border hover:text-primary hover:ring-primary/30",
                                )}
                            >
                                {filter.label}
                                {!loading && (
                                    <span className={cn("ml-1.5 tabular-nums", active ? "opacity-80" : "opacity-60")}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
            <div className="overflow-x-auto">
                <Table cursorPagination={cursorTable}>
                    <TableHeader>
                        <TableRow className={TABLE_HEADER_ROW_CLASS}>
                            <TableHead className={cn(HEAD_CLASS, "w-14")}>SL.</TableHead>
                            <TableHead className={HEAD_CLASS}>Person</TableHead>
                            <TableHead className={HEAD_CLASS}>Role</TableHead>
                            <TableHead className={HEAD_CLASS}>Access</TableHead>
                            <TableHead className={cn(HEAD_CLASS, "hidden lg:table-cell")}>Created</TableHead>
                            <TableHead className={cn(HEAD_CLASS, "w-[88px]")}>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                                    Loading accounts…
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6} className="px-4 py-12 text-center">
                                    <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                                    <p className="text-sm font-medium text-foreground">No matching accounts</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Try a different name, email, or role filter.
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedUsers.map((account, index) => (
                                <TableRow key={account.id} className={TABLE_ROW_CLASS}>
                                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                                        {cursorTable.pageInfo.from + index}
                                    </TableCell>
                                    <TableCell className={CELL_CLASS}>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">
                                                    {account.employee?.name || account.useremail}
                                                </p>
                                                {account.employee?.name && (
                                                    <p className="truncate text-xs text-muted-foreground">{account.useremail}</p>
                                                )}
                                            </div>
                                            {account.id === user?.id && (
                                                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className={CELL_CLASS}>{getRoleBadge(account.role)}</TableCell>
                                    <TableCell className={CELL_CLASS}>
                                        <p className="text-sm text-foreground">{accessSummary(account)}</p>
                                    </TableCell>
                                    <TableCell className={cn(CELL_CLASS, "hidden text-[#666] lg:table-cell")}>
                                        {new Date(account.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className={CELL_CLASS}>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className={ACTION_EDIT}
                                                aria-label="Edit permissions"
                                                onClick={() => setUserToEdit({ ...account })}
                                            >
                                                <Pencil className="size-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className={ACTION_DELETE}
                                                aria-label="Delete account"
                                                onClick={() => {
                                                    if (isSelfDelete(account)) {
                                                        if (adminCount <= 1) {
                                                            setNewAdminEmail("")
                                                            setNewAdminPassword("")
                                                            setNewAdminErrors({})
                                                            setIsSelfDeleteOpen(true)
                                                        } else {
                                                            setUserToDelete(account)
                                                        }
                                                    } else {
                                                        setUserToDelete(account)
                                                    }
                                                }}
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
            {!loading && filteredUsers.length > 0 && (
                <></>
            )}
        </div>
    )

    return (
        <>
            <div className={DASH_PAGE}>
                <AdminPageHeader
                    title="Roles & Permissions"
                    subtitle="Choose what each role can open, then create logins for your team"
                    actions={
                        canManageAccounts && (!showTabs || pageTab === "accounts") ? (
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <AdminHeaderPrimaryButton accessAction="create">
                                    <Plus />
                                    Create Account
                                </AdminHeaderPrimaryButton>
                            </DialogTrigger>
                        <DialogContent
                            className="max-w-2xl sm:max-w-2xl"
                            data-scroll-inside="true"
                        >
                            <DialogHeader>
                                <DialogTitle>Create a team login</DialogTitle>
                                <p className="text-sm text-muted-foreground">
                                    Link an employee, pick a role, and they can sign in to the dashboard.
                                </p>
                            </DialogHeader>
                            <div className="min-h-0 max-h-[65vh] overflow-y-auto pr-1">
                            <div className="space-y-4 py-4 pb-2">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="min-w-0 space-y-2">
                                        <Label className={formErrors.employeeId ? "text-destructive" : ""}>
                                            Select Employee <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={newUser.employeeId}
                                            onValueChange={(v) => {
                                                setNewUser({ ...newUser, employeeId: v })
                                                if (v !== "none") setFormErrors(prev => {
                                                    const next = { ...prev }
                                                    delete next.employeeId
                                                    return next
                                                })
                                            }}
                                        >
                                            <SelectTrigger className={cn("w-full", formErrors.employeeId && "border-destructive")}>
                                                <SelectValue placeholder="Select Employee..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Select Employee...</SelectItem>
                                                {unlinkedEmployees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {formErrors.employeeId && <p className="text-xs text-destructive">{formErrors.employeeId}</p>}
                                    </div>
                                    <div className="min-w-0 space-y-2">
                                        <Label className={formErrors.role ? "text-destructive" : ""}>
                                            System Role <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={newUser.role}
                                            onValueChange={(v) => {
                                                setNewUser({ ...newUser, role: v })
                                                if (v) setFormErrors(prev => {
                                                    const next = { ...prev }
                                                    delete next.role
                                                    return next
                                                })
                                            }}
                                        >
                                            <SelectTrigger className={cn("w-full", formErrors.role && "border-destructive")}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin (Full Access)</SelectItem>
                                                <SelectItem value="storeManager">Store Manager</SelectItem>
                                                <SelectItem value="staff">Staff</SelectItem>
                                                <SelectItem value="stylist">Artist (Default)</SelectItem>
                                                <SelectItem value="custom">Custom (Select Permissions)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {formErrors.role && <p className="text-xs text-destructive">{formErrors.role}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className={formErrors.useremail ? "text-destructive" : ""}>Email Address <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className={`pl-9 ${formErrors.useremail ? "border-destructive" : ""}`}
                                            placeholder="staff@example.com"
                                            value={newUser.useremail}
                                            onChange={(e) => {
                                                setNewUser({ ...newUser, useremail: e.target.value })
                                                if (e.target.value) setFormErrors(prev => {
                                                    const next = { ...prev }
                                                    delete next.useremail
                                                    return next
                                                })
                                            }}
                                        />
                                    </div>
                                    {formErrors.useremail && <p className="text-xs text-destructive">{formErrors.useremail}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className={formErrors.password ? "text-destructive" : ""}>Initial Password <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="password"
                                            className={`pl-9 ${formErrors.password ? "border-destructive" : ""}`}
                                            placeholder="e.g. Maple!River27 (use your own)"
                                            value={newUser.password}
                                            onChange={(e) => {
                                                setNewUser({ ...newUser, password: e.target.value })
                                                if (e.target.value) setFormErrors(prev => {
                                                    const next = { ...prev }
                                                    delete next.password
                                                    return next
                                                })
                                            }}
                                        />
                                    </div>
                                    {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
                                </div>

                                {newUser.role === "custom" && (
                                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3 pt-2">
                                        <Label>Pages this person can open</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Custom logins ignore the role templates above. Pick each area yourself.
                                        </p>
                                        <PermissionChecklist
                                            groups={accountPermissionGroups}
                                            selected={newUser.permissions}
                                            onToggle={(id) => togglePermission(id, true)}
                                            onToggleGroup={(ids, next) => togglePermissionGroup(ids, next, true)}
                                            compact
                                        />
                                    </div>
                                )}
                            </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddUser} className="w-full" disabled={isCreating} accessAction="create">
                                    {isCreating ? "Creating account…" : "Create account"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                        </Dialog>
                        ) : undefined
                    }
                />

                {showTabs ? (
                    <Tabs value={pageTab} onValueChange={setPageTab} className="space-y-5">
                        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-[#e8e8e8] bg-[#f5f5f5] p-1">
                            <TabsTrigger
                                value="roles"
                                className={cn(
                                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium text-[#555]",
                                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm",
                                )}
                            >
                                <Shield className="size-4 shrink-0" />
                                Role access
                            </TabsTrigger>
                            <TabsTrigger
                                value="accounts"
                                className={cn(
                                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium text-[#555]",
                                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm",
                                )}
                            >
                                <Users className="size-4 shrink-0" />
                                Accounts
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="roles" className="mt-0 outline-none">
                            <RoleAccessPanel canEditManagerRole={user?.role === "admin"} />
                        </TabsContent>
                        <TabsContent value="accounts" className="mt-0 outline-none">
                            {accountsPanel}
                        </TabsContent>
                    </Tabs>
                ) : canEditRoleTemplates ? (
                    <RoleAccessPanel canEditManagerRole={user?.role === "admin"} />
                ) : canManageAccounts ? (
                    accountsPanel
                ) : null}
            </div>

            <Dialog open={!!userToEdit} onOpenChange={() => setUserToEdit(null)}>
                <DialogContent className="max-w-2xl sm:max-w-2xl" data-scroll-inside="true">
                    <DialogHeader>
                        <DialogTitle>Edit team access</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Change this person’s role, or pick custom pages if they need a one-off setup.
                        </p>
                    </DialogHeader>
                    {userToEdit && (
                        <div className="min-h-0 max-h-[65vh] space-y-4 overflow-y-auto py-4 pb-2 pr-1">
                            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
                                <Mail className="h-4 w-4 text-primary" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {userToEdit.employee?.name || userToEdit.useremail}
                                    </p>
                                    {userToEdit.employee?.name && (
                                        <p className="truncate text-xs text-muted-foreground">{userToEdit.useremail}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select
                                    value={userToEdit.role}
                                    onValueChange={(v) => setUserToEdit({ ...userToEdit, role: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin (full access)</SelectItem>
                                        <SelectItem value="storeManager">Store Manager</SelectItem>
                                        <SelectItem value="staff">Staff</SelectItem>
                                        <SelectItem value="stylist">Artist</SelectItem>
                                        <SelectItem value="custom">Custom (select pages)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {userToEdit.role !== "custom" && userToEdit.role !== "admin" && (
                                    <p className="text-xs text-muted-foreground">
                                        Uses the {ROLE_LABELS[userToEdit.role] || userToEdit.role} template from Role access.
                                    </p>
                                )}
                            </div>

                            {userToEdit.role === "custom" && (
                                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                                    <Label>Pages this person can open</Label>
                                    <PermissionChecklist
                                        groups={accountPermissionGroups}
                                        selected={userToEdit.permissions || []}
                                        onToggle={(id) => togglePermission(id, false)}
                                        onToggleGroup={(ids, next) => togglePermissionGroup(ids, next, false)}
                                        compact
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button className="w-full" onClick={handleUpdateSave} accessAction="edit">Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete System Account</DialogTitle></DialogHeader>
                    <div className="py-4 text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-2">
                            <Trash2 className="h-6 w-6" />
                        </div>
                        <p className="text-muted-foreground">
                            Are you sure you want to delete the account for <strong>{userToDelete?.useremail}</strong>?
                            This action will immediately revoke all system access.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setUserToDelete(null)} className="flex-1">Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} className="flex-1" accessAction="delete">Confirm Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Self-Delete Transfer Modal ── */}
            <Dialog open={isSelfDeleteOpen} onOpenChange={(open) => { if (!isSelfDeleteProcessing) setIsSelfDeleteOpen(open) }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Create New Admin First
                        </DialogTitle>
                    </DialogHeader>

                    <p className="text-sm text-muted-foreground">
                        There must always be at least one admin. Enter the credentials for the new admin account, then your account will be deleted.
                    </p>

                    <div className="space-y-3 py-2">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <Label className={newAdminErrors.useremail ? "text-destructive" : ""}>
                                Email Address <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className={`pl-9 ${newAdminErrors.useremail ? "border-destructive" : ""}`}
                                    placeholder="newadmin@example.com"
                                    value={newAdminEmail}
                                    onChange={(e) => {
                                        setNewAdminEmail(e.target.value)
                                        setNewAdminErrors(er => { const n = { ...er }; delete n.useremail; return n })
                                    }}
                                />
                            </div>
                            {newAdminErrors.useremail && <p className="text-xs text-destructive">{newAdminErrors.useremail}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <Label className={newAdminErrors.password ? "text-destructive" : ""}>
                                Password <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    className={`pl-9 ${newAdminErrors.password ? "border-destructive" : ""}`}
                                    placeholder="e.g. Maple!River27 (use your own)"
                                    value={newAdminPassword}
                                    onChange={(e) => {
                                        setNewAdminPassword(e.target.value)
                                        setNewAdminErrors(er => { const n = { ...er }; delete n.password; return n })
                                    }}
                                />
                            </div>
                            {newAdminErrors.password && <p className="text-xs text-destructive">{newAdminErrors.password}</p>}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setIsSelfDeleteOpen(false)}
                            disabled={isSelfDeleteProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={handleSelfDeleteWithNewAdmin}
                            disabled={isSelfDeleteProcessing}
                         accessAction="delete">
                            {isSelfDeleteProcessing ? "Processing…" : "Create Admin & Delete My Account"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
