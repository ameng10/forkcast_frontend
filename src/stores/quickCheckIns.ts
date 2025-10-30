import { defineStore } from 'pinia'
import { QuickCheckInsAPI } from '../lib/api'
import { useAuthStore } from './auth'

export type Metric = { metricId: string; name: string; unit?: string }
export type CheckIn = { checkInId: string; metric?: string; metricName?: string; unit?: string; value: number; timestamp?: number; at?: string }

export const useQuickCheckInsStore = defineStore('quickCheckIns', {
  state: () => ({
    metricsByName: new Map<string, Metric[]>(),
    allMetrics: ((): Metric[] => {
      try {
        const raw = localStorage.getItem('qc_allMetrics')
        if (!raw) return []
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return arr.filter(m => m && typeof m.metricId === 'string')
      } catch {}
      return []
    })(),
    checkIns: [] as CheckIn[],
    loading: false,
    error: null as string | null,
    selectedMetricId: null as string | null,
  sortBy: 'time' as 'time' | 'metricName',
    pendingTimes: {} as Record<string, number>,
    timeOverrides: ((): Record<string, number> => {
      try {
        const raw = localStorage.getItem('qc_timeOverrides')
        const obj = raw ? JSON.parse(raw) : {}
        if (obj && typeof obj === 'object') return obj
      } catch {}
      return {}
    })()
  }),
  actions: {
    mergeAllMetrics(incoming: Metric | Metric[]) {
      const items = Array.isArray(incoming) ? incoming : [incoming]
      // Merge by metricId preserving existing unit when incoming is undefined
      const merged: Metric[] = [...this.allMetrics]
      for (const m of items) {
        if (!m || !m.metricId) continue
        const idx = merged.findIndex(x => x.metricId === m.metricId)
        if (idx >= 0) {
          const curr = merged[idx]
          merged[idx] = {
            metricId: curr.metricId,
            name: m.name || curr.name,
            unit: m.unit !== undefined ? m.unit : curr.unit
          }
        } else {
          merged.push({ metricId: m.metricId, name: m.name, unit: m.unit })
        }
      }
      // Dedupe by name (case-insensitive): prefer entry with a unit
      const byName = new Map<string, Metric[]>()
      for (const m of merged) {
        const key = (m.name || '').toLowerCase()
        const arr = byName.get(key) || []
        arr.push(m); byName.set(key, arr)
      }
      const result: Metric[] = []
      const keepIds = new Set<string>()
      for (const arr of byName.values()) {
        if (arr.length === 1) {
          keepIds.add(arr[0].metricId)
        } else {
          // pick with unit, else first
          const withUnit = arr.find(x => x.unit && String(x.unit).length > 0)
          const winner = withUnit || arr[0]
          keepIds.add(winner.metricId)
        }
      }
      for (const m of merged) if (keepIds.has(m.metricId)) result.push(m)
      this.allMetrics = result.sort((a,b)=>a.name.localeCompare(b.name))
      this.saveAllMetrics()
    },
    async hydrateAllMetrics() {
      const auth = useAuthStore()
      if (!auth.ownerId) return
      try {
        const list = await QuickCheckInsAPI.listMetricsForOwner({ owner: auth.ownerId })
        // Merge with any existing to preserve potential client-side info
        const merged = [...this.allMetrics]
        for (const m of list) {
          const idx = merged.findIndex(x => x.metricId === m.metricId)
          if (idx >= 0) merged[idx] = { ...merged[idx], ...m }
          else merged.push(m)
        }
        this.allMetrics = merged.sort((a,b)=>a.name.localeCompare(b.name))
        this.saveAllMetrics()
      } catch {}
    },
    saveOverrides() {
      try { localStorage.setItem('qc_timeOverrides', JSON.stringify(this.timeOverrides)) } catch {}
    },
    saveAllMetrics() {
      try { localStorage.setItem('qc_allMetrics', JSON.stringify(this.allMetrics)) } catch {}
    },
    normalizeCheckInTime(obj: any): number | undefined {
      if (!obj) return undefined
      // precedence: at (iso) or timestamp in ms/seconds
      if (typeof obj.at === 'string') {
        const p = Date.parse(obj.at); if (!Number.isNaN(p)) return p
      }
      const num = (v: any) => (v == null ? undefined : Number(v))
      const cand = num(obj.timestamp) ?? num(obj.ts) ?? num(obj.date)
      if (cand != null) return cand < 1e12 ? cand * 1000 : cand
      return undefined
    },
    async loadMetrics(name: string) {
      this.loading = true
      this.error = null
      try {
  const metrics = await QuickCheckInsAPI.getMetricsByName({ name })
  this.metricsByName.set(name, metrics)
  this.mergeAllMetrics(metrics)
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load metrics'
      } finally {
        this.loading = false
      }
    },
  async listCheckIns(params?: { metricName?: string; metricId?: string; startDate?: number; endDate?: number }) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        // Resolve metric ID if a metric name was provided
        let metricId = params?.metricId || this.selectedMetricId || undefined
        if (params?.metricName !== undefined) {
          const name = params.metricName.trim()
          if (name) {
            const metrics = await QuickCheckInsAPI.getMetricsByName({ name })
            metricId = metrics?.[0]?.metricId
            // Update cache for rendering names later
            if (metrics && metrics.length) {
              const existing = this.metricsByName.get(name) || []
              const merged = [...existing]
              for (const m of metrics) {
                if (!merged.find(x => x.metricId === m.metricId)) merged.push(m)
              }
              this.metricsByName.set(name, merged)
            }
            this.selectedMetricId = metricId || null
          } else {
            // Empty name clears selection
            this.selectedMetricId = null
            metricId = undefined
          }
        }
  const listRaw = await QuickCheckInsAPI.listByOwner({ owner: auth.ownerId, metricId: metricId, startDate: params?.startDate, endDate: params?.endDate })
  const list = metricId ? (listRaw || []).filter((ci: any) => (ci.metric === metricId) || (ci.metricId === metricId)) : (listRaw || [])
        // Normalize timestamps and names if present
        // Build metricId -> {name, unit} map from cache and server
        const metaMap = new Map<string, { name?: string; unit?: string }>()
        for (const [, arr] of this.metricsByName.entries()) {
          for (const m of arr) if (m.metricId) metaMap.set(m.metricId, { name: m.name, unit: m.unit })
        }
        for (const m of this.allMetrics) if (m.metricId) metaMap.set(m.metricId, { name: m.name, unit: m.unit })
        // Hydrate from server to ensure units are available
        try {
          const all = await QuickCheckInsAPI.listMetricsForOwner({ owner: auth.ownerId })
          // merge, prefer existing units when incoming lacks unit
          this.mergeAllMetrics(all)
          for (const m of this.allMetrics) metaMap.set(m.metricId, { name: m.name, unit: m.unit })
        } catch {}
    // Fallback: if we have a selectedMetricId but no meta, try loading by the current cache keys
    if (this.selectedMetricId && !metaMap.get(this.selectedMetricId)) {
          // Attempt to hydrate by known names in cache
          try {
            for (const [key] of this.metricsByName.entries()) {
              const arr = await QuickCheckInsAPI.getMetricsByName({ name: key })
      for (const m of arr) if (m.metricId) metaMap.set(m.metricId, { name: m.name, unit: m.unit })
            }
          } catch {}
        }
        const norm = (list || []).map((ci: any) => {
          let ts = this.normalizeCheckInTime(ci)
          const id = ci.checkInId || ci._id || ci.id
          // Apply pending/overrides for stability
          const p = this.pendingTimes[id]
          if (typeof p === 'number') ts = p
          const ov = this.timeOverrides[id]
          if (typeof ov === 'number') ts = ov
          const atIso = ts ? new Date(ts).toISOString() : (ci.at || undefined)
          const mId = ci.metric || ci.metricId
          const meta = mId ? metaMap.get(mId) : undefined
          return {
            checkInId: id,
            metric: mId,
            metricName: ci.metricName || (mId ? meta?.name : undefined),
            unit: ci.unit || meta?.unit,
            value: ci.value,
            timestamp: ts,
            at: atIso
          }
        })
        // Update allMetrics from observed check-ins
        const observed = new Map<string, string>()
        for (const ci of norm) if (ci.metric && ci.metricName) observed.set(ci.metric, ci.metricName)
        for (const [metricId2, name] of observed.entries()) {
          this.mergeAllMetrics({ metricId: metricId2, name })
        }

        // Apply sort
  if (this.sortBy === 'metricName') {
          this.checkIns = norm.sort((a, b) => (a.metricName || '').localeCompare(b.metricName || '') || ((b.timestamp || 0) - (a.timestamp || 0)))
        } else {
          this.checkIns = norm.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load check-ins'
      } finally {
        this.loading = false
      }
    },
  async defineMetric(name: string) {
      this.loading = true
      this.error = null
      try {
    const { metricId } = await QuickCheckInsAPI.defineMetric({ name })
    // Merge newly created metric and dedupe
    this.mergeAllMetrics({ metricId, name })
  // Optionally refresh from server to pick up any server-side normalization
  try { await this.hydrateAllMetrics() } catch {}
        this.selectedMetricId = metricId
        return metricId
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to define metric'
        throw e
      } finally {
        this.loading = false
      }
    },
    async renameMetric(metricId: string, newName: string) {
      this.loading = true
      this.error = null
      try {
        const auth = useAuthStore()
        await QuickCheckInsAPI.renameMetric({ metricId, name: newName, owner: auth.ownerId || undefined })
        // Update caches
  this.allMetrics = this.allMetrics.map(m => m.metricId === metricId ? { ...m, name: newName } : m).sort((a,b)=>a.name.localeCompare(b.name))
  this.saveAllMetrics()
        for (const [key, arr] of this.metricsByName.entries()) {
          this.metricsByName.set(key, arr.map(m => m.metricId === metricId ? { ...m, name: newName } : m))
        }
        // Update visible list labels
        this.checkIns = this.checkIns.map(ci => ci.metric === metricId ? { ...ci, metricName: newName } : ci)
        return true
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to rename metric'
        return false
      } finally { this.loading = false }
    },
    async deleteMetric(metricId: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        const resp: any = await QuickCheckInsAPI.deleteMetric({ metricId, owner: auth.ownerId })
        if (resp && typeof resp === 'object' && typeof resp.error === 'string' && resp.error) {
          throw new Error(resp.error)
        }
  this.allMetrics = this.allMetrics.filter(m => m.metricId !== metricId)
        for (const [key, arr] of this.metricsByName.entries()) {
          this.metricsByName.set(key, arr.filter(m => m.metricId !== metricId))
        }
        if (this.selectedMetricId === metricId) this.selectedMetricId = null
        this.checkIns = this.checkIns.map(ci => ci.metric === metricId ? { ...ci, metricName: undefined } : ci)
  this.saveAllMetrics()
        // Re-hydrate from server to keep parity
        try { await this.hydrateAllMetrics() } catch {}
        return true
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to delete metric'
        return false
      } finally {
        this.loading = false
      }
    },
    async record(metricName: string, value: number, timestamp?: number) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        // Resolve metric ID: look up by name in cache if available
        let metricId = this.selectedMetricId
        if (!metricId) {
          // Try cache by exact name
          const metrics = this.metricsByName.get(metricName) || await QuickCheckInsAPI.getMetricsByName({ name: metricName })
          metricId = metrics?.[0]?.metricId
          // Try global list (local cache) by case-insensitive name
          if (!metricId && this.allMetrics.length) {
            const m = this.allMetrics.find(m => (m.name || '').toLowerCase() === metricName.toLowerCase())
            if (m) metricId = m.metricId
          }
        }
        if (!metricId) throw new Error('Metric not found; define it first')
        const atIso = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
        const { checkInId } = await QuickCheckInsAPI.record({ owner: auth.ownerId, metric: metricId, value, at: atIso })
        this.selectedMetricId = metricId
        // Refresh list filtered by this metric id
        await this.listCheckIns({ metricId })
        return checkInId
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to record check-in'
        throw e
      } finally {
        this.loading = false
      }
  },
    async edit(checkInId: string, newValue: number, newTimestamp?: number, newMetricName?: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        // If renaming metric name is requested, do it first (best-effort)
        if (newMetricName && newMetricName.trim()) {
          const ci = this.checkIns.find(x => x.checkInId === checkInId)
          const currentMetricId = ci?.metric
          if (currentMetricId) {
            try {
              await QuickCheckInsAPI.renameMetric({ metricId: currentMetricId, name: newMetricName.trim(), owner: auth.ownerId })
              // Update caches and visible list
              this.allMetrics = this.allMetrics.map(m => m.metricId === currentMetricId ? { ...m, name: newMetricName.trim() } : m).sort((a,b)=>a.name.localeCompare(b.name))
              for (const [key, arr] of this.metricsByName.entries()) {
                this.metricsByName.set(key, arr.map(m => m.metricId === currentMetricId ? { ...m, name: newMetricName.trim() } : m))
              }
              // Update in-memory row label immediately
              const idx = this.checkIns.findIndex(ci2 => ci2.checkInId === checkInId)
              if (idx >= 0) this.checkIns[idx] = { ...this.checkIns[idx], metricName: newMetricName.trim() }
            } catch (e: any) {
              // Keep editing but surface a message; rename can be reattempted later
              this.error = e?.message ?? 'Failed to rename metric'
            }
          }
        }
        // Optimistic/persistent update
        if (newTimestamp != null && !Number.isNaN(newTimestamp)) {
          this.pendingTimes[checkInId] = newTimestamp
          this.timeOverrides[checkInId] = newTimestamp
          this.saveOverrides()
        }
        // Update in-memory list immediately
        const idx = this.checkIns.findIndex(ci => ci.checkInId === checkInId)
        if (idx >= 0) {
          const ci = this.checkIns[idx]
          const ts = newTimestamp ?? ci.timestamp
          this.checkIns[idx] = { ...ci, value: newValue, timestamp: ts, at: ts ? new Date(ts).toISOString() : ci.at, ...(newMetricName ? { metricName: newMetricName.trim() } : {}) }
          this.checkIns = [...this.checkIns].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        }
        await QuickCheckInsAPI.edit({ owner: auth.ownerId, checkInId, newValue, newTimestamp })
        // Final refresh will keep overrides applied to avoid snap-back
        await this.listCheckIns({ metricId: this.selectedMetricId || undefined })
  return true
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to edit check-in'
  return false
      } finally {
        this.loading = false
      }
    },
    async deleteCheckIn(checkInId: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        // Optimistically remove
        this.checkIns = this.checkIns.filter(ci => ci.checkInId !== checkInId)
        await QuickCheckInsAPI.deleteCheckIn({ owner: auth.ownerId, checkIn: checkInId })
        // Refresh current view
        await this.listCheckIns({ metricId: this.selectedMetricId || undefined })
        return true
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to delete check-in'
        return false
      } finally {
        this.loading = false
      }
    }
  }
})
