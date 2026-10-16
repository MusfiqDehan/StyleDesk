interface AuthSnapshot<T> { user: T | null; loading: boolean }

/** One live bootstrap per account/branch, shared by every mounted consumer. */
export function createAuthStore<T>({ getScope, loadUser, listen, isVisible }: {
  getScope: () => string | null
  loadUser: () => Promise<T>
  listen: (refresh: () => void) => () => void
  isVisible: () => boolean
}) {
  const initial: AuthSnapshot<T> = { user: null, loading: true }
  let snapshot = initial
  let scope: string | null = null
  let fingerprint = ""
  let generation = 0
  let pending: { scope: string; promise: Promise<void> } | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let unlisten: (() => void) | undefined
  const subscribers = new Set<() => void>()
  const publish = (user: T | null, loading: boolean) => {
    const nextFingerprint = JSON.stringify(user)
    if (snapshot.loading === loading && fingerprint === nextFingerprint) return
    snapshot = { user: fingerprint === nextFingerprint ? snapshot.user : user, loading }
    fingerprint = nextFingerprint
    subscribers.forEach((notify) => notify())
  }
  const refresh = (): Promise<void> => {
    const nextScope = getScope()
    if (nextScope !== scope) {
      scope = nextScope
      generation++
      pending = null
      publish(null, !!scope)
    }
    if (!nextScope) { publish(null, false); return Promise.resolve() }
    if (pending?.scope === nextScope) return pending.promise
    const requestGeneration = generation
    const promise = loadUser().then((user) => {
      if (generation === requestGeneration && getScope() === nextScope) publish(user, false)
    }).catch(() => {
      if (generation === requestGeneration && getScope() === nextScope) publish(null, false)
    }).finally(() => {
      if (pending?.promise === promise) pending = null
    })
    pending = { scope: nextScope, promise }
    return promise
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    refresh,
    subscribe(notify: () => void) {
      subscribers.add(notify)
      if (subscribers.size === 1) {
        void refresh()
        timer = setInterval(() => { if (isVisible()) void refresh() }, 15000)
        unlisten = listen(() => { void refresh() })
      }
      return () => {
        subscribers.delete(notify)
        if (!subscribers.size) {
          clearInterval(timer)
          unlisten?.()
          generation++
          pending = null
        }
      }
    },
  }
}
