"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useMemo, useCallback } from "react"
import { format } from "date-fns"
import { Loader2, Link2Off } from "lucide-react"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { useDebounce } from "@/hooks/use-debounce"
import { useBiometricSocket } from "@/hooks/use-biometric-socket"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"
import { DashKpiCard, DashKpiGrid } from "@admin/components/dash/kpi-card"
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
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Search, Phone, Pencil, Trash2, User, Fingerprint, Camera, Calendar as CalendarIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  createEmployee,
  getEmployeesFiltered,
  updateEmployee,
  deleteEmployee
} from "@admin/api/employees/employees"
import {
  enrollEmployeeFingerprint,
  removeEmployeeFingerprint,
  getDeviceStatus,
} from "@admin/api/biometric/biometric"
import { CACHE, markStale } from "@admin/lib/cache"
import { toast } from '@/lib/toast'
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatCurrency, getMediaUrl, cn } from "@/lib/utils"
import { EmployeeRole, EmployeeStatus, EmploymentType } from '@/lib/employee-types'
import { formatEmployeeRoleLabel, isArtistEmployeeRole } from "@/lib/employee-roles"
import {
  HEAD_CLASS,
  CELL_CLASS,
  SEARCH_INPUT_CLASS,
  FILTER_TRIGGER,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_EDIT,
  ACTION_DELETE,
} from "@admin/lib/table-styles"







interface Employee {
  id: string
  name: string
  role: EmployeeRole
  customRole?: string | null
  phone: string
  email: string
  salary: number
  commission: number
  shift: string
  experience: number
  joinDate: string
  employmentType: EmploymentType
  fingerprintCode: string | null
  specializations: string[]
  status: EmployeeStatus
  image?: string | null
  about?: string | null
}




export default function EmployeesPage() {
  const PAGE_SIZE = 10

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [fingerprintFilter, setFingerprintFilter] = useState<"all" | "registered" | "not_registered">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: EmployeeRole.OTHER,
    phone: "",
    email: "",
    salary: "0",
    experience: "0",
    joinDate: new Date().toISOString().split('T')[0],
    fingerprintCode: "",
    specializations: [] as string[],
    about: "",
  })

  // Unified employee detail/edit modal
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [modalEditMode, setModalEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState<Employee | null>(null)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [enrollWaiting, setEnrollWaiting] = useState<{
    employeeId: string
    employeeName: string
    deviceUid: string
  } | null>(null)

  // Delete dialog
  const [serviceToDelete, setServiceToDelete] = useState<Employee | null>(null)

  const [joinDatePickerOpen, setJoinDatePickerOpen] = useState(false)
  const [editJoinDatePickerOpen, setEditJoinDatePickerOpen] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [newEmpPhoneError, setNewEmpPhoneError] = useState("")
  const [editEmpPhoneError, setEditEmpPhoneError] = useState("")

  const compressToWebP = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(webpFile);
            }
          }, 'image/webp', 0.95);
        };
      };
    });
  };

  const fetchEmployees = async (silent = false, noCache = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await getEmployeesFiltered(undefined, noCache)
      const list = Array.isArray(data) ? data : []
      const mappedData = list.map((emp: any) => ({
        ...emp,
        specializations: emp.specializations || []
      }))
      setEmployees(mappedData)
    } catch (error) {
      console.error("Failed to fetch employees:", error)
      if (!silent) toast.error("Failed to load employees")
      setEmployees([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees(false, true)
  }, [])

  const filteredEmployees = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return employees.filter((emp) => {
      const matchesSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q)

      const hasFp = Boolean(emp.fingerprintCode)
      const matchesFp =
        fingerprintFilter === "all" ||
        (fingerprintFilter === "registered" && hasFp) ||
        (fingerprintFilter === "not_registered" && !hasFp)

      return matchesSearch && matchesFp
    })
  }, [employees, debouncedSearch, fingerprintFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, fingerprintFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredEmployees, row => String(row.id))
  const paginatedEmployees = cursorTable.data

  const openModal = (employee: Employee, editMode = false) => {
    setSelectedEmployee(employee)
    setEditDraft({ ...employee })
    setEditEmpPhoneError("")
    setModalEditMode(editMode)
    setShowUnlinkConfirm(false)
    setEditImageFile(null)
    setEditImagePreview(null)
  }

  const closeModal = () => {
    setSelectedEmployee(null)
    setEditDraft(null)
    setModalEditMode(false)
    setShowUnlinkConfirm(false)
    setEditImageFile(null)
    setEditImagePreview(null)
  }

  const handleAddEmployee = async () => {
    if (newEmployee.name && newEmployee.role && newEmployee.phone && parseFloat(newEmployee.salary) > 0) {
      try {
        setIsAdding(true)
        const rawPhone = newEmployee.phone.replace(/[\s-]/g, "");
        if (!/^(?:\+88|88)?01[3-9]\d{8}$/.test(rawPhone)) {
          toast.error("Please enter a valid Bangladeshi phone number");
          setIsAdding(false);
          return;
        }
        const cleanPhone = rawPhone;

        const payload: any = {
          name: newEmployee.name.trim(),
          role: newEmployee.role,
          customRole: null,
          phone: cleanPhone,
          salary: parseFloat(newEmployee.salary) || 0,
          commission: 0,
          experience: parseInt(newEmployee.experience) || 0,
          status: EmployeeStatus.ACTIVE,
          employmentType: EmploymentType.FULL_TIME,
        }

        if (newEmployee.email?.trim()) payload.email = newEmployee.email.trim()
        if (newEmployee.joinDate) payload.joinDate = newEmployee.joinDate
        if (newEmployee.fingerprintCode?.trim()) payload.fingerprintCode = newEmployee.fingerprintCode.trim()
        if (newEmployee.about?.trim()) payload.about = newEmployee.about.trim()

        if (newEmployee.specializations.length > 0) payload.specializations = newEmployee.specializations

        const formData = new FormData()
        if (imageFile) {
          const webpFile = await compressToWebP(imageFile)
          formData.append('image', webpFile)
        }
        formData.append('data', JSON.stringify(payload))

        await createEmployee(formData)

        toast.success("Employee added successfully")
        setNewEmployee({
          name: "",
          role: EmployeeRole.OTHER,
          phone: "",
          email: "",
          salary: "0",
          experience: "0",
          joinDate: new Date().toISOString().split('T')[0],
          fingerprintCode: "",
          specializations: [],
          about: "",
        })
        setIsAddDialogOpen(false)
        setNewEmpPhoneError("")
        setImageFile(null)
        setImagePreview(null)
        fetchEmployees()
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to add employee")
      } finally {
        setIsAdding(false)
      }
    }
  }

  const handleEditSave = async () => {
    if (!editDraft) return
    try {
      setIsEditing(true)
      const rawPhone = editDraft.phone.replace(/[\s-]/g, "");
      if (!/^(?:\+88|88)?01[3-9]\d{8}$/.test(rawPhone)) {
        toast.error("Please enter a valid Bangladeshi phone number");
        setIsEditing(false);
        return;
      }
      const cleanPhone = rawPhone;
      const payload = {
        name: editDraft.name,
        role: editDraft.role,
        customRole: editDraft.role === EmployeeRole.OTHER ? (editDraft.customRole?.trim() || null) : null,
        phone: cleanPhone,
        email: editDraft.email || undefined,
        salary: Number(editDraft.salary) || 0,
        commission: Number(editDraft.commission) || 0,
        shift: editDraft.shift || undefined,
        experience: Number(editDraft.experience) || 0,
        joinDate: editDraft.joinDate || undefined,
        status: editDraft.status,
        employmentType: editDraft.employmentType,
        about: editDraft.about || undefined,
        specializations: Array.isArray(editDraft.specializations)
          ? editDraft.specializations
          : (editDraft.specializations as string).split(',').map(s => s.trim()).filter(s => s !== "")
      }

      const formData = new FormData()
      if (editImageFile) {
        const webpFile = await compressToWebP(editImageFile)
        formData.append('image', webpFile)
      }
      formData.append('data', JSON.stringify(payload))

      await updateEmployee(editDraft.id, formData)

      toast.success("Employee updated successfully")
      setSelectedEmployee({ ...editDraft })
      setModalEditMode(false)
      setShowUnlinkConfirm(false)
      setEditImageFile(null)
      setEditImagePreview(null)
      fetchEmployees()
    } catch (error: any) {
      console.error("Failed to update employee:", error)
      toast.error(error?.response?.data?.message || "Failed to update employee")
    } finally {
      setIsEditing(false)
    }
  }

  const handleUnlinkFingerprint = async (employee?: Employee | null) => {
    const target = employee ?? selectedEmployee
    if (!target) return
    try {
      setIsUnlinking(true)
      await removeEmployeeFingerprint(target.id)

      setSelectedEmployee(prev =>
        prev?.id === target.id ? { ...prev, fingerprintCode: null } : prev,
      )
      setEditDraft(prev =>
        prev?.id === target.id ? { ...prev, fingerprintCode: null } : prev,
      )
      setEmployees(prev =>
        prev.map(e => (e.id === target.id ? { ...e, fingerprintCode: null } : e)),
      )
      setShowUnlinkConfirm(false)
      setRemoveConfirmId(null)
      toast.success("Fingerprint removed from employee and ZKTeco device. You can register a new one now.")

      markStale(CACHE.EMPLOYEES, CACHE.EMPLOYEES_BASIC, CACHE.EMPLOYEES_STYLISTS)
      fetchEmployees(true)
    } catch (error: any) {
      console.error("Failed to remove fingerprint:", error)
      toast.error(
        error?.response?.data?.message ||
          "Could not remove fingerprint. Ensure the ZKTeco device is online and try again.",
      )
    } finally {
      setIsUnlinking(false)
    }
  }

  const handleRegisterFingerprint = async (employee: Employee) => {
    try {
      setIsEnrolling(true)
      const status = await getDeviceStatus()
      if (!status.connected) {
        toast.error(
          "ZKTeco device is not connected. Wait until the device shows Connected, then try again.",
        )
        return
      }

      const result = await enrollEmployeeFingerprint(employee.id)
      setEnrollWaiting({
        employeeId: employee.id,
        employeeName: employee.name,
        deviceUid: result.deviceUid,
      })
      toast.success("Opening fingerprint enrollment on the ZKTeco — place your finger when prompted.")
    } catch (error: any) {
      console.error("Failed to start enrollment:", error)
      toast.error(
        error?.response?.data?.message ||
          "Failed to start fingerprint enrollment. Ensure the ZKTeco device is online.",
      )
    } finally {
      setIsEnrolling(false)
    }
  }

  const applyFingerprintLinked = useCallback((employeeId: string, deviceUid: string) => {
    setEmployees(prev =>
      prev.map(e => (e.id === employeeId ? { ...e, fingerprintCode: deviceUid } : e)),
    )
    setSelectedEmployee(prev =>
      prev?.id === employeeId ? { ...prev, fingerprintCode: deviceUid } : prev,
    )
    setEditDraft(prev =>
      prev?.id === employeeId ? { ...prev, fingerprintCode: deviceUid } : prev,
    )
    setEnrollWaiting(prev => (prev?.employeeId === employeeId ? null : prev))
    markStale(CACHE.EMPLOYEES, CACHE.EMPLOYEES_BASIC, CACHE.EMPLOYEES_STYLISTS)
  }, [])

  useBiometricSocket({
    onEnrollmentCompleted: (payload) => {
      applyFingerprintLinked(payload.employeeId, payload.deviceUid)
      toast.success(`Fingerprint linked (UID ${payload.deviceUid})`)
      fetchEmployees(true)
    },
    onEnrollmentStatus: (payload) => {
      if (payload.status === 'failed') {
        setEnrollWaiting(prev => (prev?.employeeId === payload.employeeId ? null : prev))
        toast.error(payload.message || "Fingerprint enrollment failed")
      }
    },
  })

  const handleDelete = async () => {
    if (serviceToDelete) {
      try {
        setIsDeleting(true)
        await deleteEmployee(serviceToDelete.id)
        toast.success("Employee deleted from the system and ZKTeco device.")
        setServiceToDelete(null)
        fetchEmployees()
      } catch (error: any) {
        console.error("Failed to delete employee:", error)
        toast.error(
          error?.response?.data?.message ||
            "Failed to delete employee. If they had a fingerprint, ensure the ZKTeco device is online.",
        )
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case EmployeeStatus.ACTIVE:
        return "rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
      case EmployeeStatus.ON_LEAVE:
        return "rounded-full border border-amber-200 bg-amber-50 text-amber-700"
      case EmployeeStatus.INACTIVE:
        return "rounded-full border border-[#e7e7e7] bg-[#f8fafc] text-[#555]"
      case EmployeeStatus.SUSPENDED:
      case EmployeeStatus.TERMINATED:
        return "rounded-full border border-rose-200 bg-rose-50 text-rose-700"
      default:
        return "rounded-full border border-sky-200 bg-sky-50 text-sky-700"
    }
  }

  const getRoleColor = (role: string) => {
    if (isArtistEmployeeRole(role)) {
      return "border-violet-200 bg-violet-50 text-violet-700"
    }
    switch (role) {
      case EmployeeRole.MANAGER:
        return "border-brand-line bg-brand-soft text-brand-deep"
      case EmployeeRole.RECEPTIONIST:
        return "border-teal-200 bg-teal-50 text-teal-700"
      case EmployeeRole.ASSISTANT:
        return "border-orange-200 bg-orange-50 text-orange-700"
      case EmployeeRole.OTHER:
      default:
        return "border-[#e7e7e7] bg-[#f8fafc] text-[#555]"
    }
  }


  return (
    <>
      <div className={DASH_PAGE}>
        <AdminPageHeader
          title="Employees"
          subtitle="Manage staff profiles, roles, and employment details"
          actions={
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <AdminHeaderPrimaryButton accessAction="create">
                <Plus />
                Add Employee
              </AdminHeaderPrimaryButton>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-scroll-inside="true">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[65vh] pr-4">
                <div className="py-2 space-y-6">

                  {/* Profile Photo */}
                  <div className="flex flex-col items-center gap-1.5 pt-1">
                    <label className="relative cursor-pointer group">
                      <Avatar className="h-24 w-24 ring-2 ring-border">
                        {imagePreview && <AvatarImage src={imagePreview} alt="Preview" className="object-cover" />}
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          <User className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)) }
                        }}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">Click to upload photo</p>
                  </div>

                  {/* Basic Information */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Basic Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>Full Name <span className="text-destructive">*</span></Label>
                        <Input
                          value={newEmployee.name}
                          onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                          placeholder="e.g. Alex Rahman"
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Role <span className="text-destructive">*</span></Label>
                        <Select
                          value={newEmployee.role}
                          onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value as EmployeeRole })}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(EmployeeRole).map(role => (
                              <SelectItem key={role} value={role}>{formatEmployeeRoleLabel(role)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Contact</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Phone <span className="text-destructive">*</span></Label>
                        <Input
                          value={newEmployee.phone}
                          onChange={(e) => {
                            const val = e.target.value
                            setNewEmployee({ ...newEmployee, phone: val })
                            const stripped = val.replace(/[\s-]/g, "")
                            if (val.trim() && !/^(?:\+88|88)?01[3-9]\d{8}$/.test(stripped)) {
                              setNewEmpPhoneError("Enter a valid Bangladeshi phone number (e.g. 01712345678)")
                            } else {
                              setNewEmpPhoneError("")
                            }
                          }}
                          placeholder="e.g. 01712345678"
                          className={`mt-1${newEmpPhoneError ? " border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {newEmpPhoneError && (
                          <p className="text-xs text-destructive mt-1">{newEmpPhoneError}</p>
                        )}
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newEmployee.email}
                          onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                          placeholder="email@example.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Employment */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Employment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Salary (৳) <span className="text-destructive">*</span></Label>
                        <Input placeholder="e.g. 25000"
                          type="number"
                          value={newEmployee.salary}
                          onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Experience (years)</Label>
                        <Input placeholder="e.g. 3"
                          type="number"
                          value={newEmployee.experience}
                          onChange={(e) => setNewEmployee({ ...newEmployee, experience: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Join Date</Label>
                        <Popover open={joinDatePickerOpen} onOpenChange={setJoinDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start px-3 font-normal mt-1"
                             accessAction="create">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span className={newEmployee.joinDate ? "text-foreground" : "text-muted-foreground"}>
                                {newEmployee.joinDate ? format(new Date(`${newEmployee.joinDate}T00:00:00`), "PPP") : "Pick a date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                            <DateCalendar
                              mode="single"
                              selected={newEmployee.joinDate ? new Date(`${newEmployee.joinDate}T00:00:00`) : undefined}
                              onSelect={(selected) => {
                                if (!selected) return
                                setNewEmployee({ ...newEmployee, joinDate: format(selected, "yyyy-MM-dd") })
                                setJoinDatePickerOpen(false)
                              }}
                              autoFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                </div>
              </ScrollArea>
              <DialogFooter className="border-t border-border pt-3">
                <Button onClick={handleAddEmployee} className="w-full" disabled={isAdding} accessAction="create">
                  {isAdding ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding Employee...</>
                  ) : (
                    "Add Employee"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          }
        />

        <DashKpiGrid className="mb-6 xl:grid-cols-3">
          <DashKpiCard title="Matching employees" value={loading ? "..." : filteredEmployees.length} subtitle="Current search and filters" icon={User} />
          <DashKpiCard title="Registered fingerprints" value={loading ? "..." : filteredEmployees.filter((employee) => employee.fingerprintCode).length} subtitle="In matching results" icon={Fingerprint} tone="success" />
          <DashKpiCard title="Awaiting registration" value={loading ? "..." : filteredEmployees.filter((employee) => !employee.fingerprintCode).length} subtitle="In matching results" icon={Link2Off} tone="warning" />
        </DashKpiGrid>
        <div className={TABLE_CARD_CLASS}>
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={SEARCH_INPUT_CLASS}
                />
              </div>
              <Select
                value={fingerprintFilter}
                onValueChange={(v) => setFingerprintFilter(v as "all" | "registered" | "not_registered")}
              >
                <SelectTrigger className={cn(FILTER_TRIGGER, "w-[200px]")}>
                  <SelectValue placeholder="Fingerprint filter" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-sm">All employees</SelectItem>
                  <SelectItem value="not_registered" className="rounded-lg text-sm">Not registered</SelectItem>
                  <SelectItem value="registered" className="rounded-lg text-sm">Registered</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-[#666] whitespace-nowrap">
                {loading ? "Loading..." : `${filteredEmployees.length} results`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table cursorPagination={cursorTable} className="table-fixed w-full min-w-[1180px]">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[17%]" />
                <col className="w-[11%]" />
              </colgroup>
              <TableHeader>
                <TableRow className={TABLE_HEADER_ROW_CLASS}>
                  <TableHead className={HEAD_CLASS}>SL.</TableHead>
                  <TableHead className={HEAD_CLASS}>Employee</TableHead>
                  <TableHead className={HEAD_CLASS}>Role</TableHead>
                  <TableHead className={HEAD_CLASS}>Base Salary</TableHead>
                  <TableHead className={HEAD_CLASS}>Contact</TableHead>
                  <TableHead className={HEAD_CLASS}>Status</TableHead>
                  <TableHead className={HEAD_CLASS}>Device UID</TableHead>
                  <TableHead className={HEAD_CLASS}>Fingerprint Status</TableHead>
                  <TableHead className={HEAD_CLASS}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="px-4 py-10 text-sm text-muted-foreground">
                      Loading employees...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="px-4 py-10 text-sm text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEmployees.map((employee, index) => (
                    <TableRow
                      key={employee.id}
                      className={cn(TABLE_ROW_CLASS, "cursor-pointer")}
                      onClick={() => openModal(employee)}
                    >
                      <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                        {cursorTable.pageInfo.from + index}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9 shrink-0">
                            <AvatarImage src={getMediaUrl(employee.image)} alt={employee.name} className="object-cover" />
                            <AvatarFallback className="bg-brand-soft text-brand-primary">
                              <User className="size-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="flex min-w-0 items-center gap-1.5 font-medium">
                              <span className="truncate">{employee.name}</span>
                              {employee.fingerprintCode ? (
                                <Fingerprint
                                  className="size-3.5 shrink-0 text-emerald-600"
                                  aria-label="Fingerprint linked"
                                />
                              ) : null}
                            </p>
                            <p className="text-[11px] text-[#999]">
                              Since {employee.joinDate}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <span
                          className={cn(
                            "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            getRoleColor(employee.role),
                          )}
                          title={
                            employee.role === EmployeeRole.OTHER
                              ? employee.customRole || employee.role
                              : formatEmployeeRoleLabel(employee.role)
                          }
                        >
                          {employee.role === EmployeeRole.OTHER
                            ? employee.customRole || employee.role
                            : formatEmployeeRoleLabel(employee.role)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums")}>
                        {formatCurrency(employee.salary)}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-[#333]">
                            <Phone className="size-3 shrink-0 text-[#999]" />
                            <span className="truncate">{employee.phone}</span>
                          </div>
                          <p className="truncate text-[11px] text-[#999]">{employee.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 text-[11px] font-semibold",
                            getStatusColor(employee.status)
                          )}
                        >
                          {employee.status}
                        </span>
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "font-mono tabular-nums")}>
                        {employee.fingerprintCode?.trim() ? (
                          <span className="font-medium text-[#333]">{employee.fingerprintCode.trim()}</span>
                        ) : (
                          <span className="text-[#999]">—</span>
                        )}
                      </TableCell>
                      <TableCell className={CELL_CLASS} onClick={(e) => e.stopPropagation()}>
                        {employee.fingerprintCode ? (
                          removeConfirmId === employee.id ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2.5 text-xs"
                                disabled={isUnlinking}
                                onClick={() => setRemoveConfirmId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 px-2.5 text-xs"
                                disabled={isUnlinking}
                                onClick={() => void handleUnlinkFingerprint(employee)}
                               accessAction="edit">
                                {isUnlinking ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2.5 text-xs"
                              disabled={isUnlinking || isEnrolling}
                              onClick={() => setRemoveConfirmId(employee.id)}
                             accessAction="delete">
                              <Fingerprint className="mr-1.5 size-3.5" />
                              Remove Fingerprint
                            </Button>
                          )
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            disabled={isEnrolling}
                            onClick={() => void handleRegisterFingerprint(employee)}
                          >
                            {isEnrolling ? (
                              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                            ) : (
                              <Fingerprint className="mr-1.5 size-3.5" />
                            )}
                            Register Fingerprint
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ACTION_EDIT}
                            aria-label="Edit employee"
                            onClick={(e) => { e.stopPropagation(); openModal(employee, true) }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ACTION_DELETE}
                            aria-label="Delete employee"
                            onClick={(e) => { e.stopPropagation(); setServiceToDelete(employee) }}
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
          {!loading && filteredEmployees.length > 0 && (
            <></>
          )}
        </div>
      </div>

      {/* Unified Employee Detail / Edit Modal */}
      <Dialog open={!!selectedEmployee} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent
          className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden"
          data-scroll-inside="true"
        >
          <DialogHeader>
            <DialogTitle>
              {modalEditMode ? "Edit Employee" : "Employee Details"}
            </DialogTitle>
            {modalEditMode && editDraft && (
              <DialogDescription>
                Update profile, contact, and employment details for {editDraft.name}.
              </DialogDescription>
            )}
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1 pr-3">
            {selectedEmployee && (
              modalEditMode && editDraft ? (
                /* ── EDIT MODE ── */
                <div className="space-y-6 py-5 pb-6">
                  {/* Profile Photo */}
                  <div className="flex flex-col items-center gap-1.5">
                    <label className="relative cursor-pointer group">
                      <Avatar className="h-24 w-24 ring-2 ring-border shadow-sm">
                        <AvatarImage
                          src={editImagePreview ?? getMediaUrl(editDraft.image)}
                          alt={editDraft.name}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          <User className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setEditImageFile(file)
                            setEditImagePreview(URL.createObjectURL(file))
                          }
                        }}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">Click photo to change</p>
                  </div>

                  {/* Basic Information */}
                  <div className="space-y-3">
                    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Basic Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label>Full Name</Label>
                        <Input
                          value={editDraft.name || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          placeholder="e.g. Alex Rahman"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Role</Label>
                        <Select
                          value={editDraft.role}
                          onValueChange={(value) => setEditDraft({ ...editDraft, role: value as EmployeeRole })}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.values(EmployeeRole).map(role => (
                              <SelectItem key={role} value={role}>{formatEmployeeRoleLabel(role)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {editDraft.role === EmployeeRole.OTHER ? (
                        <div className="space-y-1.5">
                          <Label>Custom Role</Label>
                          <Input
                            value={editDraft.customRole || ""}
                            onChange={(e) => setEditDraft({ ...editDraft, customRole: e.target.value })}
                            placeholder="e.g. CEO, Founder"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label>Status</Label>
                          <Select
                            value={editDraft.status}
                            onValueChange={(value) => setEditDraft({ ...editDraft, status: value as EmployeeStatus })}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.values(EmployeeStatus).map(status => (
                                <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {editDraft.role === EmployeeRole.OTHER && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Status</Label>
                          <Select
                            value={editDraft.status}
                            onValueChange={(value) => setEditDraft({ ...editDraft, status: value as EmployeeStatus })}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.values(EmployeeStatus).map(status => (
                                <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>Employment Type</Label>
                        <Select
                          value={editDraft.employmentType}
                          onValueChange={(value) => setEditDraft({ ...editDraft, employmentType: value as EmploymentType })}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.values(EmploymentType).map(type => (
                              <SelectItem key={type} value={type}>{type.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Join Date</Label>
                        <Popover open={editJoinDatePickerOpen} onOpenChange={setEditJoinDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start px-3 font-normal"
                             accessAction="create">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span className={editDraft.joinDate ? "text-foreground" : "text-muted-foreground"}>
                                {editDraft.joinDate ? format(new Date(`${editDraft.joinDate}T00:00:00`), "PPP") : "Pick a date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                            <DateCalendar
                              mode="single"
                              selected={editDraft.joinDate ? new Date(`${editDraft.joinDate}T00:00:00`) : undefined}
                              onSelect={(selected) => {
                                if (!selected) return
                                setEditDraft({ ...editDraft, joinDate: format(selected, "yyyy-MM-dd") })
                                setEditJoinDatePickerOpen(false)
                              }}
                              autoFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label>About</Label>
                        <Input
                          value={editDraft.about || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, about: e.target.value })}
                          placeholder="e.g. A stylist with three years of bridal experience."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-3">
                    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contact
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Phone Number</Label>
                        <Input
                          value={editDraft.phone || ""}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditDraft({ ...editDraft, phone: val })
                            const stripped = val.replace(/[\s-]/g, "")
                            if (val.trim() && !/^(?:\+88|88)?01[3-9]\d{8}$/.test(stripped)) {
                              setEditEmpPhoneError("Enter a valid Bangladeshi phone number (e.g. 01712345678)")
                            } else {
                              setEditEmpPhoneError("")
                            }
                          }}
                          placeholder="e.g. 01712345678"
                          className={editEmpPhoneError ? "border-destructive focus-visible:ring-destructive" : ""}
                        />
                        {editEmpPhoneError && (
                          <p className="mt-1 text-xs text-destructive">{editEmpPhoneError}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editDraft.email || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                          placeholder="email@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Compensation & Schedule */}
                  <div className="space-y-3">
                    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Compensation & Schedule
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Salary (৳)</Label>
                        <Input placeholder="e.g. 25000"
                          type="number"
                          value={editDraft.salary ?? ""}
                          onChange={(e) => setEditDraft({ ...editDraft, salary: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Commission (%)</Label>
                        <Input placeholder="e.g. 10"
                          type="number"
                          value={editDraft.commission ?? ""}
                          onChange={(e) => setEditDraft({ ...editDraft, commission: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Shift</Label>
                        <Input
                          value={editDraft.shift || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, shift: e.target.value })}
                          placeholder="e.g. Morning, Evening"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Experience (years)</Label>
                        <Input placeholder="e.g. 3"
                          type="number"
                          value={editDraft.experience ?? ""}
                          onChange={(e) => setEditDraft({ ...editDraft, experience: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fingerprint */}
                  <div className="space-y-3">
                    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Biometrics
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex size-10 items-center justify-center rounded-full",
                          editDraft.fingerprintCode ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                        )}>
                          <Fingerprint className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Fingerprint</p>
                          {editDraft.fingerprintCode ? (
                            <p className="text-xs text-emerald-700">Linked · UID: {editDraft.fingerprintCode}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Not registered on device</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {editDraft.fingerprintCode ? (
                          showUnlinkConfirm ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Remove from app + device?</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowUnlinkConfirm(false)}
                                disabled={isUnlinking}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleUnlinkFingerprint()}
                                disabled={isUnlinking}
                               accessAction="delete">
                                {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Remove"}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowUnlinkConfirm(true)}
                             accessAction="delete">
                              <Link2Off className="w-3.5 h-3.5 mr-1.5" />
                              Remove
                            </Button>
                          )
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isEnrolling}
                            onClick={() => void handleRegisterFingerprint(editDraft)}
                          >
                            {isEnrolling ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Register Fingerprint
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <div className="space-y-6 py-5 pb-6">
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 px-4 py-4">
                    <Avatar className="h-16 w-16 text-xl ring-2 ring-border">
                      <AvatarImage src={getMediaUrl(selectedEmployee.image)} alt={selectedEmployee.name} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-bold tracking-tight">{selectedEmployee.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedEmployee.role === EmployeeRole.OTHER ? (selectedEmployee.customRole || selectedEmployee.role) : formatEmployeeRoleLabel(selectedEmployee.role)}
                        {" · "}
                        {selectedEmployee.employmentType?.replace(/_/g, " ")}
                      </p>
                      <span className={cn("mt-2 inline-block px-2 py-0.5 text-xs font-semibold", getStatusColor(selectedEmployee.status))}>
                        {selectedEmployee.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contact & Employment
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Phone</Label>
                        <p className="mt-0.5 font-medium">{selectedEmployee.phone || "—"}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="mt-0.5 font-medium break-all">{selectedEmployee.email || "—"}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Salary</Label>
                        <p className="mt-0.5 font-medium">{formatCurrency(selectedEmployee.salary)}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Commission</Label>
                        <p className="mt-0.5 font-medium">{selectedEmployee.commission}%</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Experience</Label>
                        <p className="mt-0.5 font-medium">{selectedEmployee.experience} years</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Join Date</Label>
                        <p className="mt-0.5 font-medium">{selectedEmployee.joinDate || "—"}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3">
                        <Label className="text-muted-foreground">Shift</Label>
                        <p className="mt-0.5 font-medium">{selectedEmployee.shift || "Not set"}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card px-3.5 py-3 sm:col-span-2">
                        <Label className="text-muted-foreground">About</Label>
                        <p className="mt-0.5 text-sm font-medium italic text-foreground/90">
                          {selectedEmployee.about ? `"${selectedEmployee.about}"` : "No bio added yet."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Biometrics
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex size-10 items-center justify-center rounded-full",
                          selectedEmployee.fingerprintCode ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                        )}>
                          <Fingerprint className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Fingerprint</p>
                          {selectedEmployee.fingerprintCode ? (
                            <p className="text-xs text-emerald-700">Linked · UID: {selectedEmployee.fingerprintCode}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Not registered on device</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedEmployee.fingerprintCode ? (
                          showUnlinkConfirm ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Remove from app + device?</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowUnlinkConfirm(false)}
                                disabled={isUnlinking}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleUnlinkFingerprint()}
                                disabled={isUnlinking}
                               accessAction="delete">
                                {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Remove"}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowUnlinkConfirm(true)}
                             accessAction="delete">
                              <Link2Off className="w-3.5 h-3.5 mr-1.5" />
                              Remove Fingerprint
                            </Button>
                          )
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isEnrolling}
                            onClick={() => void handleRegisterFingerprint(selectedEmployee)}
                          >
                            {isEnrolling ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Register Fingerprint
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </ScrollArea>

          <DialogFooter className="shrink-0 gap-2 sm:flex-row">
            {modalEditMode ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setModalEditMode(false)
                    setEditDraft({ ...selectedEmployee! })
                    setShowUnlinkConfirm(false)
                    setEditImageFile(null)
                    setEditImagePreview(null)
                  }}
                  disabled={isEditing}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleEditSave} disabled={isEditing} accessAction="edit">
                  {isEditing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:bg-destructive/10 hover:border-destructive/40"
                  onClick={() => { closeModal(); setServiceToDelete(selectedEmployee!) }}
                 accessAction="delete">
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete
                </Button>
                <Button className="flex-1" onClick={() => setModalEditMode(true)} accessAction="edit">
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!serviceToDelete} onOpenChange={() => setServiceToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Employee</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete <strong>{serviceToDelete?.name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceToDelete(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} accessAction="delete">
              {isDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waiting for device fingerprint scan */}
      <Dialog
        open={!!enrollWaiting}
        onOpenChange={(open) => {
          if (!open) setEnrollWaiting(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-amber-600" />
              Waiting for fingerprint
            </DialogTitle>
            <DialogDescription>
              Enrollment command was sent to the ZKTeco device for{" "}
              <span className="font-medium text-foreground">{enrollWaiting?.employeeName}</span>
              {enrollWaiting?.deviceUid ? (
                <>
                  {" "}
                  (device UID <span className="font-mono">{enrollWaiting.deviceUid}</span>).
                </>
              ) : (
                "."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <p>
              The ZKTeco should open its fingerprint registration screen within a few seconds
              (device PIN <span className="font-mono">{enrollWaiting?.deviceUid}</span>). Place the
              finger when prompted — this page updates automatically when enrollment finishes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollWaiting(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
