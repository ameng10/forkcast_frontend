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
      const clean = (text || '').toString().trim()
      if (!clean) throw new Error('Fact cannot be empty')
      this.loading = true
      this.error = null
      try {
        await PersonalQAAPI.ingestFact({ owner: auth.ownerId, fact: clean })
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
        // Optimistically remove from local list
        this.facts = this.facts.filter(f => f.factId !== factId)
        // Soft refresh in background (don't block UI if it fails)
        try { await this.refreshFacts() } catch {}
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
        const q = (question || '').toString().trim()
        if (!q) throw new Error('Question cannot be empty')
        // Ensure facts are loaded so upstream can use them
        if (this.facts.length === 0) { try { await this.refreshFacts() } catch {} }
        // Proactively clean any blank/null facts that can crash backend .toLowerCase
        const badFacts = (this.facts || []).filter(f => {
          const t = (f?.fact ?? '').toString().trim().toLowerCase()
          return !t || t === 'null' || t === 'undefined'
        })
        if (badFacts.length) {
          const owner = auth.ownerId
          await Promise.allSettled(badFacts
            .filter(f => !!f.factId)
            .map(f => PersonalQAAPI.forgetFact({ owner, factId: f.factId })))
          try { await this.refreshFacts() } catch {}
        }
        // Backend expects only `requester`
        const { answer } = await PersonalQAAPI.ask({ requester: auth.ownerId, question: q })
        await Promise.allSettled([this.refreshQAs(), this.refreshFacts()])
        return answer
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to ask question'
        throw e
      } finally { this.loading = false }
    }
  }
})
