import api from '../base'
import axios from 'axios'
import { CACHE, markStale } from '@admin/lib/cache'

const TTL = 24 * 60 * 60 * 1000 // 24 hours — settings change very rarely

// Raw axios instance — bypasses the cache interceptor (needed for multipart uploads)
const rawApi = axios.create({ baseURL: api.defaults.baseURL, withCredentials: true })

export interface BusinessInfo {
  primaryColor?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  contactSectionTitle?: string;
  contactSectionDescription?: string;
  mapEmbedUrl?: string;
  logoUrl?: string | null;
  /** Hide public marketing site; visitors see administration login instead. */
  hideMainWebsite?: boolean;
  /** Packages catalog order (admin + public /packages). */
  packagesSortOrder?: 'newest' | 'oldest' | 'price_high' | 'price_low';
  /** Services catalog order (admin + public /services). */
  servicesSortOrder?: 'newest' | 'oldest' | 'price_high' | 'price_low';
}

export interface InvoiceSetting {
  defaultCurrency?: string;
  taxRate?: number;
}

export interface AppointmentSetting {
  openingTime?: string;
  closingTime?: string;
  defaultSlotDuration?: number;
  advanceBookingWindow?: number;
}

// Business Info
export async function getBusinessInfo(): Promise<BusinessInfo> {
  const { data } = await api.get('/bussiness-info', { cache: false, timeout: 8000 })
  return data
}

export async function uploadBusinessLogo(file: File): Promise<BusinessInfo> {
  const formData = new FormData()
  formData.append('file', file)
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
  const { data } = await rawApi.post('/bussiness-info/upload-logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  markStale(CACHE.BUSINESS_INFO, CACHE.DASHBOARD)
  return data
}

export async function updateBusinessInfo(businessData: BusinessInfo) {
  const payload: BusinessInfo = {}
  const {
    primaryColor,
    businessName,
    email,
    phone,
    address,
    gstNumber,
    contactSectionTitle,
    contactSectionDescription,
    mapEmbedUrl,
    hideMainWebsite,
    packagesSortOrder,
    servicesSortOrder,
  } = businessData
  if (primaryColor !== undefined) payload.primaryColor = primaryColor
  if (businessName !== undefined && businessName !== '') payload.businessName = businessName
  if (email !== undefined && email !== '') payload.email = email
  if (phone !== undefined && phone !== '') payload.phone = phone
  if (address !== undefined && address !== '') payload.address = address
  if (gstNumber !== undefined && gstNumber !== '') payload.gstNumber = gstNumber
  if (contactSectionTitle !== undefined && contactSectionTitle !== '') payload.contactSectionTitle = contactSectionTitle
  if (contactSectionDescription !== undefined && contactSectionDescription !== '') payload.contactSectionDescription = contactSectionDescription
  if (mapEmbedUrl !== undefined && mapEmbedUrl !== '') payload.mapEmbedUrl = mapEmbedUrl
  if (typeof hideMainWebsite === 'boolean') payload.hideMainWebsite = hideMainWebsite
  if (packagesSortOrder !== undefined) payload.packagesSortOrder = packagesSortOrder
  if (servicesSortOrder !== undefined) payload.servicesSortOrder = servicesSortOrder
  const keys=Object.keys(payload);const contactKeys=['contactSectionTitle','contactSectionDescription','mapEmbedUrl'];
  const route=keys.length===1&&keys[0]==='servicesSortOrder'?'/bussiness-info/sort/services':keys.length===1&&keys[0]==='packagesSortOrder'?'/bussiness-info/sort/packages':keys.length&&keys.every(key=>contactKeys.includes(key))?'/bussiness-info/contact':'/bussiness-info';
  const { data } = await api.patch(route, payload)
  markStale(CACHE.BUSINESS_INFO, CACHE.DASHBOARD)
  return data
}

/** Lightweight public flag for edge/proxy checks. */
export async function getSiteVisibility(): Promise<{ hideMainWebsite: boolean }> {
  const { data } = await api.get('/bussiness-info/site-visibility', { cache: false })
  return data ?? { hideMainWebsite: false }
}

export async function resolveMapEmbedUrl(url: string): Promise<string> {
  const { data } = await api.post('/bussiness-info/resolve-map-embed', { url })
  return data.embedUrl
}

// Invoice Settings
export async function getInvoiceSettings(): Promise<InvoiceSetting> {
  const { data } = await api.get('/invoice-setting', { cache: false })
  return data
}

export async function updateInvoiceSettings(invoiceData: InvoiceSetting) {
  const { defaultCurrency, taxRate } = invoiceData
  const { data } = await api.patch('/invoice-setting', { defaultCurrency, taxRate })
  markStale(CACHE.INVOICE_SETTING, CACHE.BILLING)
  return data
}

// Appointment Settings
export async function getAppointmentSettings(): Promise<AppointmentSetting> {
  const { data } = await api.get('/appointment-setting', { cache: false })
  return data
}

export async function updateAppointmentSettings(appointmentData: AppointmentSetting) {
  const { openingTime, closingTime, defaultSlotDuration, advanceBookingWindow } = appointmentData
  const { data } = await api.patch('/appointment-setting', { openingTime, closingTime, defaultSlotDuration, advanceBookingWindow })
  markStale(CACHE.APPOINTMENT_SETTING, CACHE.APPOINTMENTS)
  return data
}

// Why Choose Us Images
export async function getWhyChooseUsImages() {
  const { data } = await api.get('/why-choose-us-image', { cache: false })
  return data
}

export async function updateWhyChooseUsImages(formData: FormData) {
  const { data } = await api.patch('/why-choose-us-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}
// Appreciate Excellence
export async function getAppreciateExcellence() {
  const { data } = await api.get('/appreciate-excellence', { cache: false })
  return data
}

export async function upsertAppreciateExcellence(formData: FormData) {
  const { data } = await api.post('/appreciate-excellence', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

// Begin Your Journey
export async function getBeginYourJourney() {
  const { data } = await api.get('/begin-your-journey', { cache: false })
  return data
}

export async function upsertBeginYourJourney(formData: FormData) {
  const { data } = await api.put('/begin-your-journey', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return data
}

// Sister Concerns
export async function getSisterConcernsAdmin() {
  const { data } = await api.get('/sister-concerns', { cache: false })
  if (!data || typeof data !== 'object') return null
  return data
}

export async function upsertSisterConcerns(formData: FormData) {
  const { data } = await api.post('/sister-concerns', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

