import { defineStore } from 'pinia'
import { PersonalQAAPI } from '../lib/api'
import { useAuthStore } from './auth'

export type Fact = { factId: string; fact: string }
export type QA = { question: string; answer: string }

export const usePersonalQAStore = defineStore('personalQA', {
  state: () => ({
    facts: [] as Fact[],
    qas: [] as QA[],
    loading: false,
    error: null as string | null
  }),
  actions: {
    async refreshFacts() {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        this.facts = await PersonalQAAPI.getUserFacts({ owner: auth.ownerId })
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load facts'
      } finally { this.loading = false }
    },
    async refreshQAs() {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
        this.qas = await PersonalQAAPI.getUserQAs({ owner: auth.ownerId })
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load Q&A history'
      } finally { this.loading = false }
    },
    async ingestFact(text: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
  await PersonalQAAPI.ingestFact({ owner: auth.ownerId, fact: text })
        await this.refreshFacts()
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to add fact'
        throw e
      } finally { this.loading = false }
    },
    async forgetFact(factId: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true
      this.error = null
      try {
  await PersonalQAAPI.forgetFact({ owner: auth.ownerId, factId })
        await this.refreshFacts()
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to forget fact'
        throw e
      } finally { this.loading = false }
    },
    async ask(question: string) {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      if (this.loading) return ''
      this.loading = true
      this.error = null
      try {
    const q = (question || '').trim()
    if (!q) throw new Error('Question cannot be empty')
  // Backend expects only `requester`
  const { answer } = await PersonalQAAPI.ask({ requester: auth.ownerId, question: q })
        await this.refreshQAs()
        return answer
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to ask question'
        throw e
      } finally { this.loading = false }
    }
  }
})
