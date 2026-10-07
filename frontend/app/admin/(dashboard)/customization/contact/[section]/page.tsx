"use client"
import { DASH_PAGE } from "@admin/components/dash/styles"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, MessageSquare } from "lucide-react"
import {
  getBusinessInfo,
  updateBusinessInfo,
  resolveMapEmbedUrl,
  type BusinessInfo,
} from "@admin/api/settings/settings"
import { toast } from '@/lib/toast'
import { useBusiness } from "@/context/BusinessContext"
import {
  getMapEmbedUrlIssue,
  isGoogleMapsShortLink,
  parseGoogleMapsUrlToEmbed,
  toGoogleMapsEmbedUrl,
} from "@/lib/google-maps-embed"
import axios from "axios"
import { AdminPageHeader } from "@admin/components/admin-page-header"

const CONTACT_SECTIONS = {
  "contact-section": {
    label: "Contact Section",
    description: "Heading, description, and map shown on the public Contact page",
    icon: MessageSquare,
  },
} as const

type ContactSectionId = keyof typeof CONTACT_SECTIONS

function isContactSectionId(value: string): value is ContactSectionId {
  return value in CONTACT_SECTIONS
}

export default function ContactSectionCustomizationPage() {
  const params = useParams<{ section: string }>()
  const sectionId = params.section

  if (!sectionId || !isContactSectionId(sectionId)) {
    return (
      <div className={DASH_PAGE}>
        <h1 className="text-2xl font-semibold text-foreground">Section not found</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a contact section from the Customization menu in the sidebar.
        </p>
      </div>
    )
  }

  const meta = CONTACT_SECTIONS[sectionId]

  return (
    <div className={DASH_PAGE}>
      <AdminPageHeader
        eyebrow="Customization"
        breadcrumbs={[
          { label: "Contact", href: "/admin/customization/contact" },
          { label: meta.label },
        ]}
        title={meta.label}
        subtitle={meta.description}
      />

      {sectionId === "contact-section" && <ContactSectionEditor />}
    </div>
  )
}

function ContactSectionEditor() {
  const { refresh: refreshBusiness, businessInfo } = useBusiness()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resolvingMap, setResolvingMap] = useState(false)
  const [mapResolveFailed, setMapResolveFailed] = useState(false)
  const [previewEmbedUrl, setPreviewEmbedUrl] = useState("")
  const [form, setForm] = useState<Pick<BusinessInfo, "contactSectionTitle" | "contactSectionDescription" | "mapEmbedUrl">>({
    contactSectionTitle: "",
    contactSectionDescription: "",
    mapEmbedUrl: "",
  })

  const mapUrlIssue = useMemo(
    () => (form.mapEmbedUrl?.trim() ? getMapEmbedUrlIssue(form.mapEmbedUrl) : null),
    [form.mapEmbedUrl],
  )

  useEffect(() => {
    getBusinessInfo()
      .then((value) => {
        if (!value) return
        setForm({
          contactSectionTitle: value.contactSectionTitle || "",
          contactSectionDescription: value.contactSectionDescription || "",
          mapEmbedUrl: value.mapEmbedUrl || "",
        })
        setPreviewEmbedUrl(
          toGoogleMapsEmbedUrl(value.mapEmbedUrl, value.address || businessInfo?.address),
        )
      })
      .catch(() => toast.error("Failed to load contact section settings"))
      .finally(() => setLoading(false))
  }, [businessInfo?.address])

  useEffect(() => {
    const raw = form.mapEmbedUrl?.trim()
    if (!raw) {
      setPreviewEmbedUrl(toGoogleMapsEmbedUrl("", businessInfo?.address))
      return
    }

    const direct = parseGoogleMapsUrlToEmbed(raw)
    if (direct) {
      setMapResolveFailed(false)
      setPreviewEmbedUrl(direct)
      return
    }

    if (!isGoogleMapsShortLink(raw)) {
      setMapResolveFailed(Boolean(getMapEmbedUrlIssue(raw)))
      setPreviewEmbedUrl(toGoogleMapsEmbedUrl(raw, businessInfo?.address))
      return
    }

    let cancelled = false
    setResolvingMap(true)
    setMapResolveFailed(false)
    resolveMapEmbedUrl(raw)
      .then((embedUrl) => {
        if (!cancelled) {
          setMapResolveFailed(false)
          setPreviewEmbedUrl(embedUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapResolveFailed(true)
          setPreviewEmbedUrl(toGoogleMapsEmbedUrl("", businessInfo?.address))
        }
      })
      .finally(() => {
        if (!cancelled) setResolvingMap(false)
      })

    return () => {
      cancelled = true
    }
  }, [form.mapEmbedUrl, businessInfo?.address])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await updateBusinessInfo(form)
      if (response) {
        setForm({
          contactSectionTitle: response.contactSectionTitle || "",
          contactSectionDescription: response.contactSectionDescription || "",
          mapEmbedUrl: response.mapEmbedUrl || "",
        })
        setPreviewEmbedUrl(
          toGoogleMapsEmbedUrl(response.mapEmbedUrl, businessInfo?.address),
        )
      }
      await refreshBusiness()
      toast.success("Contact section updated successfully")
    } catch (error) {
      const rawMessage = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | string[] | undefined)
        : undefined
      const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage
      toast.error(message || "Failed to update contact section")
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
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Section content</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          These fields control the main contact block below the hero on the public Contact page.
        </p>
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 gap-5 max-w-2xl">
          <div className="space-y-1.5">
            <Label htmlFor="contact-title">Section Title</Label>
            <Input
              id="contact-title"
              placeholder="Let's Plan Your Next Beauty Experience"
              value={form.contactSectionTitle || ""}
              onChange={(e) => setForm({ ...form, contactSectionTitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-description">Section Description</Label>
            <Textarea
              id="contact-description"
              placeholder="Reach out for appointments, package consultation, and tailored beauty recommendations."
              value={form.contactSectionDescription || ""}
              onChange={(e) => setForm({ ...form, contactSectionDescription: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-map-url">Google Map URL</Label>
            <Input
              id="contact-map-url"
              placeholder="https://maps.app.goo.gl/... or embed URL from Google Maps"
              value={form.mapEmbedUrl || ""}
              onChange={(e) => setForm({ ...form, mapEmbedUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Paste a Google Maps share link (e.g. maps.app.goo.gl) or an embed URL. Short links are auto-converted on save.
              For best results: Google Maps → Share → <strong>Embed a map</strong> → copy the iframe <code className="text-[11px]">src</code> URL.
            </p>
            {mapResolveFailed && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                Could not convert this link to an embeddable map. Open Google Maps → Share → <strong>Embed a map</strong> and paste the iframe <code className="text-[11px]">src</code> URL instead.
              </p>
            )}
            {mapUrlIssue && !mapResolveFailed && !isGoogleMapsShortLink(form.mapEmbedUrl || "") && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                {mapUrlIssue}
              </p>
            )}
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Map preview
              </p>
              <div className="relative h-56 overflow-hidden rounded-xl border border-border bg-muted/20">
                {resolvingMap && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <iframe
                  title="Map preview"
                  src={previewEmbedUrl}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-4 border-t border-border bg-muted/20 rounded-b-xl flex justify-end">
        <Button onClick={handleSave} disabled={saving} accessAction="edit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Contact Section
        </Button>
      </div>
    </div>
  )
}
