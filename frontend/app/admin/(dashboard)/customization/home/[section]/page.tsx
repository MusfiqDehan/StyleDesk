"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Image as ImageIcon, Plus, X, Upload, Video, Sparkles, Compass, Building2 } from "lucide-react"
import {
  getWhyChooseUsImages,
  updateWhyChooseUsImages,
  getAppreciateExcellence,
  upsertAppreciateExcellence,
  getBeginYourJourney,
  upsertBeginYourJourney,
  getSisterConcernsAdmin,
  upsertSisterConcerns,
} from "@admin/api/settings/settings"
import { toast } from '@/lib/toast'
import { getMediaUrl } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SISTER_CONCERNS_DEFAULTS } from "@/lib/sister-concerns"
import axios from "axios"
import { AdminPageHeader } from "@admin/components/admin-page-header"

const HOME_SECTIONS = {
  "why-choose-us": {
    label: "Why Choose Us",
    description: "Four images displayed in the signature experience section of your home page",
    icon: ImageIcon,
  },
  "appreciate-excellence": {
    label: "Appreciate Excellence",
    description: "Showcase video displayed prominently on the home page",
    icon: Sparkles,
  },
  "begin-your-journey": {
    label: "Begin Your Journey",
    description: "Background image for the CTA section at the bottom of the home page",
    icon: Compass,
  },
  "sister-concerns": {
    label: "Sister Concerns",
    description: "Partner brand block shown above the footer on the home page",
    icon: Building2,
  },
} as const

type HomeSectionId = keyof typeof HOME_SECTIONS

function isHomeSectionId(value: string): value is HomeSectionId {
  return value in HOME_SECTIONS
}

export default function HomeSectionCustomizationPage() {
  const params = useParams<{ section: string }>()
  const sectionId = params.section

  if (!sectionId || !isHomeSectionId(sectionId)) {
    return (
      <div className={DASH_PAGE}>
        <h1 className="text-2xl font-semibold text-foreground">Section not found</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a home section from the Customization menu in the sidebar.
        </p>
      </div>
    )
  }

  const meta = HOME_SECTIONS[sectionId]

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader title={meta.label} subtitle={meta.description} />

      {sectionId === "why-choose-us" && <WhyChooseUsSection />}
      {sectionId === "appreciate-excellence" && <AppreciateExcellenceSection />}
      {sectionId === "begin-your-journey" && <BeginYourJourneySection />}
      {sectionId === "sister-concerns" && <SisterConcernsEditor />}
    </div>
  )
}

function WhyChooseUsSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [whyChooseUsData, setWhyChooseUsData] = useState<any>(null)
  const [selectedFiles, setSelectedFiles] = useState<(File | null)[]>([null, null, null, null])
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null, null])

  useEffect(() => {
    getWhyChooseUsImages()
      .then((value) => {
        if (!value) return
        setWhyChooseUsData(value)
        setPreviews([
          value.image1 || null,
          value.image2 || null,
          value.image3 || null,
          value.image4 || null,
        ])
      })
      .catch(() => toast.error("Failed to load Why Choose Us images"))
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const newFiles = [...selectedFiles]
    newFiles[index] = file
    setSelectedFiles(newFiles)
    const reader = new FileReader()
    reader.onloadend = () => {
      const newPreviews = [...previews]
      newPreviews[index] = reader.result as string
      setPreviews(newPreviews)
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePreview = (index: number) => {
    const newFiles = [...selectedFiles]
    newFiles[index] = null
    setSelectedFiles(newFiles)
    const newPreviews = [...previews]
    newPreviews[index] = whyChooseUsData?.[`image${index + 1}`] || null
    setPreviews(newPreviews)
  }

  const handleSave = async () => {
    if (!selectedFiles.some((f) => f !== null)) {
      toast.info("No changes to save")
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      selectedFiles.forEach((file, index) => {
        if (file) formData.append(`image${index + 1}`, file)
      })
      const response = await updateWhyChooseUsImages(formData)
      if (response) {
        setWhyChooseUsData(response)
        setPreviews([
          response.image1 || null,
          response.image2 || null,
          response.image3 || null,
          response.image4 || null,
        ])
        setSelectedFiles([null, null, null, null])
      }
      toast.success("Images updated successfully")
    } catch {
      toast.error("Failed to update images")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Section images</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Upload or replace the four gallery images</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !selectedFiles.some((f) => f !== null)} accessAction="edit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Upload className="w-4 h-4 mr-2" />
          Upload Images
        </Button>
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Image {index + 1}
                </Label>
                {selectedFiles[index] && (
                  <button onClick={() => handleRemovePreview(index)} className="text-destructive hover:text-destructive/80 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="relative group aspect-[4/5] rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/30 hover:bg-muted/40">
                {previews[index] ? (
                  <>
                    <img src={getMediaUrl(previews[index]!)} alt={`Preview ${index + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium transition-all transform translate-y-2 group-hover:translate-y-0">
                        Change Image
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(index, e)} />
                      </label>
                    </div>
                    {selectedFiles[index] && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        NEW
                      </div>
                    )}
                  </>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2 p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-foreground/70">Add Image</span>
                    <span className="text-[10px] text-muted-foreground">PNG, JPG or WEBP</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(index, e)} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg flex gap-3">
          <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">!</div>
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-0.5">Slot-based upload</p>
            <p className="opacity-90">Images are saved by position. Only slots with a newly selected file will be updated on the server.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppreciateExcellenceSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ videoFile: File | null; videoUrl?: string }>({ videoFile: null })

  useEffect(() => {
    getAppreciateExcellence()
      .then((value) => {
        if (!value) return
        setForm({ videoFile: null, videoUrl: value.videoUrl })
      })
      .catch(() => toast.error("Failed to load excellence video"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!form.videoFile && !form.videoUrl) {
      toast.error("Please upload a video")
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      if (form.videoFile) formData.append("video", form.videoFile)
      const response = await upsertAppreciateExcellence(formData)
      if (response) setForm({ videoFile: null, videoUrl: response.videoUrl })
      toast.success("Excellence record updated successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to save appreciation record")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Upload Video</p>
            <div className="relative group aspect-video rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden hover:border-primary/40 transition-all">
              {form.videoFile ? (
                <div className="text-center p-4">
                  <Video className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium truncate max-w-[250px]">{form.videoFile.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Ready to upload</p>
                  <button
                    onClick={() => setForm({ ...form, videoFile: null })}
                    className="text-xs text-destructive hover:underline mt-2 font-medium"
                  >
                    Replace Video
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 p-6 text-center w-full h-full justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-foreground/70">Click to upload video</span>
                  <span className="text-xs text-muted-foreground">MP4, WebM or MOV · Max 50 MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setForm({ ...form, videoFile: file })
                    }}
                  />
                </label>
              )}
            </div>
            <div className="p-4 bg-brand-soft border border-blue-100 rounded-lg flex gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-200 text-brand-deep flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">i</div>
              <p className="text-xs text-blue-800 leading-relaxed">
                This video highlights your salon&apos;s major achievements and is shown on the public home page.
              </p>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving || (!form.videoFile && !form.videoUrl)} accessAction="edit">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Excellence Settings
            </Button>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current Live Preview</p>
            <div className="rounded-xl border border-border overflow-hidden bg-muted/20 shadow-sm">
              <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
                {form.videoUrl ? (
                  <video key={form.videoUrl} src={getMediaUrl(form.videoUrl)} className="w-full h-full object-cover" controls />
                ) : (
                  <div className="text-center p-8">
                    <Video className="w-12 h-12 text-slate-700 mx-auto mb-3 opacity-20" />
                    <p className="text-slate-500 text-sm italic">No video uploaded yet</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 bg-muted/30 border-t border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Home Page Showcase Video</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BeginYourJourneySection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState<{ imageFile: File | null; imageUrl?: string }>({ imageFile: null })

  useEffect(() => {
    getBeginYourJourney()
      .then((value) => {
        if (!value) return
        setForm({ imageFile: null, imageUrl: value.imageUrl || undefined })
        if (value.imageUrl) setPreview(value.imageUrl)
      })
      .catch(() => toast.error("Failed to load journey background"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!form.imageFile) {
      toast.error("Please upload an image first")
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("image", form.imageFile)
      const response = await upsertBeginYourJourney(formData)
      if (response) {
        setForm({ imageFile: null, imageUrl: response.imageUrl || undefined })
        if (response.imageUrl) setPreview(response.imageUrl)
        toast.success("Begin Your Journey background image updated successfully")
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to save Begin Your Journey background image")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Background image</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Used as the full-width CTA background on the home page</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !form.imageFile} accessAction="edit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Background Image</p>
            <div className="relative group aspect-[16/9] rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/30 hover:bg-muted/30">
              {preview ? (
                <>
                  <img src={getMediaUrl(preview)} alt="Journey Background Preview" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all">
                      Change Background Image
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setForm({ ...form, imageFile: file })
                          const reader = new FileReader()
                          reader.onloadend = () => setPreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                  </div>
                  {form.imageFile && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      NEW — UNSAVED
                    </div>
                  )}
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 p-6 text-center w-full h-full justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-foreground/70">Click to upload background image</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG or WEBP · Max 10 MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setForm({ ...form, imageFile: file })
                      const reader = new FileReader()
                      reader.onloadend = () => setPreview(reader.result as string)
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <div className="space-y-4 flex flex-col justify-center">
            <div className="p-5 bg-brand-soft border border-blue-100 rounded-xl flex gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-200 text-brand-deep flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">i</div>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Where it appears</p>
                <p className="opacity-90 leading-relaxed">
                  This image is used as the full-width background of the <strong>Begin Your Journey</strong> CTA section at the bottom of the home landing page.
                </p>
              </div>
            </div>
            <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">!</div>
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Automatic clean-up</p>
                <p className="opacity-90 leading-relaxed">
                  The previous background file is automatically deleted from the server when you upload a new one.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SisterConcernsEditor() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string>(SISTER_CONCERNS_DEFAULTS.imageUrl)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    aboveText: SISTER_CONCERNS_DEFAULTS.aboveText,
    mainText: SISTER_CONCERNS_DEFAULTS.mainText,
    subText: SISTER_CONCERNS_DEFAULTS.subText,
    buttonText: SISTER_CONCERNS_DEFAULTS.buttonText,
    buttonLink: SISTER_CONCERNS_DEFAULTS.buttonLink,
    imageUrl: SISTER_CONCERNS_DEFAULTS.imageUrl,
  })

  useEffect(() => {
    getSisterConcernsAdmin()
      .then((value) => {
        if (!value || typeof value !== "object") {
          setPreview(SISTER_CONCERNS_DEFAULTS.imageUrl)
          return
        }
        setForm({
          aboveText: value.aboveText || SISTER_CONCERNS_DEFAULTS.aboveText,
          mainText: value.mainText || SISTER_CONCERNS_DEFAULTS.mainText,
          subText: value.subText || SISTER_CONCERNS_DEFAULTS.subText,
          buttonText: value.buttonText || SISTER_CONCERNS_DEFAULTS.buttonText,
          buttonLink: value.buttonLink || SISTER_CONCERNS_DEFAULTS.buttonLink,
          imageUrl: value.imageUrl || SISTER_CONCERNS_DEFAULTS.imageUrl,
        })
        setPreview(value.imageUrl || SISTER_CONCERNS_DEFAULTS.imageUrl)
      })
      .catch(() => toast.error("Failed to load Sister Concerns settings"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("aboveText", form.aboveText)
      formData.append("mainText", form.mainText)
      formData.append("subText", form.subText)
      formData.append("buttonText", form.buttonText)
      formData.append("buttonLink", form.buttonLink)
      if (imageFile) formData.append("image", imageFile)

      const response = await upsertSisterConcerns(formData)
      if (response) {
        setForm({
          aboveText: response.aboveText || form.aboveText,
          mainText: response.mainText || form.mainText,
          subText: response.subText || form.subText,
          buttonText: response.buttonText || form.buttonText,
          buttonLink: response.buttonLink || form.buttonLink,
          imageUrl: response.imageUrl || form.imageUrl,
        })
        if (response.imageUrl) {
          setPreview(response.imageUrl)
          setImageFile(null)
        }
      }
      toast.success("Sister Concerns section updated successfully")
    } catch (error) {
      const rawMessage = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | string[] | undefined)
        : undefined
      const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage
      toast.error(message || "Failed to save Sister Concerns section")
    } finally {
      setSaving(false)
    }
  }

  const previewSrc = preview.startsWith("data:") || preview.startsWith("blob:") || preview.startsWith("/")
    ? preview
    : getMediaUrl(preview) || preview

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Section content</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Shown above the footer on the home page. Wrap words in *asterisks* for italic emphasis in the main heading.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} accessAction="edit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Section
        </Button>
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sc-above">Above Text</Label>
              <Input
                id="sc-above"
                placeholder="Sister Concerns"
                value={form.aboveText}
                onChange={(e) => setForm({ ...form, aboveText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-main">Main Text</Label>
              <Input
                id="sc-main"
                placeholder="Meher by *Samina Sara*"
                value={form.mainText}
                onChange={(e) => setForm({ ...form, mainText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-sub">Sub Text</Label>
              <Textarea placeholder="e.g. Discover more beauty experiences from our family of brands."
                id="sc-sub"
                rows={4}
                value={form.subText}
                onChange={(e) => setForm({ ...form, subText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-btn-text">Button Text</Label>
              <Input
                id="sc-btn-text"
                placeholder="Visit Meher"
                value={form.buttonText}
                onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-btn-link">Button Link</Label>
              <Input
                id="sc-btn-link"
                placeholder="https://www.meherbd.com/"
                value={form.buttonLink}
                onChange={(e) => setForm({ ...form, buttonLink: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Section Image</Label>
            <div className="relative group aspect-[570/405] rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/30 hover:bg-muted/30">
              {previewSrc ? (
                <>
                  <img src={previewSrc} alt="Sister Concerns preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all">
                      Change Image
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setImageFile(file)
                          const reader = new FileReader()
                          reader.onloadend = () => setPreview(reader.result as string)
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                  </div>
                  {imageFile && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      NEW — UNSAVED
                    </div>
                  )}
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 p-6 text-center w-full h-full justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-foreground/70">Click to upload image</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImageFile(file)
                      const reader = new FileReader()
                      reader.onloadend = () => setPreview(reader.result as string)
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG or WebP · Max 10 MB</p>
          </div>
        </div>
      </div>
    </div>
  )
}
