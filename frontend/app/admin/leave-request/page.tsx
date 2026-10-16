"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useRemoteCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { DashboardLayout } from "@admin/components/dashboard-layout"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, CheckCircle, XCircle, Search, Trash2, Calendar as CalendarIcon } from "lucide-react"
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from '@/lib/toast'
import { useAuth } from "@admin/hooks/use-auth"
import {
    getLeaveRequests,
    createLeaveRequest,
    updateLeaveRequestStatus,
    deleteLeaveRequest,
    LeaveRequest
} from "@admin/api/leave-request/leave-request"
import { getBasicEmployees } from "@admin/api/employees/employees"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"

export default function LeaveRequestsPage() {
    const { user } = useAuth()
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null)
    const [startDateOpen, setStartDateOpen] = useState(false)
    const [endDateOpen, setEndDateOpen] = useState(false)

    // Form state
    const [newRequest, setNewRequest] = useState({
        employeeId: "",
        leaveType: "casual",
        startDate: "",
        endDate: "",
        reason: ""
    })

    const isPrivileged = user?.role === 'admin' || user?.role === 'storeManager' ||
        (user?.role === 'custom' && user?.permissions?.includes('leave-request'))

    const fetchData = async () => {
        try {
            setLoading(true)
            const responseData = await getLeaveRequests(true)
            // Safely handle both array and object { data: [] } response formats from the backend
            setRequests(responseData)

            if (isPrivileged) {
                const empData = await getBasicEmployees(true)
                // Safely handle employee response format too
                setEmployees(empData)
            }
        } catch (error) {
            console.error("Failed to fetch leave requests:", error)
            toast.error("Failed to load leave requests")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user) {
            fetchData()
        }
    }, [user])

    const filteredRequests = useMemo(() => {
        if (!Array.isArray(requests)) return []

        return requests.filter((req) => {
            const matchesName = req.employeeName ? req.employeeName.toLowerCase().includes(search.toLowerCase()) : false
            const matchesReason = req.reason ? req.reason.toLowerCase().includes(search.toLowerCase()) : false
            const matchesType = req.leaveType ? req.leaveType.toLowerCase().includes(search.toLowerCase()) : false
            return matchesName || matchesReason || matchesType
        })
    }, [requests, search])

    useEffect(() => {
        setCurrentPage(1)
    }, [search])

    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / TABLE_PAGE_SIZE))
    const cursorTable = useRemoteCursor<any>('/leave-request', { _search: search })
  const paginatedRequests = cursorTable.data
  useEffect(() => { cursorTable.refresh() }, [requests, cursorTable.refresh])

    const handleCreateRequest = async () => {
        if (!newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
            toast.error("Please fill in all required fields")
            return
        }

        if (isPrivileged && !newRequest.employeeId) {
            toast.error("Please select an employee")
            return
        }

        try {
            const payload = {
                leaveType: newRequest.leaveType,
                startDate: newRequest.startDate,
                endDate: newRequest.endDate,
                reason: newRequest.reason,
                ...(isPrivileged && { employeeId: newRequest.employeeId })
            }

            await createLeaveRequest(payload)
            toast.success("Leave request submitted successfully")
            setNewRequest({ employeeId: "", leaveType: "casual", startDate: "", endDate: "", reason: "" })
            setIsAddDialogOpen(false)
            fetchData()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to submit request")
        }
    }

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await updateLeaveRequestStatus(id, status)
            toast.success(`Request ${status} successfully`)
            fetchData()
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Failed to update status`)
        }
    }

    const handleDelete = async () => {
        if (requestToDelete) {
            try {
                await deleteLeaveRequest(requestToDelete.id)
                toast.success("Leave request deleted successfully")
                setRequestToDelete(null)
                fetchData()
            } catch (error: any) {
                toast.error(error.response?.data?.message || "Failed to delete request")
            }
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>
            case "rejected":
                return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>
            default:
                return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>
        }
    }

    const getTypeBadge = (type: string) => {
        switch (type) {
            case "casual":
                return <Badge variant="outline" className="border-brand-line text-brand-deep">Casual</Badge>
            case "annual":
                return <Badge variant="outline" className="border-purple-200 text-purple-700">Annual</Badge>
            case "emergency":
                return <Badge variant="outline" className="border-red-200 text-red-700">Emergency</Badge>
            default:
                return <Badge variant="outline">{type}</Badge>
        }
    }

    return (
        <DashboardLayout>
            <div className={DASH_PAGE}>
                <AdminPageHeader
                    title="Leave Requests"
                    subtitle="Submit and manage employee leave requests"
                    actions={
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <AdminHeaderPrimaryButton>
                                    <Plus />
                                    {isPrivileged ? "Submit Leave Request (On Behalf)" : "Request Leave"}
                                </AdminHeaderPrimaryButton>
                            </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>{isPrivileged ? "Submit Leave Request" : "Request Time Off"}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4 pb-32">
                                {isPrivileged && (
                                    <div className="space-y-2">
                                        <Label>Employee</Label>
                                        <Select
                                            value={newRequest.employeeId}
                                            onValueChange={(v) => setNewRequest({ ...newRequest, employeeId: v })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                                            <SelectContent>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Leave Type</Label>
                                    <Select
                                        value={newRequest.leaveType}
                                        onValueChange={(v) => setNewRequest({ ...newRequest, leaveType: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="casual">Casual Leave</SelectItem>
                                            <SelectItem value="annual">Annual Leave</SelectItem>
                                            <SelectItem value="emergency">Emergency Leave</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    <span className={newRequest.startDate ? "text-foreground" : "text-muted-foreground"}>
                                                        {newRequest.startDate ? format(new Date(`${newRequest.startDate}T00:00:00`), "PPP") : "Pick a date"}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                                                <DateCalendar
                                                    mode="single"
                                                    selected={newRequest.startDate ? new Date(`${newRequest.startDate}T00:00:00`) : undefined}
                                                    onSelect={(selected) => {
                                                        if (!selected) return
                                                        setNewRequest({ ...newRequest, startDate: format(selected, "yyyy-MM-dd") })
                                                        setStartDateOpen(false)
                                                    }}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    <span className={newRequest.endDate ? "text-foreground" : "text-muted-foreground"}>
                                                        {newRequest.endDate ? format(new Date(`${newRequest.endDate}T00:00:00`), "PPP") : "Pick a date"}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                                                <DateCalendar
                                                    mode="single"
                                                    selected={newRequest.endDate ? new Date(`${newRequest.endDate}T00:00:00`) : undefined}
                                                    onSelect={(selected) => {
                                                        if (!selected) return
                                                        setNewRequest({ ...newRequest, endDate: format(selected, "yyyy-MM-dd") })
                                                        setEndDateOpen(false)
                                                    }}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="space-y-2 max-w-full">
                                    <Label>Reason for Leave</Label>
                                    <Textarea
                                        placeholder="e.g. Family appointment on Monday"
                                        className="resize-none w-full break-all"
                                        rows={3}
                                        value={newRequest.reason}
                                        onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateRequest} className="w-full">Submit Request</Button>
                            </DialogFooter>
                        </DialogContent>
                        </Dialog>
                    }
                />

                <div className={TABLE_CARD_CLASS}>
                    <div className="border-b border-border p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative min-w-[240px] flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
                                <Input
                                    placeholder="Search requests..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className={SEARCH_INPUT_CLASS}
                                />
                            </div>
                            <span className="text-sm text-[#666] whitespace-nowrap">
                                {loading ? "Loading..." : `${filteredRequests.length} results`}
                            </span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table cursorPagination={cursorTable} className="table-fixed min-w-[920px]">
                            <TableHeader>
                                <TableRow className={TABLE_HEADER_ROW_CLASS}>
                                    <TableHead className={cn(HEAD_CLASS, "w-[56px]")}>SL.</TableHead>
                                    {isPrivileged && <TableHead className={HEAD_CLASS}>Employee</TableHead>}
                                    <TableHead className={HEAD_CLASS}>Leave Type</TableHead>
                                    <TableHead className={HEAD_CLASS}>Duration</TableHead>
                                    <TableHead className={HEAD_CLASS}>Reason</TableHead>
                                    <TableHead className={HEAD_CLASS}>Status</TableHead>
                                    {isPrivileged && <TableHead className={HEAD_CLASS}>Action</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={isPrivileged ? 7 : 5} className="px-4 py-10 text-sm text-muted-foreground text-center">
                                            Loading requests...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredRequests.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={isPrivileged ? 7 : 5} className="px-4 py-10 text-sm text-muted-foreground text-center">
                                            No leave requests found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRequests.map((req, index) => (
                                        <TableRow key={req.id} className={TABLE_ROW_CLASS}>
                                            <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                                                {cursorTable.pageInfo.from + index}
                                            </TableCell>
                                            {isPrivileged && (
                                                <TableCell className={cn(CELL_CLASS, "font-medium")}>
                                                    {req.employeeName || "Unknown"}
                                                </TableCell>
                                            )}
                                            <TableCell className={CELL_CLASS}>
                                                {getTypeBadge(req.leaveType)}
                                            </TableCell>
                                            <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                                                {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className={CELL_CLASS}>
                                                <span className="block max-w-[200px] truncate text-[#666]" title={req.reason}>
                                                    {req.reason}
                                                </span>
                                            </TableCell>
                                            <TableCell className={CELL_CLASS}>
                                                {getStatusBadge(req.status)}
                                            </TableCell>
                                            {isPrivileged && (
                                                <TableCell className={CELL_CLASS}>
                                                    <div className="flex items-center gap-1">
                                                        {req.status === 'pending' && (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={ACTION_EDIT}
                                                                    aria-label="Approve request"
                                                                    onClick={() => handleUpdateStatus(req.id, 'approved')}
                                                                >
                                                                    <CheckCircle className="size-3.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="size-8 rounded-lg bg-[#fffbeb] text-[#d97706] hover:bg-[#d97706] hover:text-white"
                                                                    aria-label="Reject request"
                                                                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                                >
                                                                    <XCircle className="size-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className={ACTION_DELETE}
                                                            aria-label="Delete request"
                                                            onClick={() => setRequestToDelete(req)}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
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
            </div>

            {/* Delete Dialog */}
            <Dialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Leave Request</DialogTitle></DialogHeader>
                    <div className="py-4 text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-2">
                            <Trash2 className="h-6 w-6" />
                        </div>
                        <p className="text-muted-foreground">
                            Are you sure you want to delete this leave request? This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setRequestToDelete(null)} className="flex-1">Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} className="flex-1">Confirm Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
