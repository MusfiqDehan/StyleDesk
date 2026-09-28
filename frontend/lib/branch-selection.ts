export function selectedBranch(): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie.split('; ').find(value => value.startsWith('branchId='))?.slice(9) || null
}
export function selectBranch(id: string) {
  document.cookie = `branchId=${encodeURIComponent(id)}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
  // Reload clears React state, held checkout data and browser API caches.
  for (const key of Object.keys(localStorage)) if (key !== 'accessToken' && key !== 'theme') localStorage.removeItem(key)
  sessionStorage.clear()
  location.reload()
}
