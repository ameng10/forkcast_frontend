import { defineStore } from 'pinia'
import { QuickCheckInsAPI } from '../lib/api'
import { useAuthStore } from './auth'

export type Metric = { metricId: string; name: string; unit?: string }
export type CheckIn = { checkInId: string; metric?: string; metricName?: string; value: number; timestamp?: number; at?: string }

export const useQuickCheckInsStore = defineStore('quickCheckIns', {
  state: () => ({
    metricsByName: new Map<string, Metric[]>(),
    checkIns: [] as CheckIn[],
    loading: false,
    error: null as string | null,
    selectedMetricId: null as string | null,
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
    saveOverrides() {
      try { localStorage.setItem('qc_timeOverrides', JSON.stringify(this.timeOverrides)) } catch {}
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
        // Build a metricId -> name map from any cached metrics we have
        const nameMap = new Map<string, string>()
        for (const [n, arr] of this.metricsByName.entries()) {
          for (const m of arr) if (m.metricId) nameMap.set(m.metricId, m.name)
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
          return {
            checkInId: id,
            metric: ci.metric,
            metricName: ci.metricName || (ci.metric ? nameMap.get(ci.metric) : undefined),
            value: ci.value,
            timestamp: ts,
            at: atIso
          }
        })
        this.checkIns = norm.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load check-ins'
      } finally {
        this.loading = false
      }
    },
    async defineMetric(name: string, unit: string) {
      this.loading = true
      this.error = null
      try {
        const { metricId } = await QuickCheckInsAPI.defineMetric({ name })
        // Refresh metrics cache for this name and select it
        await this.loadMetrics(name)
        this.selectedMetricId = metricId
        return metricId
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to define metric'
        throw e
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
          const metrics = this.metricsByName.get(metricName) || await QuickCheckInsAPI.getMetricsByName({ name: metricName })
          metricId = metrics?.[0]?.metricId
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
  async edit(checkInId: string, newValue: number, newTimestamp?: number) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
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
          this.checkIns[idx] = { ...ci, value: newValue, timestamp: ts, at: ts ? new Date(ts).toISOString() : ci.at }
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
    }
  }
})
