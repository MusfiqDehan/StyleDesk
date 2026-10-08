"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { useLocalCursor } from "@/lib/pagination/use-cursor"

import { useState, useMemo, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import api from "@admin/api/base"
import { getServices, createService, updateService, deleteService } from "@admin/api/services/services"
import { getBusinessInfo, updateBusinessInfo } from "@admin/api/settings/settings"
import { removeFromCache, CACHE } from "@admin/lib/cache"
import { toast } from '@/lib/toast'
import { formatCurrency, getMediaUrl, cn } from "@/lib/utils"
import {
  CATALOG_SORT_OPTIONS,
  normalizeCatalogSort,
  sortCatalogItems,
  type CatalogSortOrder,
} from "@/lib/catalog-sort"
import { AdminPageHeader, AdminHeaderPrimaryButton } from "@admin/components/admin-page-header"
import { CatalogStats } from "@admin/components/catalog-stats"

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
import { Plus, Search, Clock, ArrowUpDown, Pencil, Trash2, Scissors } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  HEAD_CLASS,
  CELL_CLASS,
  FILTER_TRIGGER,
  SEARCH_INPUT_CLASS,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_EDIT,
  ACTION_DELETE,
} from "@admin/lib/table-styles"

interface Service {
  id: string
  name: string
  category: string
  duration: number
  description: string
  price: number
  active: boolean
  imageUrl?: string
  createdAt?: string
}

const CATEGORIES = ["All", "Hair", "Makeup", "Skin", "Bridal", "Nails", "Spa", "Other"] as const

const CATEGORY_OPTIONS = CATEGORIES.map((cat) => ({
  value: cat,
  label: cat === "All" ? "All Services" : cat,
}))

const PAGE_SIZE = 10

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [sortOrder, setSortOrder] = useState<CatalogSortOrder>("newest")
  const [currentPage, setCurrentPage] = useState(1)
  const [newService, setNewService] = useState({
    name: "",
    category: "",
    duration: "",
    price: "",
    description: "",
    imageUrl: "",
    imageFile: null as File | null,
    previewUrl: ""
  })

  const [serviceToEdit, setServiceToEdit] = useState<(Service & { imageFile?: File | null, previewUrl?: string }) | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)

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


  const fetchServices = async (noCache = false) => {
    try {
      setLoading(true)
      if (noCache) removeFromCache(CACHE.SERVICES, CACHE.SERVICES_ACTIVE)
      const [data, business] = await Promise.all([
        getServices(undefined, noCache),
        getBusinessInfo().catch(() => null),
      ])
      const list = Array.isArray(data) ? data : []
      const mappedServices = list.map((s: any) => ({
        ...s,
        price: parseFloat(s.price) || 0,
        duration: parseInt(s.duration) || 0,
        description: s.description || "",
        active: s.status === 'active',
        createdAt: s.createdAt,
      }))
      setServices(mappedServices)
      if (business?.servicesSortOrder) {
        setSortOrder(normalizeCatalogSort(business.servicesSortOrder))
      }
    } catch (error) {
      console.error("Failed to fetch services:", error)
      toast.error("Failed to load services")
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always bypass stale client cache after DB seed / catalog updates
    fetchServices(true)
  }, [])

  const handleSortChange = async (value: CatalogSortOrder) => {
    setSortOrder(value)
    try {
      await updateBusinessInfo({ servicesSortOrder: value })
    } catch (error) {
      console.error("Failed to save services sort order", error)
      toast.error("Could not save display order for the website")
    }
  }

  const filteredServices = useMemo(() => {
    const filtered = services.filter(
      (service) =>
        (service.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          service.category.toLowerCase().includes(debouncedSearch.toLowerCase())) &&
        (categoryFilter === "All" || service.category === categoryFilter)
    )
    return sortCatalogItems(filtered, sortOrder)
  }, [services, debouncedSearch, categoryFilter, sortOrder])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, categoryFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE))
  const cursorTable = useLocalCursor(filteredServices, (service) => service.id)
  const paginatedServices = cursorTable.data

  const handleAddService = async () => {
    if (newService.name && newService.category && newService.price) {
      setIsSubmitting(true)
      try {
        if (!newService.imageFile) {
          toast.error("Please select an image for the service")
          setIsSubmitting(false)
          return
        }

        const formData = new FormData()
        const payload = {
          name: newService.name,
          category: newService.category,
          duration: parseInt(newService.duration) || 30,
          price: parseFloat(newService.price) || 0,
          commission: 0,
          status: 'active',
          description: newService.description,
        }

        formData.append('data', JSON.stringify(payload))
        formData.append('image', newService.imageFile)

        await createService(formData)

        toast.success("Service added successfully")
        setNewService({ name: "", category: "", duration: "", price: "", description: "", imageUrl: "", imageFile: null, previewUrl: "" })
        setIsDialogOpen(false)
        fetchServices(true)
      } catch (error) {
        console.error("Failed to add service:", error)
        toast.error("Failed to add service")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleEditSave = async () => {
    if (serviceToEdit) {
      setIsSubmitting(true)
      try {
        if (!serviceToEdit.name || !serviceToEdit.category || !serviceToEdit.price) {
          toast.error("Please fill in all required fields")
          setIsSubmitting(false)
          return
        }

        const formData = new FormData()
        const payload = {
          name: serviceToEdit.name,
          category: serviceToEdit.category,
          duration: Number(serviceToEdit.duration) || 30,
          price: Number(serviceToEdit.price) || 0,
          commission: 0,
          status: serviceToEdit.active ? 'active' : 'hidden',
          description: serviceToEdit.description || "",
          imageUrl: serviceToEdit.imageFile ? undefined : serviceToEdit.imageUrl,
        }

        formData.append('data', JSON.stringify(payload))

        if (serviceToEdit.imageFile) {
          formData.append('image', serviceToEdit.imageFile)
        }

        await updateService(serviceToEdit.id, formData)

        toast.success("Service updated successfully")
        setServiceToEdit(null)
        fetchServices(true)
      } catch (error) {
        console.error("Failed to update service:", error)
        toast.error("Failed to update service")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleDelete = async () => {
    if (serviceToDelete) {
      try {
        await deleteService(serviceToDelete.id)
        toast.success("Service deleted successfully")
        setServiceToDelete(null)
        fetchServices(true)
      } catch (error) {
        console.error("Failed to delete service:", error)
        toast.error("Failed to delete service")
      }
    }
  }


  const toggleServiceActive = async (id: string, currentStatus: boolean) => {
    try {
      const formData = new FormData()
      formData.append('data', JSON.stringify({ status: !currentStatus ? 'active' : 'hidden' }))

      await updateService(id, formData)
      toast.success(`Service ${!currentStatus ? 'activated' : 'deactivated'}`)
      fetchServices(true)
    } catch (error) {
      console.error("Failed to toggle service status:", error)
      toast.error("Failed to update status")
    }
  }


  return (
    <>
      <div className={DASH_PAGE}>
        <AdminPageHeader
          title="Manage Services"
          subtitle="Add and organize the services your salon offers"
          actions={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <AdminHeaderPrimaryButton accessAction="create">
                <Plus />
                Add Service
              </AdminHeaderPrimaryButton>
            </DialogTrigger>
            <DialogContent data-scroll-inside="true">
              <DialogHeader>
                <DialogTitle>Add New Service</DialogTitle>
              </DialogHeader>
              <div className="max-h-[65vh] overflow-y-auto pr-1">
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Service Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      placeholder="e.g. Signature haircut"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Category <span className="text-destructive">*</span></Label>
                    <Select
                      value={newService.category}
                      onValueChange={(value) => setNewService({ ...newService, category: value })}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter(c => c !== "All").map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      type="text"
                      value={newService.description}
                      onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                      placeholder="e.g. A relaxing treatment with wash, cut and styling."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Service Image</Label>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-1"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setIsPreviewLoading(true)
                        try {
                          const webpFile = await compressToWebP(file)
                          setNewService((prev) => ({
                            ...prev,
                            imageFile: webpFile,
                            previewUrl: URL.createObjectURL(webpFile)
                          }))
                        } catch {
                          toast.error("Image processing failed")
                        } finally {
                          setIsPreviewLoading(false)
                        }
                      }}
                    />
                    {(newService.previewUrl || newService.imageUrl) && (
                      <img
                        src={getMediaUrl(newService.previewUrl || newService.imageUrl)}
                        alt="preview"
                        loading="lazy"
                        decoding="async"
                        className="mt-2 h-24 w-full object-cover rounded"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration (minutes) <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        value={newService.duration}
                        onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                        placeholder="30"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Price (৳) <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        value={newService.price}
                        onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                        placeholder="e.g. 1500"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t border-border pt-3">
                <Button onClick={handleAddService} className="w-full" disabled={isSubmitting || isPreviewLoading} accessAction="create">
                  {isPreviewLoading ? "Processing Image..." : (isSubmitting ? "Adding..." : "Add Service")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          }
        />

        <CatalogStats items={filteredServices} loading={loading} kind="services" />
        <div className={TABLE_CARD_CLASS}>
          <div className="border-b border-border p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full min-w-0 flex-1 sm:min-w-[240px] sm:max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
                <Input
                  placeholder="Search services..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={SEARCH_INPUT_CLASS}
                />
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger
                    className={cn(
                      FILTER_TRIGGER,
                      "w-full min-w-0 flex-1 gap-2 [&>span]:truncate sm:w-[170px] sm:flex-none",
                    )}
                  >
                    <Scissors className="size-4 shrink-0 text-[#666]" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-sm">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sortOrder}
                  onValueChange={(v) => handleSortChange(v as CatalogSortOrder)}
                >
                  <SelectTrigger
                    className={cn(
                      FILTER_TRIGGER,
                      "w-full min-w-0 flex-1 gap-2 [&>span]:truncate sm:w-[200px] sm:flex-none",
                    )}
                  >
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
              </div>

              <span className="text-sm text-[#666] whitespace-nowrap sm:ml-auto">
                {loading ? "Loading..." : `${filteredServices.length} results`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table cursorPagination={cursorTable} className="table-fixed min-w-[860px]">
              <colgroup>
                <col className="w-[56px]" />
                <col className="w-[240px]" />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[128px]" />
              </colgroup>
              <TableHeader>
                <TableRow className={TABLE_HEADER_ROW_CLASS}>
                  <TableHead className={HEAD_CLASS}>SL.</TableHead>
                  <TableHead className={HEAD_CLASS}>Service</TableHead>
                  <TableHead className={HEAD_CLASS}>Category</TableHead>
                  <TableHead className={HEAD_CLASS}>Duration</TableHead>
                  <TableHead className={HEAD_CLASS}>Price</TableHead>
                  <TableHead className={HEAD_CLASS}>Status</TableHead>
                  <TableHead className={HEAD_CLASS}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="px-4 py-10 text-sm text-muted-foreground">
                      Loading services...
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="px-4 py-10 text-sm text-muted-foreground">
                      No services found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedServices.map((service, index) => (
                    <TableRow key={service.id} className={TABLE_ROW_CLASS}>
                      <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                        {cursorTable.pageInfo.from + index}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          {service.imageUrl ? (
                            <img
                              src={getMediaUrl(service.imageUrl)}
                              alt={service.name}
                              loading="lazy"
                              decoding="async"
                              className="size-9 shrink-0 rounded-lg border border-[#e7e7e7] object-cover"
                            />
                          ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                              <Scissors className="size-4 text-brand-primary" />
                            </div>
                          )}
                          <span className="truncate font-medium" title={service.name}>
                            {service.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                          {service.category}
                        </span>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <span className="inline-flex items-center gap-1.5 tabular-nums text-[#666]">
                          <Clock className="size-3.5 text-[#999]" />
                          {service.duration} min
                        </span>
                      </TableCell>
                      <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums")}>
                        {formatCurrency(service.price)}
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <Switch
                          checked={service.active}
                          onCheckedChange={() => toggleServiceActive(service.id, service.active)}
                        />
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ACTION_EDIT}
                            aria-label="Edit service"
                            onClick={() => setServiceToEdit({ ...service })}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={ACTION_DELETE}
                            aria-label="Delete service"
                            onClick={() => setServiceToDelete(service)}
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
          {!loading && filteredServices.length > 0 && (
            <></>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!serviceToEdit} onOpenChange={() => setServiceToEdit(null)}>
        <DialogContent data-scroll-inside="true">
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          {serviceToEdit && (
            <>
              <div className="max-h-[65vh] overflow-y-auto pr-1">
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. Signature haircut" className="mt-1" value={serviceToEdit.name} onChange={(e) => setServiceToEdit({ ...serviceToEdit, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Category <span className="text-destructive">*</span></Label>
                    <Select value={serviceToEdit.category} onValueChange={(v) => setServiceToEdit({ ...serviceToEdit, category: v })}>
                      <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.filter(c => c !== "All").map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input placeholder="e.g. A relaxing treatment with wash, cut and styling." className="mt-1" type="text" value={serviceToEdit.description} onChange={(e) => setServiceToEdit({ ...serviceToEdit, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Service Image</Label>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-1"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setIsPreviewLoading(true)
                        try {
                          const webpFile = await compressToWebP(file)
                          setServiceToEdit((prev) => prev ? {
                            ...prev,
                            imageFile: webpFile,
                            previewUrl: URL.createObjectURL(webpFile)
                          } : prev)
                        } catch {
                          toast.error("Image processing failed")
                        } finally {
                          setIsPreviewLoading(false)
                        }
                      }}
                    />
                    {(serviceToEdit.previewUrl || serviceToEdit.imageUrl) && (
                      <img
                        src={getMediaUrl(serviceToEdit.previewUrl || serviceToEdit.imageUrl)}
                        alt="preview"
                        loading="lazy"
                        decoding="async"
                        className="mt-2 h-24 w-full object-cover rounded"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration (min) <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g. 45" className="mt-1" type="number" value={serviceToEdit.duration} onChange={(e) => setServiceToEdit({ ...serviceToEdit, duration: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label>Price (৳) <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g. 1500" className="mt-1" type="number" value={serviceToEdit.price} onChange={(e) => setServiceToEdit({ ...serviceToEdit, price: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t border-border pt-3">
                <Button className="w-full" onClick={handleEditSave} disabled={isSubmitting || isPreviewLoading} accessAction="edit">
                  {isPreviewLoading ? "Processing Image..." : (isSubmitting ? "Updating..." : "Save Changes")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!serviceToDelete} onOpenChange={() => setServiceToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Service</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete <strong>{serviceToDelete?.name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} accessAction="delete">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
