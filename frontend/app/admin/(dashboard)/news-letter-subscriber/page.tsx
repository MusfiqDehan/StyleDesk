"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { CursorPagination } from "@/components/pagination/cursor-pagination"
import { useRemoteCursor } from "@/lib/pagination/use-cursor"

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
  Plus,
  Search,
  Trash2,
  Mail,
  Loader2,
} from "lucide-react"
import {
  getSubscribers,
  createSubscriber,
  deleteSubscriber,
  NewsLetterSubscriber
} from "@admin/api/news-letter-subscriber/news-letter-subscriber"
import { toast } from '@/lib/toast'
import { cn } from "@/lib/utils"
import { useAuth } from "@admin/hooks/use-auth"
import { useRouter } from "next/navigation"
import { hasPermission } from "@admin/lib/auth-utils"
import {
  HEAD_CLASS,
  CELL_CLASS,
  SEARCH_INPUT_CLASS,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_DELETE,
} from "@admin/lib/table-styles"
import { TablePagination, TABLE_PAGE_SIZE } from "@admin/components/table-pagination"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"

export default function NewsLetterSubscribersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [subscribers, setSubscribers] = useState<NewsLetterSubscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [currentPage, setCurrentPage] = useState(1)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [newEmail, setNewEmail] = useState("")
  const [subscriberToDelete, setSubscriberToDelete] = useState<NewsLetterSubscriber | null>(null)

  const fetchSubscribers = async () => {
    try {
      setLoading(true)
      const data = await getSubscribers()
      setSubscribers(data)
    } catch (error) {
      console.error("Failed to fetch subscribers:", error)
      toast.error("Failed to load subscribers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission(user, 'news-letter-subscriber')) {
        router.replace('/admin/appointments')
        return
      }
      fetchSubscribers()
    }
  }, [user, authLoading, router])

  const filteredSubscribers = useMemo(() => {
    return Array.isArray(subscribers) ? subscribers.filter(
      (s) => s.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    ) : []
  }, [subscribers, debouncedSearch])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filteredSubscribers.length / TABLE_PAGE_SIZE))
  const cursorTable = useRemoteCursor<any>('/news-letter-subscriber', { _search: debouncedSearch })
  const paginatedSubscribers = cursorTable.data
  useEffect(() => { cursorTable.refresh() }, [subscribers, cursorTable.refresh])

  const handleAddSubscriber = async () => {
    if (!newEmail) {
      toast.error("Please enter a valid email address")
      return
    }

    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      toast.error("Invalid email format")
      return
    }

    try {
      setSubmitting(true)
      await createSubscriber({ email: newEmail })
      toast.success("Subscriber added successfully")
      setNewEmail("")
      setIsAddDialogOpen(false)
      fetchSubscribers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add subscriber")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSubscriber = async () => {
    if (subscriberToDelete) {
      try {
        setSubmitting(true)
        await deleteSubscriber(subscriberToDelete.id)
        toast.success("Subscriber removed successfully")
        setSubscriberToDelete(null)
        fetchSubscribers()
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to delete subscriber")
      } finally {
        setSubmitting(false)
      }
    }
  }

  if (authLoading || (!hasPermission(user, 'news-letter-subscriber') && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        title="Newsletter Subscribers"
        subtitle="Manage email subscribers for salon newsletters"
        actions={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <AdminHeaderPrimaryButton accessAction="create">
                <Plus />
                Add Subscriber
              </AdminHeaderPrimaryButton>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Subscriber</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 pb-2">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input 
                  type="email"
                  placeholder="e.g. customer@example.com" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddSubscriber} className="w-full" disabled={submitting} accessAction="create">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Email
              </Button>
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
                placeholder="Search subscribers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={SEARCH_INPUT_CLASS}
              />
            </div>
            <span className="text-sm text-[#666] whitespace-nowrap">
              {loading ? "Loading..." : `${filteredSubscribers.length} results`}
            </span>
          </div>
        </div>
        {/* Mobile cards */}
        <div className="space-y-3 p-3 sm:hidden">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
          ) : filteredSubscribers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No subscribers found.</p>
          ) : (
            paginatedSubscribers.map((s, index) => (
              <div key={s.id} className="rounded-lg border border-[#f2f2f2] bg-[#fafafa] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[#999]">
                      #{cursorTable.pageInfo.from + index}
                    </p>
                    <p className="mt-1 break-all text-[14px] font-medium text-[#333]">
                      <span className="inline-flex items-start gap-2">
                        <Mail className="mt-0.5 size-3.5 shrink-0 text-[#999]" />
                        <span className="min-w-0">{s.email}</span>
                      </span>
                    </p>
                    <p className="mt-2 text-[12px] text-[#666]">
                      Subscribed{" "}
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(ACTION_DELETE, "shrink-0")}
                    aria-label="Remove subscriber"
                    onClick={() => setSubscriberToDelete(s)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        <CursorPagination pageInfo={cursorTable.pageInfo} onCursorChange={cursorTable.onCursorChange} loading={cursorTable.loading} error={cursorTable.error} retry={cursorTable.refresh} /></div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <Table cursorPagination={cursorTable} className="table-fixed min-w-[640px]">
            <colgroup>
              <col className="w-[56px]" />
              <col />
              <col className="w-[180px]" />
              <col className="w-[88px]" />
            </colgroup>
            <TableHeader>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead className={HEAD_CLASS}>SL.</TableHead>
                <TableHead className={HEAD_CLASS}>Email Address</TableHead>
                <TableHead className={HEAD_CLASS}>Subscription Date</TableHead>
                <TableHead className={HEAD_CLASS}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredSubscribers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No subscribers found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSubscribers.map((s, index) => (
                  <TableRow key={s.id} className={TABLE_ROW_CLASS}>
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "max-w-0 font-medium")}>
                      <span className="inline-flex max-w-full items-center gap-2">
                        <Mail className="size-3.5 shrink-0 text-[#999]" />
                        <span className="truncate">{s.email}</span>
                      </span>
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "whitespace-nowrap text-[#666]")}>
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={ACTION_DELETE}
                        aria-label="Remove subscriber"
                        onClick={() => setSubscriberToDelete(s)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!subscriberToDelete} onOpenChange={() => setSubscriberToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unsubscribe Email</DialogTitle></DialogHeader>
          <p className="py-4 text-muted-foreground">Are you sure you want to remove <strong>{subscriberToDelete?.email}</strong> from the newsletter subscribers list?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscriberToDelete(null)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSubscriber} disabled={submitting} accessAction="delete">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
