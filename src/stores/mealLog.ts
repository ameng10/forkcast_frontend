import { defineStore } from 'pinia'
import { MealLogAPI } from '../lib/api'
import { useAuthStore } from './auth'

export type MealItem = { id?: string; name?: string; [k: string]: any }
export type MealRecord = { mealId: string; at?: string; items?: MealItem[]; notes?: string; [k: string]: any }

export const useMealLogStore = defineStore('mealLog', {
  state: () => ({
    meals: [] as string[], // store mealIds from getMealsForOwner
    current: null as MealRecord | null,
    loading: false,
    error: null as string | null,
    includeDeleted: false
  }),
  actions: {
    async listForOwner(includeDeleted?: boolean) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        const res = await MealLogAPI.getMealsForOwner({ ownerId: auth.ownerId, includeDeleted: includeDeleted ?? this.includeDeleted })
        // Support array or object response
        if (Array.isArray(res)) {
          this.meals = res as unknown as string[]
        } else {
          this.meals = (res?.mealIds as string[]) || []
        }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load meals'
      } finally { this.loading = false }
    },
    async fetchById(mealId: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
  const rec = await MealLogAPI.getMealById({ mealId, callerId: auth.ownerId })
  // Some backends wrap in array for queries
  const body = Array.isArray(rec) ? (rec[0] ?? {}) : (rec || {})
  this.current = { mealId, ...(body || {}) }
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
    async edit(mealId: string, items: MealItem[], notes?: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        await MealLogAPI.edit({ callerId: auth.ownerId, mealId, items, notes })
        await this.fetchById(mealId)
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
        await this.listForOwner()
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to delete meal'
        throw e
      } finally { this.loading = false }
    }
  }
})
