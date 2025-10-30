import { defineStore } from 'pinia'
import { MealLogAPI } from '../lib/api'
import { useAuthStore } from './auth'

export type MealItem = { id?: string; name?: string; [k: string]: any }
export type MealRecord = { mealId: string; at?: string | number; date?: string | number; items?: MealItem[]; notes?: string; [k: string]: any }
export type MealSummary = { mealId: string; at?: string | number; items?: MealItem[] }

// Normalize a meal-like object's time by inspecting multiple fields and returning the most recent time (ms since epoch)
function normalizeMealTime(obj: any): number | undefined {
  if (!obj) return undefined
  // Precedence order: explicit meal time first (string ISO-like), then ms fields, then seconds fields.
  const stringFields = [obj.newAt, obj.at, obj.time, obj.when]
  for (const v of stringFields) {
    if (typeof v === 'string') {
      const p = Date.parse(v)
      if (!Number.isNaN(p)) return p
    }
  }
  const msFields = [obj.newDate, obj.date]
  for (const v of msFields) {
    if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
    if (typeof v === 'string') {
      const n = Number(v)
      if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n
    }
  }
  const secFields = [obj.newTimestamp, obj.timestamp]
  for (const v of secFields) {
    if (typeof v === 'number') return v * 1000
    if (typeof v === 'string') {
      const n = Number(v)
      if (!Number.isNaN(n)) return n * 1000
    }
  }
  // Fallback: updatedAt only if nothing else present
  if (obj.updatedAt != null) {
    if (typeof obj.updatedAt === 'number') return obj.updatedAt < 1e12 ? obj.updatedAt * 1000 : obj.updatedAt
    if (typeof obj.updatedAt === 'string') {
      const p = Date.parse(obj.updatedAt)
      if (!Number.isNaN(p)) return p
    }
  }
  return undefined
}

export const useMealLogStore = defineStore('mealLog', {
  state: () => ({
  meals: [] as MealSummary[], // store summaries for list view
    current: null as MealRecord | null,
    loading: false,
    error: null as string | null,
  includeDeleted: false,
  // Local optimistic timestamps by mealId (ms)
    pendingTimes: {} as Record<string, number>,
    // Persistent overrides to make edited times stick across reloads if backend doesn't persist
    timeOverrides: ((): Record<string, number> => {
      try {
        const raw = localStorage.getItem('mealLog_timeOverrides')
        const obj = raw ? JSON.parse(raw) : {}
        if (obj && typeof obj === 'object') return obj
      } catch {}
      return {}
    })()
  }),
  actions: {
    saveOverrides() {
      try { localStorage.setItem('mealLog_timeOverrides', JSON.stringify(this.timeOverrides)) } catch {}
    },
    async listForOwner(includeDeleted?: boolean) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        const res = await MealLogAPI.getMealsForOwner({ ownerId: auth.ownerId, includeDeleted: includeDeleted ?? this.includeDeleted })
        const toSummary = (x: any): MealSummary => {
          if (x == null) return { mealId: '' }
          if (typeof x === 'string') return { mealId: x }
          const mealId = String(x.mealId || x.id || x._id || x.mealObjectId || x.mealDocumentId || '')
          let at = normalizeMealTime(x)
          // Prefer optimistic pending/override unconditionally to avoid snap-back while server catches up
          const p = this.pendingTimes[mealId]
          if (typeof p === 'number') at = p
          const ov = this.timeOverrides[mealId]
          if (typeof ov === 'number') at = ov
          const items = Array.isArray(x.items) ? x.items as MealItem[] : undefined
          return { mealId, at, items }
        }
        let summaries: MealSummary[] = []
        if (Array.isArray(res)) {
          summaries = (res as any[]).map(toSummary)
        } else if (res && Array.isArray((res as any).mealIds)) {
          summaries = ((res as any).mealIds as any[]).map(toSummary)
        } else if (res && typeof res === 'object') {
          summaries = Object.values(res as Record<string, any>).map(toSummary)
        }
        // Sort by time desc if available
        this.meals = summaries
          .filter(s => !!s.mealId)
          .sort((a, b) => {
            const ta = typeof a.at === 'number' ? a.at : (a.at ? Date.parse(String(a.at)) : 0)
            const tb = typeof b.at === 'number' ? b.at : (b.at ? Date.parse(String(b.at)) : 0)
            return (tb || 0) - (ta || 0)
          })
  // Keep Selected Meal in sync with the latest list timestamp
        if (this.current?.mealId) {
          const s = this.meals.find(m => m.mealId === this.current!.mealId)
          if (s?.at) {
            const cur = typeof this.current.at === 'number' ? this.current.at : (this.current.at ? Date.parse(String(this.current.at)) : 0)
            const sAt = typeof s.at === 'number' ? s.at : (s.at ? Date.parse(String(s.at)) : 0)
            // Only update Selected Meal if the list has a newer timestamp; never downgrade
            if (sAt && (!cur || sAt > cur)) {
              this.current = { ...(this.current as any), at: sAt }
            }
          }
        }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load meals'
      } finally { this.loading = false }
    },
    async fetchById(mealId: string, expectedAtMs?: number) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        const rec = await MealLogAPI.getMealById({ mealId, callerId: auth.ownerId })
        // Some backends wrap in array for queries
        const body = Array.isArray(rec) ? (rec[0] ?? {}) : (rec || {})
        // Normalize time fields for current record (pick the newest across aliases)
        const serverAt = normalizeMealTime(body)
        let at = serverAt
        // Prefer expected/pending time unconditionally for stability
        const p = expectedAtMs ?? this.pendingTimes[mealId]
        if (typeof p === 'number') at = p
        // Apply persistent override last
        const ov = this.timeOverrides[mealId]
        if (typeof ov === 'number') at = ov
        // If server now matches our pending/override (within 1s), clear them
        const nearlyEqual = (a?: number, b?: number) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1000 : false)
        if (serverAt && (nearlyEqual(serverAt, p) || nearlyEqual(serverAt, ov))) {
          if (this.pendingTimes[mealId]) delete this.pendingTimes[mealId]
          if (this.timeOverrides[mealId]) { delete this.timeOverrides[mealId]; this.saveOverrides() }
          at = serverAt
        }
        this.current = { mealId, ...(body || {}), ...(at != null ? { at } : {}) }
        return this.current
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to fetch meal'
        throw e
      } finally { this.loading = false }
    },
    async submit(at: string, items: MealItem[], notes?: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        const { mealId } = await MealLogAPI.submit({ ownerId: auth.ownerId, at, items, notes })
        await this.listForOwner()
        return mealId
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to submit meal'
        throw e
      } finally { this.loading = false }
    },
  async edit(mealId: string, items?: MealItem[], notes?: string, at?: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
    // Fill missing fields from current to avoid server dropping fields
    const effItems = items !== undefined ? items : (this.current?.mealId === mealId ? (this.current.items as MealItem[] | undefined) : undefined)
    const effNotes = notes !== undefined ? notes : (this.current?.mealId === mealId ? (this.current.notes as string | undefined) : undefined)
    // Optimistically set pending time and update current/list immediately
    let expected: number | undefined
  if (at) {
      const ts = Date.parse(at)
      if (!Number.isNaN(ts)) {
        expected = ts
        this.pendingTimes[mealId] = ts
    this.timeOverrides[mealId] = ts
    this.saveOverrides()
        if (this.current?.mealId === mealId) {
          this.current = { ...(this.current as any), at: ts }
        }
        const idx = this.meals.findIndex(m => m.mealId === mealId)
        if (idx >= 0) this.meals[idx].at = ts
      }
    }
    await MealLogAPI.edit({ callerId: auth.ownerId, mealId, ...(effItems !== undefined ? { items: effItems } : {}), ...(effNotes !== undefined ? { notes: effNotes } : {}), ...(at ? { at } : {}) })
  // Pass expected time so fetch won't revert visually
  await this.fetchById(mealId, expected)
  // Retry briefly if server hasn't reflected new time yet
  if (expected) {
    const maxTries = 3
    for (let i = 0; i < maxTries; i++) {
      const cur = this.current?.at
      const curMs = typeof cur === 'number' ? cur : (cur ? Date.parse(String(cur)) : 0)
      if (curMs && curMs >= expected) break
      await new Promise(res => setTimeout(res, 300))
      await this.fetchById(mealId, expected)
    }
  }
  // If still not updated and we have a target time, last-resort: create new meal then delete old
  if (expected) {
    const cur = this.current?.at
    const curMs = typeof cur === 'number' ? cur : (cur ? Date.parse(String(cur)) : 0)
    if (!curMs || curMs < expected) {
      // Create replacement with desired time, then delete old
      const newAtIso = new Date(expected).toISOString()
      const newId = await this.submit(newAtIso, effItems || [], effNotes)
      if (newId) {
        // Carry override to the new id
        this.timeOverrides[newId] = expected
        this.saveOverrides()
        // Cleanup old override
        if (this.timeOverrides[mealId]) { delete this.timeOverrides[mealId]; this.saveOverrides() }
        await this.remove(mealId)
        // Focus UI on new meal
        await this.fetchById(newId)
      }
    }
  }
  // Refresh list so meal log reflects updated time and resort
  await this.listForOwner()
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to edit meal'
        throw e
      } finally { this.loading = false }
    },
    async remove(mealId: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        await MealLogAPI.delete({ callerId: auth.ownerId, mealId })
        if (this.current?.mealId === mealId) this.current = null
  if (this.pendingTimes[mealId]) delete this.pendingTimes[mealId]
  if (this.timeOverrides[mealId]) { delete this.timeOverrides[mealId]; this.saveOverrides() }
        await this.listForOwner()
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to delete meal'
        throw e
      } finally { this.loading = false }
    }
  }
})
