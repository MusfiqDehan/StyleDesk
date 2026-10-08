"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"
import { getCursorCollection } from "@/lib/pagination/collection"
import { useRemoteCursor } from "@/lib/pagination/use-cursor"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { useDebounce } from "@/hooks/use-debounce"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { AdminPageHeader, AdminHeaderPrimaryButton, AdminHeaderSecondaryButton } from "@admin/components/admin-page-header"
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
import { Plus, Search, AlertTriangle, Package, ArrowUpDown, Eye, Pencil, Trash2, Calendar, CalendarIcon, Loader2, FolderPlus, Wallet } from "lucide-react"
import { StatCard } from "@admin/components/stat-card"
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, type InventoryItem } from "@admin/api/inventory/inventory"
import { formatCurrency, cn } from "@/lib/utils"
import { toast } from '@/lib/toast'
import {
  HEAD_CLASS,
  CELL_CLASS,
  FILTER_TRIGGER,
  SEARCH_INPUT_CLASS,
  TABLE_CARD_CLASS,
  TABLE_ROW_CLASS,
  TABLE_HEADER_ROW_CLASS,
  ACTION_VIEW,
  ACTION_EDIT,
  ACTION_DELETE,
} from "@admin/lib/table-styles"

const emptyForm = {
  name: "",
  category: "",
  stockQty: "",
  minStockLevel: "",
  unitPrice: "",
  supplier: "",
  expiryDate: "",
}

const STOCK_SORT_OPTIONS = [
  { value: "none", label: "All Stock" },
  { value: "desc", label: "High to Low" },
  { value: "asc", label: "Low to High" },
]
const PAGE_SIZE = 10

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 500)
  const [stockSort, setStockSort] = useState("none")
  const [currentPage, setCurrentPage] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newItem, setNewItem] = useState(emptyForm)

  const [viewItem, setViewItem] = useState<InventoryItem | null>(null)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [addExpiryOpen, setAddExpiryOpen] = useState(false)
  const [editExpiryOpen, setEditExpiryOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null)

  const [categories, setCategories] = useState<string[]>([
    "Hair Products", "Skin Products", "Nail Products", "Grooming", "Equipment",
  ])
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Category already exists")
      return
    }
    setCategories((prev) => [...prev, trimmed])
    setNewCategoryName("")
    setIsCategoryDialogOpen(false)
    toast.success(`Category "${trimmed}" added`)
  }

  const cursorTable = useRemoteCursor<InventoryItem>('/inventory', {
    name: debouncedSearch || undefined,
    _sort: stockSort === 'none' ? 'createdAt' : 'stockQty',
    _order: stockSort === 'none' ? 'desc' : stockSort,
  })
  const paginatedInventory = cursorTable.data
  const fetchInventory = useCallback(async (_noCache = false) => {
    cursorTable.refresh()
    try {
      const result = await getCursorCollection<InventoryItem>('/inventory', { name: debouncedSearch || undefined })
      setInventory(result.data)
    } catch { toast.error('Failed to load inventory summary') }
  }, [debouncedSearch, cursorTable.refresh])
  useEffect(() => { void fetchInventory(true) }, [fetchInventory])
  useEffect(() => { setLoading(cursorTable.loading) }, [cursorTable.loading])

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.category || !newItem.stockQty) {
      toast.error("Please fill in required fields")
      return
    }
    try {
      setSubmitting(true)
      await createInventoryItem({
        name: newItem.name,
        category: newItem.category,
        stockQty: parseInt(newItem.stockQty) || 0,
        minStockLevel: parseInt(newItem.minStockLevel) || 0,
        unitPrice: parseFloat(newItem.unitPrice) || 0,
        supplier: newItem.supplier,
        expiryDate: newItem.expiryDate,
      })
      setNewItem(emptyForm)
      setIsDialogOpen(false)
      fetchInventory(true)
      toast.success("Item added successfully")
    } catch (err) {
      console.error("Failed to create inventory item", err)
      toast.error("Failed to add item")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSave = async () => {
    if (!editItem) return
    try {
      setSubmitting(true)
      await updateInventoryItem(editItem.id, {
        name: editItem.name,
        category: editItem.category,
        stockQty: Number(editItem.stockQty) || 0,
        minStockLevel: Number(editItem.minStockLevel) || 0,
        unitPrice: Number(editItem.unitPrice) || 0,
        supplier: editItem.supplier,
        expiryDate: editItem.expiryDate,
      })
      setEditItem(null)
      fetchInventory(true)
      toast.success("Item updated successfully")
    } catch (err) {
      console.error("Failed to update inventory item", err)
      toast.error("Failed to update item")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    try {
      setSubmitting(true)
      await deleteInventoryItem(deleteItem.id)
      setDeleteItem(null)
      fetchInventory(true)
      toast.success("Item deleted successfully")
    } catch (err) {
      console.error("Failed to delete inventory item", err)
      toast.error("Failed to delete item")
    } finally {
      setSubmitting(false)
    }
  }

  const lowStockCount = inventory.filter((item) => item.stockQty <= item.minStockLevel).length
  const totalValue = inventory.reduce((sum, item) => sum + item.stockQty * item.unitPrice, 0)
  const expiringSoonCount = inventory.filter((item) => {
    if (!item.expiryDate) return false
    const expiry = new Date(item.expiryDate)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const in30Days = new Date(today); in30Days.setDate(today.getDate() + 30)
    return expiry >= today && expiry <= in30Days
  }).length

  return (
    <>
      <div className={DASH_PAGE}>
        <AdminPageHeader
          title="Inventory"
          subtitle="Track stock levels, supplies, and inventory alerts"
          actions={
            <>
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <AdminHeaderSecondaryButton accessAction="create">
                <FolderPlus />
                Add Category
              </AdminHeaderSecondaryButton>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2 pb-2">
                <div>
                  <Label>Category Name</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Wax Products"
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  />
                </div>
                {categories.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Existing categories</Label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {categories.map((cat) => (
                        <span key={cat} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="border-t border-border pt-3">
                <Button onClick={handleAddCategory} className="w-full" disabled={!newCategoryName.trim()} accessAction="create">
                  Add Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <AdminHeaderPrimaryButton accessAction="create">
                <Plus />
                Add Item
              </AdminHeaderPrimaryButton>
            </DialogTrigger>
            <DialogContent data-scroll-inside="true">
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
              </DialogHeader>
              <div className="max-h-[65vh] overflow-y-auto pr-1">
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Product Name <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Argan hair serum" />
                  </div>
                  <div>
                    <Label>Category <span className="text-destructive">*</span></Label>
                    <Select value={newItem.category} onValueChange={(value) => setNewItem({ ...newItem, category: value })}>
                      <SelectTrigger className="w-full mt-1 cursor-pointer"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem className="cursor-pointer" key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Price (৳) <span className="text-destructive">*</span></Label><Input className="mt-1" type="number" value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })} placeholder="e.g. 1500" /></div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Popover open={addExpiryOpen} onOpenChange={setAddExpiryOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal mt-1" accessAction="create">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className={newItem.expiryDate ? "text-foreground" : "text-muted-foreground"}>
                              {newItem.expiryDate ? format(new Date(`${newItem.expiryDate}T00:00:00`), "PPP") : "Pick a date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                          <DateCalendar
                            mode="single"
                            selected={newItem.expiryDate ? new Date(`${newItem.expiryDate}T00:00:00`) : undefined}
                            onSelect={(selected) => {
                              if (!selected) return
                              setNewItem({ ...newItem, expiryDate: format(selected, "yyyy-MM-dd") })
                              setAddExpiryOpen(false)
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Quantity <span className="text-destructive">*</span></Label><Input className="mt-1" type="number" value={newItem.stockQty} onChange={(e) => setNewItem({ ...newItem, stockQty: e.target.value })} placeholder="e.g. 20" /></div>
                    <div><Label>Min Stock Level</Label><Input className="mt-1" type="number" value={newItem.minStockLevel} onChange={(e) => setNewItem({ ...newItem, minStockLevel: e.target.value })} placeholder="5" /></div>
                  </div>
                  <div><Label>Supplier</Label><Input className="mt-1" value={newItem.supplier} onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })} placeholder="e.g. Salon Supply Co." /></div>
                </div>
              </div>
              <DialogFooter className="border-t border-border pt-3">
                <Button onClick={handleAddItem} className="w-full" disabled={submitting} accessAction="create">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : "Add Item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <StatCard
            title="Total Value"
            value={formatCurrency(totalValue)}
            icon={Wallet}
            iconWrapperClassName="bg-brand-soft text-brand-primary"
            className="border-t-4 border-t-transparent hover:border-t-blue-500 transition-all"
          />
          <StatCard
            title="Products"
            value={inventory.length}
            icon={Package}
            iconWrapperClassName="bg-emerald-50 text-emerald-500"
            className="border-t-4 border-t-transparent hover:border-t-emerald-500 transition-all"
          />
          <StatCard
            title="Low Stock"
            value={lowStockCount}
            icon={AlertTriangle}
            iconWrapperClassName="bg-amber-50 text-amber-500"
            className="border-t-4 border-t-transparent hover:border-t-amber-500 transition-all"
          />
          <StatCard
            title="Expiring Soon"
            value={expiringSoonCount}
            subtitle="within 30 days"
            icon={Calendar}
            iconWrapperClassName={expiringSoonCount > 0 ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400"}
            className={`border-t-4 border-t-transparent transition-all ${expiringSoonCount > 0 ? "hover:border-t-rose-500" : "hover:border-t-slate-400"}`}
          />
        </div>

        <div className={TABLE_CARD_CLASS}>
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full min-w-0 flex-1 sm:min-w-[240px] sm:max-w-md">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
                <Input
                  placeholder="Search inventory..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={SEARCH_INPUT_CLASS}
                />
              </div>

              <Select value={stockSort} onValueChange={setStockSort}>
                <SelectTrigger className={cn(FILTER_TRIGGER, "w-full gap-2 sm:w-[170px]")}>
                  <ArrowUpDown className="size-4 shrink-0 text-[#666]" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-[#e7e7e7] shadow-lg">
                  {STOCK_SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-sm">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-sm text-[#666] whitespace-nowrap sm:ml-auto">
                {loading ? "Loading..." : `${cursorTable.pageInfo.total} results`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table cursorPagination={cursorTable} className="table-fixed min-w-[980px]">
              <colgroup>
                <col className="w-[56px]" />
                <col className="w-[200px]" />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[160px]" />
                <col className="w-[120px]" />
                <col className="w-[128px]" />
              </colgroup>
              <TableHeader>
                <TableRow className={TABLE_HEADER_ROW_CLASS}>
                  <TableHead className={HEAD_CLASS}>SL.</TableHead>
                  <TableHead className={HEAD_CLASS}>Product</TableHead>
                  <TableHead className={HEAD_CLASS}>Category</TableHead>
                  <TableHead className={HEAD_CLASS}>Quantity</TableHead>
                  <TableHead className={HEAD_CLASS}>Price</TableHead>
                  <TableHead className={HEAD_CLASS}>Supplier</TableHead>
                  <TableHead className={HEAD_CLASS}>Expiry</TableHead>
                  <TableHead className={HEAD_CLASS}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="px-4 py-10 text-sm text-muted-foreground">
                      Loading inventory...
                    </TableCell>
                  </TableRow>
                ) : inventory.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="px-4 py-10 text-sm text-muted-foreground">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : paginatedInventory.map((item, index) => (
                  <TableRow key={item.id} className={TABLE_ROW_CLASS}>
                    <TableCell className={cn(CELL_CLASS, "tabular-nums text-[#666]")}>
                      {cursorTable.pageInfo.from + index}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex min-w-0 items-center gap-2">
                        {item.stockQty <= item.minStockLevel && (
                          <span title="Low stock" className="inline-flex shrink-0">
                            <AlertTriangle className="size-4 text-amber-500" />
                          </span>
                        )}
                        <span className="truncate font-medium" title={item.name}>{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        {item.category}
                      </span>
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <span className={cn("font-medium tabular-nums", item.stockQty <= item.minStockLevel && "text-amber-600")}>
                        {item.stockQty}
                      </span>
                      <span className="ml-1 text-[11px] text-[#999]">(min: {item.minStockLevel})</span>
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "font-medium tabular-nums")}>
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "text-[#666]")}>
                      <span className="truncate" title={item.supplier}>{item.supplier}</span>
                    </TableCell>
                    <TableCell className={cn(CELL_CLASS, "text-[#666]")}>
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_VIEW}
                          aria-label="View item"
                          onClick={() => setViewItem(item)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_EDIT}
                          aria-label="Edit item"
                          onClick={() => setEditItem({ ...item })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={ACTION_DELETE}
                          aria-label="Delete item"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!loading && inventory.length > 0 && (
            <></>
          )}
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inventory Item Details</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-4 mt-4 pb-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">Name</Label><p className="font-medium">{viewItem.name}</p></div>
                <div><Label className="text-muted-foreground">Category</Label><p className="font-medium">{viewItem.category}</p></div>
                <div><Label className="text-muted-foreground">Quantity</Label><p className="font-medium">{viewItem.stockQty} (min: {viewItem.minStockLevel})</p></div>
                <div><Label className="text-muted-foreground">Price</Label><p className="font-medium">{formatCurrency(viewItem.unitPrice)}</p></div>
                <div><Label className="text-muted-foreground">Supplier</Label><p className="font-medium">{viewItem.supplier}</p></div>
                <div><Label className="text-muted-foreground">Expiry Date</Label><p className="font-medium">{viewItem.expiryDate ? new Date(viewItem.expiryDate).toLocaleDateString() : "—"}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent data-scroll-inside="true">
          <DialogHeader><DialogTitle>Edit Inventory Item</DialogTitle></DialogHeader>
          {editItem && (
            <>
              <div className="max-h-[65vh] overflow-y-auto pr-1">
                <div className="space-y-4 py-2">
                  <div><Label>Name <span className="text-destructive">*</span></Label><Input placeholder="e.g. Argan hair serum" className="mt-1" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} /></div>
                  <div>
                    <Label>Category <span className="text-destructive">*</span></Label>
                    <Select value={editItem.category} onValueChange={(value) => setEditItem({ ...editItem, category: value })}>
                      <SelectTrigger className="w-full mt-1 cursor-pointer"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem className="cursor-pointer" key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Quantity <span className="text-destructive">*</span></Label><Input placeholder="e.g. 20" className="mt-1" type="number" value={editItem.stockQty.toString()} onChange={(e) => setEditItem({ ...editItem, stockQty: parseInt(e.target.value) || 0 })} /></div>
                    <div><Label>Min Stock</Label><Input placeholder="e.g. 5" className="mt-1" type="number" value={editItem.minStockLevel.toString()} onChange={(e) => setEditItem({ ...editItem, minStockLevel: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Price (৳) <span className="text-destructive">*</span></Label><Input placeholder="e.g. 1500" className="mt-1" type="number" value={editItem.unitPrice.toString()} onChange={(e) => setEditItem({ ...editItem, unitPrice: parseFloat(e.target.value) || 0 })} /></div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Popover open={editExpiryOpen} onOpenChange={setEditExpiryOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full justify-start px-3 font-normal mt-1" accessAction="create">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className={editItem.expiryDate ? "text-foreground" : "text-muted-foreground"}>
                              {editItem.expiryDate ? format(new Date(`${editItem.expiryDate.toString().split('T')[0]}T00:00:00`), "PPP") : "Pick a date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                          <DateCalendar
                            mode="single"
                            selected={editItem.expiryDate ? new Date(`${editItem.expiryDate.toString().split('T')[0]}T00:00:00`) : undefined}
                            onSelect={(selected) => {
                              if (!selected) return
                              setEditItem({ ...editItem, expiryDate: format(selected, "yyyy-MM-dd") })
                              setEditExpiryOpen(false)
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div><Label>Supplier</Label><Input placeholder="e.g. Salon Supply Co." className="mt-1" value={editItem.supplier} onChange={(e) => setEditItem({ ...editItem, supplier: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter className="border-t border-border pt-3">
                <Button className="w-full" onClick={handleEditSave} disabled={submitting} accessAction="edit">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting} accessAction="delete">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
