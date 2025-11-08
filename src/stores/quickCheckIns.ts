import { defineStore } from 'pinia'
import { QuickCheckInsAPI } from '../lib/api'
import { useAuthStore } from './auth'

export type Metric = { metricId: string; name: string; unit?: string }
export type CheckIn = { checkInId: string; metric?: string; metricName?: string; unit?: string; value: number; timestamp?: number; at?: string }

export const useQuickCheckInsStore = defineStore('quickCheckIns', {
  state: () => ({
    metricsByName: new Map<string, Metric[]>(),
  allMetrics: [] as Metric[],
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
    })(),
    // Hidden metrics per owner (so one user can "delete" a metric label they don't use)
    hiddenByOwner: ((): Record<string, string[]> => {
      try {
        const raw = localStorage.getItem('qc_hiddenByOwner')
        const obj = raw ? JSON.parse(raw) : {}
        if (obj && typeof obj === 'object') return obj
      } catch {}
      return {}
    })(),
    initialized: false,
    metricsInitialized: false,
    _lastMetricsOwnerId: null as string | null
  }),
  actions: {
    // New: per-user storage key + helpers
    storageKeyFor(owner?: string | null) {
      const id = owner || useAuthStore().ownerId || '__none__'
      return `qc_allMetrics_${id}`
    },
    loadAllMetricsFromStorage() {
      try {
        const key = this.storageKeyFor()
        const raw = localStorage.getItem(key)
        if (!raw) { this.allMetrics = []; return }
        const arr = JSON.parse(raw)
        this.allMetrics = Array.isArray(arr) ? arr.filter((m: any) => m && typeof m.metricId === 'string') : []
      } catch { this.allMetrics = [] }
    },
    hiddenForOwner(owner?: string) {
      const key = owner || useAuthStore().ownerId || '__none__'
      const arr = this.hiddenByOwner[key] || []
      return new Set<string>(arr)
    },
    saveHidden() {
      try { localStorage.setItem('qc_hiddenByOwner', JSON.stringify(this.hiddenByOwner)) } catch {}
    },
    hideMetricForOwner(metricId: string, owner?: string) {
      const key = owner || useAuthStore().ownerId || '__none__'
      const arr = this.hiddenByOwner[key] || []
      if (!arr.includes(metricId)) {
        this.hiddenByOwner[key] = [...arr, metricId]
        this.saveHidden()
      }
      // Remove from visible collections
      this.allMetrics = this.allMetrics.filter(m => m.metricId !== metricId)
      for (const [name, list] of this.metricsByName.entries()) {
        this.metricsByName.set(name, list.filter(m => m.metricId !== metricId))
      }
      if (this.selectedMetricId === metricId) this.selectedMetricId = null
      this.saveAllMetrics()
    },
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
      // Filter by hidden metrics for the current owner
      const hidden = this.hiddenForOwner()
      this.allMetrics = result.filter(m => !hidden.has(m.metricId)).sort((a,b)=>a.name.localeCompare(b.name))
      this.saveAllMetrics()
    },
    async hydrateAllMetrics(force?: boolean) {
      const auth = useAuthStore()
      if (!auth.session) return
      // Reset guard if owner switched
      if (this._lastMetricsOwnerId !== auth.ownerId) {
        this.metricsInitialized = false
        this._lastMetricsOwnerId = auth.ownerId
        // Clear per-user caches and load that user's snapshot
        this.metricsByName = new Map<string, Metric[]>()
        this.allMetrics = []
        this.selectedMetricId = null
        this.loadAllMetricsFromStorage()
      }
      if (this.metricsInitialized && !force) return
      try {
        const list = await QuickCheckInsAPI.listMetricsForOwner({ owner: auth.ownerId || '' })
        const hidden = this.hiddenForOwner(auth.ownerId || undefined)
        this.allMetrics = (list || []).filter(m => !hidden.has(m.metricId)).sort((a,b)=>a.name.localeCompare(b.name))
        this.saveAllMetrics()
        this.metricsInitialized = true
      } catch {}
    },
    resetForOwnerChange() {
      // Clear in-memory caches when the active user changes
      this.metricsByName = new Map<string, Metric[]>()
      this.allMetrics = []
      this.selectedMetricId = null
      this.metricsInitialized = false
      this._lastMetricsOwnerId = useAuthStore().ownerId
      this.loadAllMetricsFromStorage()
    },
    saveOverrides() {
      try { localStorage.setItem('qc_timeOverrides', JSON.stringify(this.timeOverrides)) } catch {}
    },
    saveAllMetrics() {
      try {
        const key = this.storageKeyFor()
        localStorage.setItem(key, JSON.stringify(this.allMetrics))
      } catch {}
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
  async listCheckIns(params?: { metricName?: string; metricId?: string; startDate?: number; endDate?: number; force?: boolean }) {
      const auth = useAuthStore()
      if (!auth.session) throw new Error('session not set')
      // Only refresh when explicitly forced or not yet initialized.
      if (this.initialized && !params?.force) return
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
  const listRaw = await QuickCheckInsAPI.listByOwner({ owner: auth.ownerId || '', metricId: metricId, startDate: params?.startDate, endDate: params?.endDate })
  // Defensive: drop null/undefined and non-object elements to avoid runtime errors like "null is not an object (evaluating 'ci.metric')"
  const cleaned = Array.isArray(listRaw) ? listRaw.filter((x: any) => x && typeof x === 'object') : []
  const list = metricId
        ? cleaned.filter((ci: any) => (ci && (ci.metric === metricId || ci.metricId === metricId)))
        : cleaned
        // Normalize timestamps and names if present
        // Build metricId -> {name, unit} map from cache and server
        const metaMap = new Map<string, { name?: string; unit?: string }>()
        for (const [, arr] of this.metricsByName.entries()) {
          for (const m of arr) if (m.metricId) metaMap.set(m.metricId, { name: m.name, unit: m.unit })
        }
        for (const m of this.allMetrics) if (m.metricId) metaMap.set(m.metricId, { name: m.name, unit: m.unit })
        // Do not call listMetricsForOwner here; rely on initial hydration and metric mutations
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
  const norm = (list || []).filter(Boolean).map((ci: any) => {
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
        this.initialized = true
      }
    },
  async defineMetric(name: string) {
      this.loading = true
      this.error = null
      try {
  const { metricId } = await QuickCheckInsAPI.defineMetric({ name })
    // Merge newly created metric and dedupe
    this.mergeAllMetrics({ metricId, name })
  // Refresh metrics from server only on create
  try { this.metricsInitialized = false; await this.hydrateAllMetrics(true) } catch {}
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
  if (!auth.session) throw new Error('session not set')
      this.loading = true
      this.error = null
      try {
        try {
          const resp: any = await QuickCheckInsAPI.deleteMetric({ metricId, owner: auth.ownerId || '' })
          if (resp && typeof resp === 'object' && typeof resp.error === 'string' && resp.error) {
            throw new Error(resp.error)
          }
          // Success: remove globally for this view
          this.allMetrics = this.allMetrics.filter(m => m.metricId !== metricId)
          for (const [key, arr] of this.metricsByName.entries()) {
            this.metricsByName.set(key, arr.filter(m => m.metricId !== metricId))
          }
          if (this.selectedMetricId === metricId) this.selectedMetricId = null
          this.checkIns = this.checkIns.map(ci => ci.metric === metricId ? { ...ci, metricName: undefined } : ci)
          this.saveAllMetrics()
          // Re-hydrate from server only on delete
          try { this.metricsInitialized = false; await this.hydrateAllMetrics(true) } catch {}
          return true
        } catch (apiErr: any) {
          // If API deletion fails, allow per-owner hide when user has zero check-ins for that metric
          try {
            const list = await QuickCheckInsAPI.listByOwner({ owner: auth.ownerId || '', metricId })
            const hasAny = Array.isArray(list) && list.length > 0
            if (!hasAny) {
              this.hideMetricForOwner(metricId, auth.ownerId || undefined)
              return true
            }
          } catch {}
          throw apiErr
        }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to delete metric'
        return false
      } finally {
        this.loading = false
      }
    },
  async record(metricName: string, value: number, timestamp?: number) {
  const auth = useAuthStore()
  if (!auth.session) throw new Error('session not set')
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
  const { checkInId } = await QuickCheckInsAPI.record({ owner: auth.ownerId || '', metric: metricId, value, at: atIso })
        this.selectedMetricId = metricId
  // Force refresh list filtered by this metric id
  await this.listCheckIns({ metricId, force: true })
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
  if (!auth.session) throw new Error('session not set')
      this.loading = true
      this.error = null
      try {
        // If renaming metric name is requested, do it first (best-effort)
        if (newMetricName && newMetricName.trim()) {
          const ci = this.checkIns.find(x => x.checkInId === checkInId)
          const currentMetricId = ci?.metric
          if (currentMetricId) {
            try {
              await QuickCheckInsAPI.renameMetric({ metricId: currentMetricId, name: newMetricName.trim(), owner: auth.ownerId || '' })
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
  await QuickCheckInsAPI.edit({ owner: auth.ownerId || '', checkInId, newValue, newTimestamp })
  // Final refresh; force to include any server-side changes
  await this.listCheckIns({ metricId: this.selectedMetricId || undefined, force: true })
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
  if (!auth.session) throw new Error('session not set')
      this.loading = true
      this.error = null
      try {
        // Optimistically remove
        this.checkIns = this.checkIns.filter(ci => ci.checkInId !== checkInId)
  await QuickCheckInsAPI.deleteCheckIn({ owner: auth.ownerId || '', checkIn: checkInId })
  // Force refresh current view
  await this.listCheckIns({ metricId: this.selectedMetricId || undefined, force: true })
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
