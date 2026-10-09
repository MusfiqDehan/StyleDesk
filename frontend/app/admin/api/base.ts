import axios from 'axios'
import { selectedBranch } from '@/lib/branch-selection'
import { setupCache, buildMemoryStorage } from 'axios-cache-interceptor'

const isServerSide = typeof window === 'undefined'

const apiBaseURL = '/api/backend'

const axiosInstance = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  timeout: 15000,
})

axiosInstance.interceptors.request.use((config) => {
  if (!isServerSide) {
    const branch = selectedBranch()
    if (branch) config.headers.set('X-Branch-Id', branch)
    const device = sessionStorage.getItem('deviceId')
    if (device) config.headers.set('X-Device-Id', device)
    if (sessionStorage.getItem('allBranches') === 'true' && /^\/(dashboard|reports|staff-reports)(\/|$)/.test(config.url || '') && (!config.method || config.method === 'get')) config.headers.set('X-All-Branches', 'true')
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Sensitive responses must not persist across accounts or browser sessions.
// Disable caching until endpoints have explicit per-user cache isolation.
const storage = buildMemoryStorage()
if (!isServerSide) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('aci:')) localStorage.removeItem(key)
    }
  } catch { /* Storage may be unavailable in private browsing. */ }
}

/** Never persist empty list responses — they stick after DB seeds/resets. */
function isEmptyListPayload(data: unknown): boolean {
  if (data == null) return true
  if (Array.isArray(data)) return data.length === 0
  if (typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (Array.isArray(body.data)) return body.data.length === 0
    if (Array.isArray(body.items)) return body.items.length === 0
    if (Array.isArray(body.results)) return body.results.length === 0
  }
  return false
}

const api = setupCache(axiosInstance, {
  storage,
  ttl: 5 * 60 * 1000,    // 5 min default — overridden per endpoint below
  methods: [],
  interpretHeader: false,  // never let server Cache-Control shorten our TTL
  staleIfError: false, // Never show protected data after an authorization failure
  cachePredicate: {
    statusCheck: (status) => status >= 200 && status < 400,
    responseMatch: ({ data }) => !isEmptyListPayload(data),
  },
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try { await axios.post(`${apiBaseURL}/auth/logout`, undefined, { withCredentials: true, timeout: 5000 }) } catch { }
      // Always drop the stale token — otherwise every subsequent request keeps attaching
      // it (via the request interceptor above), and a rejected user session gets "stuck"
      // silently retrying with credentials the server has already refused.
      if (!isServerSide) {
        try { localStorage.removeItem('accessToken') } catch { }
        // Only force redirect if the user is actually inside the admin section
        if (window.location.pathname.startsWith('/admin')) {
          window.location.replace('/login')
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
