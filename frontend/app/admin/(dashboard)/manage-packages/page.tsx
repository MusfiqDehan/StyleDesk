"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useMemo } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { cn, formatCurrency } from "@/lib/utils"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  ImagePlus,
  ArrowUpDown,
} from "lucide-react"
import {
  CATALOG_SORT_OPTIONS,
  normalizeCatalogSort,
  sortCatalogItems,
  type CatalogSortOrder,
} from "@/lib/catalog-sort"
import { getBusinessInfo, updateBusinessInfo } from "@admin/api/settings/settings"
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
import {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
  uploadPackageImage,
} from "@admin/api/packages/packages"
import { toast } from '@/lib/toast'
import { ScrollArea } from "@/components/ui/scroll-area"
import { TablePagination, TABLE_PAGE_SIZE } from "@admin/components/table-pagination"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"
import { CatalogStats } from "@admin/components/catalog-stats"

interface Package {
  id: string
  category: string
  title: string
  price: number
  billingCycle: string
  description: string
  features: string[]
  popular?: boolean
  imageUrl?: string
  createdAt?: string
}

const FILTER_TRIGGER =
  "h-[38px] rounded-lg border border-[#e7e7e7] bg-white px-3 text-sm font-medium text-[#333] shadow-none focus:ring-2 focus:ring-brand-primary/20 focus:ring-offset-0 hover:border-[#cfd8e3] [&>svg]:text-[#666]"

export default function ManagePackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [sortOrder, setSortOrder] = useState<CatalogSortOrder>("newest")
  const [currentPage, setCurrentPage] = useState(1)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [newPackage, setNewPackage] = useState({
    category: "SPECIAL",
    title: "",
    price: "",
    billingCycle: "package",
    description: "",
    features: [] as string[],
    newFeature: "",
  })

  const [packageToEdit, setPackageToEdit] = useState<Package | null>(null)
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null)

  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)

  const fetchPackages = async () => {
    try {
      setLoading(true)
      const [data, business] = await Promise.all([
        getPackages(true),
        getBusinessInfo().catch(() => null),
      ])
      setPackages(data)
      if (business?.packagesSortOrder) {
        setSortOrder(normalizeCatalogSort(business.packagesSortOrder))
      }
    } catch (error) {
      console.error("Failed to fetch packages:", error)
      toast.error("Failed to load packages")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  const handleSortChange = async (value: CatalogSortOrder) => {
    setSortOrder(value)
    try {
      await updateBusinessInfo({ packagesSortOrder: value })
    } catch (error) {
      console.error("Failed to save packages sort order", error)
      toast.error("Could not save display order for the website")
    }
  }

  const filteredPackages = useMemo(() => {
    const filtered = packages.filter(
      (pkg) =>
        pkg.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        pkg.category.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
    return sortCatalogItems(filtered, sortOrder)
  }, [packages, debouncedSearch, sortOrder])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / TABLE_PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredPackages, (pkg) => pkg.id)
  const paginatedPackages = cursorTable.data

  const handleAddPackage = async () => {
    const newErrors: Record<string, string> = {}
    if (!newPackage.title) newErrors.title = "Title is required"
    if (!newPackage.category) newErrors.category = "Category is required"
    if (!newPackage.price) {
      newErrors.price = "Price is required"
    } else if (isNaN(parseFloat(newPackage.price)) || parseFloat(newPackage.price) <= 0) {
      newErrors.price = "Price must be a positive number"
    }
    if (!newPackage.billingCycle) newErrors.billingCycle = "Billing cycle is required"
    if (!newPackage.description.trim()) newErrors.description = "Description is required"
    if (newPackage.features.length === 0) newErrors.features = "At least one feature is required"
    if (!newImageFile) newErrors.coverImage = "Cover image is required"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setSubmitting(true)
      let imageUrl: string | undefined
      if (newImageFile) {
        imageUrl = await uploadPackageImage(newImageFile)
      }
      await createPackage({
        category: newPackage.category,
        title: newPackage.title,
        price: parseFloat(newPackage.price),
        billingCycle: newPackage.billingCycle,
        description: newPackage.description,
        features: newPackage.features,
        ...(imageUrl && { imageUrl }),
      })
      toast.success("Package created successfully")
      setNewPackage({
        category: "SPECIAL",
        title: "",
        price: "",
        billingCycle: "package",
        description: "",
        features: [],
        newFeature: "",
      })
      setNewImageFile(null)
      setNewImagePreview(null)
      setErrors({})
      setIsAddDialogOpen(false)
      fetchPackages()
    } catch (error: any) {
      const backendErrors = error.response?.data?.message
      if (Array.isArray(backendErrors)) {
        const newErrors: Record<string, string> = {}
        backendErrors.forEach((msg: string) => {
          if (msg.toLowerCase().includes("title")) newErrors.title = msg
          if (msg.toLowerCase().includes("category")) newErrors.category = msg
          if (msg.toLowerCase().includes("price")) newErrors.price = msg
          if (msg.toLowerCase().includes("billing")) newErrors.billingCycle = msg
        })
        setErrors(newErrors)
      }
      toast.error("Failed to create package")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdatePackage = async () => {
    if (!packageToEdit) return

    const newErrors: Record<string, string> = {}
    if (!packageToEdit.title) newErrors.title = "Title is required"
    if (!packageToEdit.category) newErrors.category = "Category is required"
    if (!packageToEdit.price || packageToEdit.price <= 0) newErrors.price = "Price must be a positive number"
    if (!packageToEdit.description.trim()) newErrors.description = "Description is required"
    if (packageToEdit.features.length === 0) newErrors.features = "At least one feature is required"
    if (!editImageFile && !packageToEdit.imageUrl) newErrors.coverImage = "Cover image is required"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setSubmitting(true)
      let imageUrl = packageToEdit.imageUrl
      if (editImageFile) {
        imageUrl = await uploadPackageImage(editImageFile)
      }
      const payload = {
        title: packageToEdit.title,
        category: packageToEdit.category,
        price: Number(packageToEdit.price),
        billingCycle: packageToEdit.billingCycle,
        description: packageToEdit.description,
        features: packageToEdit.features,
        imageUrl,
      }

      await updatePackage(packageToEdit.id, payload)
      toast.success("Package updated successfully")
      setErrors({})
      setPackageToEdit(null)
      setEditImageFile(null)
      setEditImagePreview(null)
      fetchPackages()
    } catch (error: any) {
      toast.error("Failed to update package")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePackage = async () => {
    if (packageToDelete) {
      try {
        setSubmitting(true)
        await deletePackage(packageToDelete.id)
        toast.success("Package deleted successfully")
        setPackageToDelete(null)
        fetchPackages()
      } catch (error) {
        toast.error("Failed to delete package")
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleMarkAsPopular = async (packageId: string, popular: boolean) => {
    try {
      setSubmitting(true)
      const selectedPkg = packages.find(p => p.id === packageId)
      if (selectedPkg) {
        await updatePackage(packageId, {
          title: selectedPkg.title,
          category: selectedPkg.category,
          price: Number(selectedPkg.price),
          billingCycle: selectedPkg.billingCycle,
          description: selectedPkg.description,
          features: selectedPkg.features,
          popular,
        })
        toast.success(popular ? "Package marked as popular" : "Package removed from popular")
        fetchPackages()
      }
    } catch (error) {
      toast.error("Failed to update package")
    } finally {
      setSubmitting(false)
    }
  }

  const addFeature = () => {
    if (newPackage.newFeature.trim()) {
      setNewPackage({
        ...newPackage,
        features: [...newPackage.features, newPackage.newFeature.trim()],
        newFeature: "",
      })
      if (errors.features) setErrors(prev => ({ ...prev, features: "" }))
    }
  }

  const removeFeature = (index: number) => {
    setNewPackage({
      ...newPackage,
      features: newPackage.features.filter((_, i) => i !== index),
    })
  }

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        title="Service Packages"
        subtitle="Create and manage salon service package offerings"
        actions={
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setErrors({}) }}>
            <DialogTrigger asChild>
              <AdminHeaderPrimaryButton accessAction="create">
                <Plus />
                Add Package
              </AdminHeaderPrimaryButton>
            </DialogTrigger>
          <DialogContent className="max-w-2xl" data-scroll-inside="true">
            <DialogHeader>
              <DialogTitle>Create New Package</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[65vh] pr-4">
              <div className="grid grid-cols-2 gap-4 py-4 pb-4">
                <div className="col-span-2">
                  <Label className={errors.title ? "text-destructive" : ""}>Title <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Bridal Glow"
                    value={newPackage.title}
                    onChange={(e) => {
                      setNewPackage({ ...newPackage, title: e.target.value })
                      if (errors.title) setErrors(prev => ({ ...prev, title: "" }))
                    }}
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && <p className="text-[10px] text-destructive mt-1">{errors.title}</p>}
                </div>
                <div>
                  <Label className={errors.category ? "text-destructive" : ""}>Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={newPackage.category}
                    onValueChange={(val) => {
                      setNewPackage({ ...newPackage, category: val })
                      if (errors.category) setErrors(prev => ({ ...prev, category: "" }))
                    }}
                  >
                    <SelectTrigger className={cn("w-full", errors.category ? "border-destructive" : "")}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPECIAL">Special</SelectItem>
                      <SelectItem value="SIGNATURE">Signature</SelectItem>
                      <SelectItem value="BRIDAL">Bridal</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="BASIC">Basic</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-[10px] text-destructive mt-1">{errors.category}</p>}
                </div>
                <div>
                  <Label className={errors.price ? "text-destructive" : ""}>Price (৳) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    placeholder="799"
                    value={newPackage.price}
                    onChange={(e) => {
                      setNewPackage({ ...newPackage, price: e.target.value })
                      if (errors.price) setErrors(prev => ({ ...prev, price: "" }))
                    }}
                    className={errors.price ? "border-destructive" : ""}
                  />
                  {errors.price && <p className="text-[10px] text-destructive mt-1">{errors.price}</p>}
                </div>
                <div>
                  <Label className={errors.billingCycle ? "text-destructive" : ""}>Billing Cycle <span className="text-destructive">*</span></Label>
                  <Select
                    value={newPackage.billingCycle}
                    onValueChange={(val) => {
                      setNewPackage({ ...newPackage, billingCycle: val })
                      if (errors.billingCycle) setErrors(prev => ({ ...prev, billingCycle: "" }))
                    }}
                  >
                    <SelectTrigger className={cn("w-full", errors.billingCycle ? "border-destructive" : "")}>
                      <SelectValue placeholder="Select billing cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="package">Package</SelectItem>
                      <SelectItem value="session">Per Session</SelectItem>
                      <SelectItem value="per visit">Per Visit</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.billingCycle && <p className="text-[10px] text-destructive mt-1">{errors.billingCycle}</p>}
                </div>
                <div className="col-span-2">
                  <Label className={errors.description ? "text-destructive" : ""}>Description <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="e.g. A relaxing treatment with wash, cut and styling."
                    value={newPackage.description}
                    onChange={(e) => {
                      setNewPackage({ ...newPackage, description: e.target.value })
                      if (errors.description) setErrors(prev => ({ ...prev, description: "" }))
                    }}
                    className={errors.description ? "border-destructive" : ""}
                  />
                  {errors.description && <p className="text-[10px] text-destructive mt-1">{errors.description}</p>}
                </div>
                <div className="col-span-2 space-y-4">
                  <Label className={errors.features ? "text-destructive" : ""}>Features <span className="text-destructive">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Hair styling, makeup consultation"
                      value={newPackage.newFeature}
                      onChange={(e) => setNewPackage({ ...newPackage, newFeature: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                    />
                    <Button type="button" variant="secondary" onClick={addFeature} accessAction="create">Add</Button>
                  </div>
                  {errors.features && <p className="text-[10px] text-destructive mt-1">{errors.features}</p>}
                  <div className="flex flex-wrap gap-2">
                    {newPackage.features.map((feature, i) => (
                      <span key={i} className="flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-xs">
                        {feature}
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => removeFeature(i)} />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className={errors.coverImage ? "text-destructive" : ""}>Cover Image <span className="text-destructive">*</span> <span className="text-muted-foreground text-[10px] font-normal">(JPG, PNG or WebP · max 5 MB)</span></Label>
                  <label className={cn("mt-1.5 flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors overflow-hidden relative", errors.coverImage ? "border-destructive hover:border-destructive/80" : "border-border hover:border-primary/50")}>
                    {newImagePreview ? (
                      <>
                        <img src={newImagePreview} alt="preview" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-white text-xs font-medium">Change Image</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImagePlus className="w-7 h-7" />
                        <span className="text-xs">Click to upload image</span>
                        <span className="text-[10px]">JPG, PNG or WebP · max 5 MB</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                          setErrors(prev => ({ ...prev, coverImage: "Image must be under 5 MB" }))
                          e.target.value = ""
                          return
                        }
                        setNewImageFile(file)
                        setNewImagePreview(URL.createObjectURL(file))
                        if (errors.coverImage) setErrors(prev => ({ ...prev, coverImage: "" }))
                      }}
                    />
                  </label>
                  {newImageFile && (
                    <button
                      type="button"
                      onClick={() => { setNewImageFile(null); setNewImagePreview(null) }}
                      className="mt-1 text-[10px] text-destructive hover:underline"
                    >
                      Remove image
                    </button>
                  )}
                  {errors.coverImage && <p className="text-[10px] text-destructive mt-1">{errors.coverImage}</p>}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="border-t border-border pt-3">
              <Button onClick={handleAddPackage} className="w-full" disabled={submitting} accessAction="create">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Package
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        }
      />

      <CatalogStats items={filteredPackages} loading={loading} kind="packages" />
      <div className={TABLE_CARD_CLASS}>
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
              <Input
                placeholder="Search packages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={SEARCH_INPUT_CLASS}
              />
            </div>
            <Select
              value={sortOrder}
              onValueChange={(v) => handleSortChange(v as CatalogSortOrder)}
            >
              <SelectTrigger className={cn(FILTER_TRIGGER, "w-[200px]")}>
                <ArrowUpDown className="size-4 shrink-0 text-[#666]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                {CATALOG_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-[#666] whitespace-nowrap">
              {loading ? "Loading..." : `${filteredPackages.length} results`}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table cursorPagination={cursorTable}>
            <TableHeader>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead className={HEAD_CLASS}>SL.</TableHead>
                <TableHead className={HEAD_CLASS}>Popular</TableHead>
                <TableHead className={HEAD_CLASS}>Package Info</TableHead>
                <TableHead className={HEAD_CLASS}>Category</TableHead>
                <TableHead className={HEAD_CLASS}>Price</TableHead>
                <TableHead className={HEAD_CLASS}>Features</TableHead>
                <TableHead className={HEAD_CLASS}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-4 py-10 text-sm text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filteredPackages.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-4 py-10 text-sm text-muted-foreground">No packages found.</TableCell>
                </TableRow>
              ) : (
                paginatedPackages.map((pkg, index) => (
                  <TableRow key={pkg.id} className={TABLE_ROW_CLASS}>
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <input
                        type="checkbox"
                        checked={pkg.popular === true}
                        onChange={(e) => handleMarkAsPopular(pkg.id, e.target.checked)}
                        disabled={submitting}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="font-medium">{pkg.title}</div>
                      <div className="max-w-[200px] truncate text-xs text-muted-foreground">{pkg.description}</div>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        {pkg.category}
                      </span>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="font-semibold tabular-nums">{formatCurrency(pkg.price)}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{pkg.billingCycle}</div>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex flex-wrap gap-1">
                        {pkg.features.slice(0, 2).map((f, idx) => (
                          <span key={idx} className="inline-flex whitespace-nowrap rounded-full border border-[#e7e7e7] bg-[#f8fafc] px-2 py-0.5 text-[10px] font-semibold text-[#555]">{f}</span>
                        ))}
                        {pkg.features.length > 2 && (
                          <span className="inline-flex rounded-full border border-[#e7e7e7] bg-[#f8fafc] px-2 py-0.5 text-[10px] font-semibold text-[#555]">+{pkg.features.length - 2}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_EDIT}
                          aria-label="Edit package"
                          onClick={() => setPackageToEdit({ ...pkg })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_DELETE}
                          aria-label="Delete package"
                          onClick={() => setPackageToDelete(pkg)}
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

      {/* Edit Modal */}
      <Dialog open={!!packageToEdit} onOpenChange={(open) => { if (!open) { setPackageToEdit(null); setErrors({}); setEditImageFile(null); setEditImagePreview(null); } }}>
        <DialogContent className="max-w-2xl" data-scroll-inside="true">
          <DialogHeader><DialogTitle>Edit Package</DialogTitle></DialogHeader>
          <ScrollArea className="h-[65vh] pr-4">
            {packageToEdit && (
              <div className="grid grid-cols-2 gap-4 py-4 pb-4">
                <div className="col-span-2">
                  <Label className={errors.title ? "text-destructive" : ""}>Title <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Bridal Glow"
                    value={packageToEdit.title}
                    onChange={(e) => {
                      setPackageToEdit({ ...packageToEdit, title: e.target.value })
                      if (errors.title) setErrors(prev => ({ ...prev, title: "" }))
                    }}
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && <p className="text-[10px] text-destructive mt-1">{errors.title}</p>}
                </div>
                <div>
                  <Label className={errors.category ? "text-destructive" : ""}>Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={packageToEdit.category}
                    onValueChange={(val) => {
                      setPackageToEdit({ ...packageToEdit, category: val })
                      if (errors.category) setErrors(prev => ({ ...prev, category: "" }))
                    }}
                  >
                    <SelectTrigger className={cn("w-full", errors.category ? "border-destructive" : "")}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPECIAL">Special</SelectItem>
                      <SelectItem value="SIGNATURE">Signature</SelectItem>
                      <SelectItem value="BRIDAL">Bridal</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="BASIC">Basic</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-[10px] text-destructive mt-1">{errors.category}</p>}
                </div>
                <div>
                  <Label className={errors.price ? "text-destructive" : ""}>Price (৳) <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. 1500"
                    type="number"
                    value={packageToEdit.price}
                    onChange={(e) => {
                      setPackageToEdit({ ...packageToEdit, price: parseFloat(e.target.value) })
                      if (errors.price) setErrors(prev => ({ ...prev, price: "" }))
                    }}
                    className={errors.price ? "border-destructive" : ""}
                  />
                  {errors.price && <p className="text-[10px] text-destructive mt-1">{errors.price}</p>}
                </div>
                <div className="col-span-2">
                  <Label>Billing Cycle</Label>
                  <Select
                    value={packageToEdit.billingCycle}
                    onValueChange={(val) => setPackageToEdit({ ...packageToEdit, billingCycle: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select billing cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="package">Package</SelectItem>
                      <SelectItem value="session">Per Session</SelectItem>
                      <SelectItem value="per visit">Per Visit</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className={errors.description ? "text-destructive" : ""}>Description <span className="text-destructive">*</span></Label>
                  <Textarea placeholder="e.g. A relaxing treatment with wash, cut and styling."
                    value={packageToEdit.description}
                    onChange={(e) => {
                      setPackageToEdit({ ...packageToEdit, description: e.target.value })
                      if (errors.description) setErrors(prev => ({ ...prev, description: "" }))
                    }}
                    className={errors.description ? "border-destructive" : ""}
                  />
                  {errors.description && <p className="text-[10px] text-destructive mt-1">{errors.description}</p>}
                </div>
                <div className="col-span-2 space-y-4">
                  <Label className={errors.features ? "text-destructive" : ""}>Features (Comma separated) <span className="text-destructive">*</span></Label>
                  <Textarea placeholder="e.g. Hair styling, makeup consultation"
                    value={packageToEdit.features.join(', ')}
                    onChange={(e) => {
                      const features = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                      setPackageToEdit({ ...packageToEdit, features })
                      if (features.length > 0 && errors.features) setErrors(prev => ({ ...prev, features: "" }))
                    }}
                    className={errors.features ? "border-destructive" : ""}
                  />
                  {errors.features && <p className="text-[10px] text-destructive mt-1">{errors.features}</p>}
                </div>
                <div className="col-span-2">
                  <Label className={errors.coverImage ? "text-destructive" : ""}>Cover Image <span className="text-destructive">*</span> <span className="text-muted-foreground text-[10px] font-normal">(JPG, PNG or WebP · max 5 MB)</span></Label>
                  <label className={cn("mt-1.5 flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors overflow-hidden relative", errors.coverImage ? "border-destructive hover:border-destructive/80" : "border-border hover:border-primary/50")}>
                    {(() => {
                      const preview = editImagePreview || (packageToEdit.imageUrl ? `${'/api/backend'}/uploads/${packageToEdit.imageUrl}` : null)
                      return preview ? (
                        <>
                          <img src={preview} alt="preview" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-medium">Change Image</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImagePlus className="w-7 h-7" />
                          <span className="text-xs">Click to upload image</span>
                          <span className="text-[10px]">JPG, PNG or WebP · max 5 MB</span>
                        </div>
                      )
                    })()}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                          setErrors(prev => ({ ...prev, coverImage: "Image must be under 5 MB" }))
                          e.target.value = ""
                          return
                        }
                        setEditImageFile(file)
                        setEditImagePreview(URL.createObjectURL(file))
                        if (errors.coverImage) setErrors(prev => ({ ...prev, coverImage: "" }))
                      }}
                    />
                  </label>
                  {(editImageFile || packageToEdit.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditImageFile(null)
                        setEditImagePreview(null)
                        setPackageToEdit({ ...packageToEdit, imageUrl: undefined })
                      }}
                      className="mt-1 text-[10px] text-destructive hover:underline"
                    >
                      Remove image
                    </button>
                  )}
                  {errors.coverImage && <p className="text-[10px] text-destructive mt-1">{errors.coverImage}</p>}
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="border-t border-border pt-3">
            <Button className="w-full" onClick={handleUpdatePackage} disabled={submitting} accessAction="edit">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!packageToDelete} onOpenChange={() => setPackageToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Package</DialogTitle></DialogHeader>
          <p className="py-4 text-muted-foreground">Are you sure you want to delete the package <strong>{packageToDelete?.title}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageToDelete(null)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePackage} disabled={submitting} accessAction="delete">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
