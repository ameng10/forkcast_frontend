import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { PersonalQAAPI } from '../lib/api'

export type Fact = { factId: string; fact: string; source?: string; at?: string }
export type ChatMessage = { role: 'user' | 'assistant'; text: string }

export const usePersonalQAStore = defineStore('personalQA', {
  state: () => ({
    facts: [] as Fact[],
    messages: [] as ChatMessage[],
    loading: false,
    error: null as string | null,
    asking: false,
  }),
  actions: {
    resetChat() { this.messages = []; this.error = null },
    pushUser(text: string) { this.messages.push({ role: 'user', text }) },
    pushAssistant(text: string) { this.messages.push({ role: 'assistant', text }) },

    // Minimal preflight: ensure no broken facts (null/blank text or null source) remain server-side
    async sanitizeFacts() {
      const auth = useAuthStore(); if (!auth.ownerId) return
      try {
        const facts = await PersonalQAAPI.getUserFacts({ owner: auth.ownerId }) as Array<{ factId: string; fact: string; source?: string }>
        for (const f of (facts || [])) {
          const id = f?.factId ? String(f.factId) : ''
          const txt = typeof f?.fact === 'string' ? f.fact.trim() : ''
          const src = typeof (f as any)?.source === 'string' ? (f as any).source.trim() : ''
          const txtBad = !txt || txt.toLowerCase() === 'null' || txt.toLowerCase() === 'undefined'
          const srcBad = !src || src.toLowerCase() === 'null' || src.toLowerCase() === 'undefined'
          if (txtBad) {
            if (id) { try { await PersonalQAAPI.forgetFact({ owner: auth.ownerId, factId: id }) } catch {} }
            continue
          }
      if (srcBad) {
            try {
        const { factId: newId } = await PersonalQAAPI.ingestFact({ owner: auth.ownerId, fact: txt, source: 'insight' })
              if (id) { try { await PersonalQAAPI.forgetFact({ owner: auth.ownerId, factId: id }) } catch {} }
            } catch {
              if (id) { try { await PersonalQAAPI.forgetFact({ owner: auth.ownerId, factId: id }) } catch {} }
            }
          }
        }
      } catch { /* best effort */ }
      try { await this.refreshFacts() } catch {}
      // Second pass: remove any facts still missing source
      try {
        const auth2 = useAuthStore();
        for (const f of this.facts) {
          const txt = (f?.fact || '').trim()
          const src = (f?.source || '').trim()
          const id = (f?.factId || '').trim()
          const txtBad = !txt || txt.toLowerCase() === 'null' || txt.toLowerCase() === 'undefined'
          const srcBad = !src || src.toLowerCase() === 'null' || src.toLowerCase() === 'undefined'
          if (txtBad || srcBad) {
            if (id) {
              try { await PersonalQAAPI.forgetFact({ owner: auth2.ownerId!, factId: id }) } catch {}
            }
          }
        }
  } catch {}
  // Refresh after removal attempts to sync local state
  try { await this.refreshFacts() } catch {}
      // Verify no broken facts remain locally
      const stillBad = this.facts.some(f => {
        const txt = (f?.fact || '').trim()
        const src = (f?.source || '').trim()
        return !txt || !src
      })
      if (stillBad) throw new Error('Found invalid facts')
    },

    async refreshFacts() {
      const auth = useAuthStore(); if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true; this.error = null
      try {
        const list = await PersonalQAAPI.getUserFacts({ owner: auth.ownerId })
        const out: Fact[] = []
        for (const f of (list || [])) {
          if (!f) continue
          const id = String((f as any).factId || '')
          const text = typeof (f as any).fact === 'string' ? (f as any).fact : ''
          const src = typeof (f as any).source === 'string' ? (f as any).source : undefined
          const at = typeof (f as any).at === 'string' ? (f as any).at : undefined
          if (!text) continue
          const fact: Fact = { factId: id, fact: text }
          if (src) fact.source = src
          if (at) fact.at = at
          out.push(fact)
        }
        this.facts = out
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load facts'
      } finally { this.loading = false }
    },

  async ingestFact(text: string) {
      const auth = useAuthStore(); const t = (text || '').trim()
      if (!auth.ownerId) throw new Error('ownerId not set')
      if (!t) throw new Error('Fact cannot be empty')
      this.loading = true; this.error = null
      try {
        const tempId = 'tmp_' + Math.random().toString(36).slice(2)
        const nowIso = new Date().toISOString()
        // optimistic
    this.facts.unshift({ factId: tempId, fact: t, at: nowIso, source: 'insight' })
    const { factId } = await PersonalQAAPI.ingestFact({ owner: auth.ownerId, fact: t, at: nowIso, source: 'insight' })
        const idx = this.facts.findIndex(f => f.factId === tempId)
    if (idx >= 0) this.facts[idx] = { factId: factId || tempId, fact: t, at: nowIso, source: 'insight' }
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to add fact'
        throw e
      } finally { this.loading = false }
    },

    async forgetFact(factId: string) {
      const auth = useAuthStore(); if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true; this.error = null
      try {
  this.facts = this.facts.filter(f => f.factId !== factId)
  await PersonalQAAPI.forgetFact({ owner: auth.ownerId, factId: factId })
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to forget fact'
        throw e
      } finally { this.loading = false }
    },

    async ask(question: string): Promise<string> {
      const auth = useAuthStore(); if (!auth.ownerId) throw new Error('ownerId not set')
      const q = (question || '').trim(); if (!q) throw new Error('Question cannot be empty')
      if (this.asking) return ''
      this.asking = true; this.error = null
      try {
  this.pushUser(q)
  // Use backend LLM; include brief recent context for continuity
  const recent = this.messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
  const composite = recent.length ? `Conversation so far:\n${recent.join('\n')}\n\nUser question: ${q}` : q
  const { answer } = await PersonalQAAPI.askLLM({ requester: auth.ownerId!, question: composite })
  const reply = String(answer ?? '').trim() || 'Thanks for your question.'
        this.pushAssistant(reply)
        return reply
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to ask question'
        // rollback last user bubble on failure
        if (this.messages.length && this.messages[this.messages.length - 1]?.role === 'user') this.messages.pop()
        return ''
      } finally { this.asking = false }
    }
  }
})
