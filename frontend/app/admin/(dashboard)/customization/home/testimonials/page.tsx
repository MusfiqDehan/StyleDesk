"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  ImagePlus,
  X,
} from "lucide-react"
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
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  uploadTestimonialImage,
  Testimonial,
} from "@admin/api/testimonials/testimonials"
import { toast } from '@/lib/toast'
import { getMediaUrl, cn } from "@/lib/utils"
import Image from "next/image"
import {
  AdminPageHeader,
  AdminHeaderPrimaryButton,
} from "@admin/components/admin-page-header"

export default function HomeTestimonialsCustomizationPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [currentPage, setCurrentPage] = useState(1)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [newTestimonial, setNewTestimonial] = useState({
    name: "",
    position: "",
    description: "",
  })
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [newImagePreview, setNewImagePreview] = useState<string>("")

  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string>("")

  const [testimonialToEdit, setTestimonialToEdit] = useState<Testimonial | null>(null)
  const [testimonialToDelete, setTestimonialToDelete] = useState<Testimonial | null>(null)

  const fetchTestimonials = async () => {
    try {
      setLoading(true)
      const data = await getTestimonials()
      setTestimonials(data)
    } catch (error) {
      console.error("Failed to fetch testimonials:", error)
      toast.error("Failed to load testimonials")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const filteredTestimonials = useMemo(() => {
    return Array.isArray(testimonials)
      ? testimonials.filter(
          (t) =>
            t.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            t.position.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      : []
  }, [testimonials, debouncedSearch])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filteredTestimonials.length / TABLE_PAGE_SIZE))
  const cursorTable = useRemoteCursor<any>('/testimonial', { _search: debouncedSearch })
  const paginatedTestimonials = cursorTable.data
  useEffect(() => { cursorTable.refresh() }, [testimonials, cursorTable.refresh])

  const handleAddTestimonial = async () => {
    if (newTestimonial.name && newTestimonial.description) {
      try {
        setSubmitting(true)
        let imageUrl: string | undefined
        if (newImageFile) {
          imageUrl = await uploadTestimonialImage(newImageFile)
        }
        await createTestimonial({ ...newTestimonial, imageUrl })
        toast.success("Testimonial added successfully")
        setNewTestimonial({ name: "", position: "", description: "" })
        setNewImageFile(null)
        setNewImagePreview("")
        setIsAddDialogOpen(false)
        fetchTestimonials()
      } catch {
        toast.error("Failed to add testimonial")
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleUpdateTestimonial = async () => {
    if (testimonialToEdit) {
      try {
        setSubmitting(true)
        const { name, position, description } = testimonialToEdit
        let imageUrl = testimonialToEdit.imageUrl ?? undefined
        if (editImageFile) {
          imageUrl = await uploadTestimonialImage(editImageFile)
        }
        await updateTestimonial(testimonialToEdit.id, { name, position, description, imageUrl })
        toast.success("Testimonial updated successfully")
        setTestimonialToEdit(null)
        setEditImageFile(null)
        setEditImagePreview("")
        fetchTestimonials()
      } catch (error) {
        console.error("Update failed:", error)
        toast.error("Failed to update testimonial")
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleDeleteTestimonial = async () => {
    if (testimonialToDelete) {
      try {
        setSubmitting(true)
        await deleteTestimonial(testimonialToDelete.id)
        toast.success("Testimonial deleted successfully")
        setTestimonialToDelete(null)
        fetchTestimonials()
      } catch {
        toast.error("Failed to delete testimonial")
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller")
      e.target.value = ""
      return
    }
    setNewImageFile(file)
    setNewImagePreview(URL.createObjectURL(file))
  }

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller")
      e.target.value = ""
      return
    }
    setEditImageFile(file)
    setEditImagePreview(URL.createObjectURL(file))
  }

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        title="Testimonials"
        subtitle="Client reviews displayed in the carousel on the home page"
        actions={
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <AdminHeaderPrimaryButton accessAction="create">
                <Plus />
                Add Testimonial
              </AdminHeaderPrimaryButton>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Testimonial</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 pb-2">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  placeholder="e.g. Sophia Laurent"
                  value={newTestimonial.name}
                  onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position / Title</Label>
                <Input
                  placeholder="e.g. Creative Director"
                  value={newTestimonial.position}
                  onChange={(e) => setNewTestimonial({ ...newTestimonial, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="The team's artistry and dedication..."
                  value={newTestimonial.description}
                  onChange={(e) => setNewTestimonial({ ...newTestimonial, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Customer Photo <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                {newImagePreview ? (
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 shrink-0">
                      <Image
                        src={newImagePreview}
                        alt="Preview"
                        fill
                        className="rounded-full object-cover border border-border"
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewImageFile(null)
                        setNewImagePreview("")
                      }}
                      className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer w-fit rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      <ImagePlus className="w-4 h-4" />
                      Upload photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleNewImageChange}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP — max 5 MB</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddTestimonial} className="w-full" disabled={submitting} accessAction="create">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Testimonial
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
                placeholder="Search testimonials..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={SEARCH_INPUT_CLASS}
              />
            </div>
            <span className="text-sm text-[#666] whitespace-nowrap">
              {loading ? "Loading..." : `${filteredTestimonials.length} results`}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table cursorPagination={cursorTable} className="table-fixed min-w-[860px]">
            <TableHeader>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead className={cn(HEAD_CLASS, "w-[56px]")}>SL.</TableHead>
                <TableHead className={HEAD_CLASS}>Client</TableHead>
                <TableHead className={HEAD_CLASS}>Position</TableHead>
                <TableHead className={HEAD_CLASS}>Description</TableHead>
                <TableHead className={HEAD_CLASS}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-4 py-10 text-sm text-muted-foreground text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredTestimonials.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-4 py-10 text-sm text-muted-foreground text-center">
                    No testimonials found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTestimonials.map((t, index) => (
                  <TableRow key={t.id} className={TABLE_ROW_CLASS}>
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex items-center gap-3">
                        {t.imageUrl ? (
                          <div className="relative w-8 h-8 shrink-0">
                            <Image
                              src={getMediaUrl(t.imageUrl) || ""}
                              alt={t.name}
                              fill
                              className="rounded-full object-cover border border-border"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 shrink-0 rounded-full bg-brand-soft flex items-center justify-center text-xs font-semibold text-brand-primary">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{t.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>{t.position}</TableCell>
                    <TableCell className={CELL_CLASS}>
                      <p className="text-[12px] text-[#666] line-clamp-2">{t.description}</p>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_EDIT}
                          aria-label="Edit testimonial"
                          onClick={() => {
                            setTestimonialToEdit({ ...t })
                            setEditImageFile(null)
                            setEditImagePreview("")
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_DELETE}
                          aria-label="Delete testimonial"
                          onClick={() => setTestimonialToDelete(t)}
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

      <Dialog
        open={!!testimonialToEdit}
        onOpenChange={() => {
          setTestimonialToEdit(null)
          setEditImageFile(null)
          setEditImagePreview("")
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Testimonial</DialogTitle>
          </DialogHeader>
          {testimonialToEdit && (
            <div className="space-y-4 py-4 pb-2">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input placeholder="e.g. Alex Rahman"
                  value={testimonialToEdit.name}
                  onChange={(e) => setTestimonialToEdit({ ...testimonialToEdit, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Input placeholder="e.g. Senior stylist"
                  value={testimonialToEdit.position}
                  onChange={(e) => setTestimonialToEdit({ ...testimonialToEdit, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="e.g. Friendly team and a beautiful result."
                  value={testimonialToEdit.description}
                  onChange={(e) => setTestimonialToEdit({ ...testimonialToEdit, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Customer Photo <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                {editImagePreview || testimonialToEdit.imageUrl ? (
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 shrink-0">
                      <Image
                        src={editImagePreview || getMediaUrl(testimonialToEdit.imageUrl) || ""}
                        alt="Preview"
                        fill
                        className="rounded-full object-cover border border-border"
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditImageFile(null)
                        setEditImagePreview("")
                        setTestimonialToEdit({ ...testimonialToEdit, imageUrl: null })
                      }}
                      className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer w-fit rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      <ImagePlus className="w-4 h-4" />
                      Upload photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleEditImageChange}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP — max 5 MB</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={handleUpdateTestimonial} disabled={submitting} accessAction="edit">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!testimonialToDelete} onOpenChange={() => setTestimonialToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Testimonial</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-muted-foreground">
            Are you sure you want to delete the testimonial from <strong>{testimonialToDelete?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestimonialToDelete(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTestimonial} disabled={submitting} accessAction="delete">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
