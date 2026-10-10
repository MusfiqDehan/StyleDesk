import api from '../base'
import { CACHE, consumeStale } from '@admin/lib/cache'

const TTL = 1 * 60 * 1000 // 1 min — reports data should update frequently

export async function getReports(from: string, to: string, noCache = false) {
  const override = noCache || consumeStale(CACHE.REPORTS)
  const { data } = await api.get('/reports', {
    id: `${CACHE.REPORTS}:${from}:${to}`,
    params: { from, to },
    cache: noCache ? false : { ttl: TTL, override },
  })
  return data
}
