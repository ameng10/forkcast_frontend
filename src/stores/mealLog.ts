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
  const stringFields = [obj.newAt, obj.at, obj.time, obj.when, (typeof obj.timestamp === 'string' ? obj.timestamp : undefined)]
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
    let res: any = await MealLogAPI.getMealsForOwner({ owner: auth.ownerId, includeDeleted: includeDeleted ?? this.includeDeleted })
  // If result is empty array or empty object/null, attempt spec-compliant fallback: fetch last 7 days via _getLogsForDate
  const isEmptyObject = res && typeof res === 'object' && !Array.isArray(res) && Object.keys(res).length === 0
  if ((Array.isArray(res) && res.length === 0) || !res || isEmptyObject) {
          const today = new Date()
          const collected: any[] = []
          for (let i = 0; i < 7; i++) {
            const d = new Date(today.getTime() - i * 86400000)
            const isoDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
            try {
        const dayLogs = await MealLogAPI.getLogsForDate({ user: auth.ownerId, date: isoDate })
              if (Array.isArray(dayLogs) && dayLogs.length) collected.push(...dayLogs)
            } catch {}
          }
          if (collected.length) res = collected
        }
        const toSummary = (x: any): MealSummary => {
          if (x == null) return { mealId: '' }
          if (typeof x === 'string') return { mealId: x }
      // Backend list shape: { meal: MealDocument }
          const doc = x.meal ? x.meal : x
      const mealId = String(doc?.mealId || doc?._id || doc?.meal || doc?.id || '')
          let at = normalizeMealTime(doc)
          // Prefer optimistic pending/override unconditionally to avoid snap-back while server catches up
          const p = this.pendingTimes[mealId]
          if (typeof p === 'number') at = p
          const ov = this.timeOverrides[mealId]
          if (typeof ov === 'number') at = ov
          // Spec items: [{ foodItem, name, quantity }]; map to existing MealItem shape preserving ids
          let items: MealItem[] | undefined
          if (Array.isArray(doc?.items)) {
            const mapped = doc.items
              .map((it: any) => {
                const nameVal = typeof it?.name === 'string' && it.name.trim() ? it.name.trim() : undefined
                const idSrc = (typeof it?.id === 'string' && it.id.trim()) ? it.id.trim() : (typeof it?.foodItem === 'string' && it.foodItem.trim() ? it.foodItem.trim() : undefined)
                const finalId = idSrc || nameVal
                if (!finalId) return null
                return { id: String(finalId), name: String(nameVal || finalId), quantity: it.quantity }
              })
              .filter(Boolean) as MealItem[]
            items = mapped
          }
          return { mealId, at, items }
        }
        let summaries: MealSummary[] = []
    if (Array.isArray(res)) summaries = res.map(toSummary)
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
    const rec = await MealLogAPI.getMealById({ meal: mealId })
    // Backend returns array of { meal: MealDocument }
    const bodyWrap = Array.isArray(rec) ? (rec[0] ?? {}) : (rec || {})
    const doc = bodyWrap.meal ? bodyWrap.meal : bodyWrap
        // Normalize time fields for current record (pick the newest across aliases)
    const serverAt = normalizeMealTime(doc)
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
    this.current = { mealId, ...(doc || {}), ...(at != null ? { at } : {}) }
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
    // Map MealItem[] (with synthetic type item) to backend FoodItem[] (exclude type item)
        const foodItems = items
          .map(it => {
            const nameVal = typeof it.name === 'string' && it.name.trim() ? it.name.trim() : undefined
            const idSrc = (typeof it.id === 'string' && it.id.trim()) ? it.id.trim() : (nameVal ? nameVal : undefined)
            if (!idSrc) return null
            return { id: idSrc, name: String(nameVal || idSrc) }
          })
          .filter(Boolean) as Array<{ id: string; name: string }>
    const atDate = new Date(at)
    const { mealId } = await MealLogAPI.submit({ owner: auth.ownerId, at: atDate, items: foodItems, notes })
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
        const mapped = effItems
          ? (effItems
              .map(it => {
                const nameVal = typeof it.name === 'string' && it.name.trim() ? it.name.trim() : undefined
                const idSrc = (typeof it.id === 'string' && it.id.trim()) ? it.id.trim() : (nameVal ? nameVal : undefined)
                if (!idSrc) return null
                return { id: idSrc, name: String(nameVal || idSrc) }
              })
              .filter(Boolean) as Array<{ id: string; name: string }>)
          : undefined
  const atMaybe = at ? new Date(at) : undefined
  await MealLogAPI.edit({ caller: auth.ownerId, meal: mealId, ...(mapped ? { items: mapped } : {}), ...(effNotes !== undefined ? { notes: effNotes } : {}), ...(atMaybe ? { at: atMaybe } : {}) })
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
  await MealLogAPI.delete({ caller: auth.ownerId, meal: mealId })
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
