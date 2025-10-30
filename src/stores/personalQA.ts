import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { PersonalQAAPI, MealLogAPI, QuickCheckInsAPI } from '../lib/api'
import { askLLMJson } from '../lib/llm/geminiWrapper'

export type Fact = { factId: string; fact: string }
export type ChatMessage = { role: 'user' | 'assistant'; text: string }

export const usePersonalQAStore = defineStore('personalQA', {
  state: () => ({
    facts: [] as Fact[],
    messages: [] as ChatMessage[],
    qas: [] as { question: string; answer: string }[],
    loading: false,
    error: null as string | null,
  asking: false,
  backendDown: false,
    // Persisted map of factId -> last known fact text (so refresh shows text, not IDs)
    factTextOverrides: ((): Record<string, string> => {
      try {
        const raw = localStorage.getItem('pqa_factTextOverrides')
        const obj = raw ? JSON.parse(raw) : {}
        return obj && typeof obj === 'object' ? obj : {}
      } catch { return {} }
    })(),
    deletedFactIds: ((): Record<string, true> => {
      try {
        const raw = localStorage.getItem('pqa_deletedFactIds')
        const obj = raw ? JSON.parse(raw) : {}
        return obj && typeof obj === 'object' ? obj : {}
      } catch { return {} }
    })()
  }),
  actions: {
    // Safe JSON parser for LLM outputs (strips code fences if present)
    safeParseJSON(s: string): any {
      const cleaned = String(s || '').trim().replace(/^```json\s*|^```\s*|```$/gim, '').trim()
      try { return JSON.parse(cleaned) } catch { return { error: 'bad_json', raw: s, answer: '', citations: [], confidence: 0 } }
    },
    // Validate LLM draft: required fields and citation IDs within selection
    validateDraft(draft: any, validIds: Set<string>) {
      if (!draft || typeof draft.answer !== 'string' || draft.answer.trim().length === 0) throw new Error('LLM_EMPTY_ANSWER')
      if (!Array.isArray(draft.citations) || draft.citations.length === 0) throw new Error('LLM_NO_CITATIONS')
      for (const c of draft.citations) { if (!validIds.has(String(c))) throw new Error('LLM_BAD_CITATION') }
      if (draft.answer.length > 800) throw new Error('LLM_TOO_LONG')
      if (typeof draft.confidence !== 'number' || draft.confidence < 0 || draft.confidence > 1) throw new Error('LLM_CONFIDENCE_RANGE')
    },
    // Local conservative fallback, modeled after example
    conservativeSummary(question: string, facts: Fact[]): string {
      if (!facts || facts.length === 0) return 'Insufficient data to answer yet.'
      const bits = facts.slice(-3).map((f) => `[${f.factId}] ${f.fact}`).join(' | ')
      return `Based on your recent facts: ${bits}. I would need more data to be confident about “${question}”.`
    },
  // Simple utility: no-op placeholders removed to align with example
    // Utility to limit words for concise answers
    limitWords(s: string, maxWords = 120): string {
      const parts = s.trim().split(/\s+/)
      if (parts.length <= maxWords) return s.trim()
      return parts.slice(0, maxWords).join(' ') + '…'
    },

    // Web summary (lightweight) for fallback context
    async fetchWikipediaSummary(topic: string): Promise<string | null> {
      const raw = (topic || '').trim()
      const variants: string[] = []
      if (raw) variants.push(raw)
      // Try extracting a core subject for questions like "how do X affect me", "are X good for me", and "what is/are X"
      const lower = raw.toLowerCase()
      let core = lower
        // strip leading auxiliaries and common question openers
        .replace(/^(how\s+do|how\s+does)\s+/i, '')
        .replace(/^(do|does|did|can|could|should|would|will)\s+/i, '')
        .replace(/^(are|is|was|were)\s+/i, '')
        .replace(/^what\s+(?:is|are|'s|s)\s+/i, '')
        .replace(/^whats\s+/i, '')
        .replace(/^what\s+are\s+/i, '')
        .replace(/^define\s+/i, '')
        .replace(/^definition\s+of\s+/i, '')
        // strip trailing intent phrases
        .replace(/\s+(good|bad)\s+for\s+(.+)$/i, '')
        .replace(/\s+(help|harm|affect|impact|cause|improve|worsen|increase|decrease)\s+(me|my|health|digestion|sleep|anxiety|blood sugar|.*)$/i, '')
        .replace(/\s+help\s+with\s+(.+)$/i, '')
        .replace(/\?+$/,'')
        .trim()
      if (core && core.length < lower.length) variants.push(core)
      // Heuristic: also try singularizing a simple plural
      const singular = (s: string) => s.endsWith('s') ? s.slice(0, -1) : s
      const cleanedCore = core || lower
      if (cleanedCore) variants.push(singular(cleanedCore))
      // Try very short subject: first 2 words (e.g., "seed oils" -> "seed oils")
      if (cleanedCore) {
        const firstTwo = cleanedCore.split(/\s+/).slice(0, 2).join(' ').trim()
        if (firstTwo && firstTwo !== cleanedCore) variants.push(firstTwo)
      }
      const uniq = variants
        .map(t => (t || '').trim())
        .filter(Boolean)
        .filter((t, i, a) => a.indexOf(t) === i)

      for (const v of uniq) {
        try {
          const slug = encodeURIComponent(v.replace(/\s+/g, '_'))
          const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`
          const res = await fetch(url, { headers: { accept: 'application/json' } })
          if (!res.ok) continue
          const data: any = await res.json()
          const extract = typeof data?.extract === 'string' ? data.extract.trim() : ''
          const first = extract.split('\n')[0]
          if (first) return first
        } catch { /* try next */ }
      }
      return null
    },

  // Unused helpers from prior iteration removed to match example minimalism

  // Optional: normalized recent meals (kept for endpoints correctness; not used in ask flow)
    async getRecentMeals(ownerId: string) {
      try {
        const raw = await MealLogAPI.getMealsForOwner({ ownerId })
        const arr: any[] = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : [])
        return arr
          .map((m: any) => ({
            mealId: String(m.mealId || m.id || m._id || ''),
            at: new Date(m.at || m.when || m.time || m.date || m.timestamp).toISOString(),
            items: Array.isArray(m.items) ? m.items : [],
            notes: typeof m.notes === 'string' ? m.notes : ''
          }))
          .filter((m: any) => m.mealId && m.at)
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .slice(0, 10)
      } catch { return [] }
    },

  // Optional: normalized recent check-ins (kept for endpoints correctness; not used in ask flow)
    async getRecentCheckIns(owner: string) {
      try {
        const list = await QuickCheckInsAPI.listByOwner({ owner })
        return (list || [])
          .map((ci: any) => ({
            metricId: String(ci.metricId || ci.metric || ''),
            metricName: String(ci.metricName || ci.name || ci?.metric?.name || ci?.metricTitle || ci?.title || ci?.label || ci.metricId || ci.metric || ''),
            value: Number(ci.value),
            ts: new Date(ci.timestamp ? (ci.timestamp * 1000) : (ci.at || ci.date || ci.ts)).toISOString()
          }))
          .filter((x: any) => x.metricId && Number.isFinite(x.value) && x.ts)
          .slice(0, 30)
      } catch { return [] }
    },


    // Remove any null/blank facts on the backend to avoid server crashes on toLowerCase
    async cleanNullFacts(): Promise<{ deleted: number; hadUndeletable: boolean }> {
      const auth = useAuthStore(); if (!auth.ownerId) return { deleted: 0, hadUndeletable: false }
      let deleted = 0; let hadUndeletable = false
      try {
        const facts: any[] = await PersonalQAAPI.getUserFacts({ owner: auth.ownerId })
        for (const f of (facts || [])) {
          const isNullEntry = f == null || (typeof f === 'object' && Object.keys(f).length === 0)
          const txt = f?.fact
          const s = (txt == null ? '' : String(txt)).trim().toLowerCase()
          const isBad = isNullEntry || !s || s === 'null' || s === 'undefined'
          if (isBad) {
            const id = f?.factId ? String(f.factId) : ''
            if (id) {
              try {
                await PersonalQAAPI.forgetFact({ owner: auth.ownerId!, factId: id })
                deleted += 1
              } catch { /* ignore individual delete errors */ }
            } else {
              hadUndeletable = true
            }
          }
        }
      } catch {
        // best-effort cleanup only
      }
      return { deleted, hadUndeletable }
    },
    // Minimal fact APIs
    async refreshFacts() {
      const auth = useAuthStore()
      if (!auth.ownerId) throw new Error('ownerId not set')
      this.loading = true; this.error = null
      try {
        const list = await PersonalQAAPI.getUserFacts({ owner: auth.ownerId })
        const prevMap = new Map<string, string>(this.facts.map(f => [f.factId, f.fact]))
        const out: Fact[] = []
        for (const f of (list || [])) {
          if (!f || this.deletedFactIds[f.factId]) continue
          const id = String(f.factId || '')
          let text = typeof f.fact === 'string' ? f.fact : ''
          // If server text is empty, keep the previous/local one; if none, skip adding this record
          if (!text || !text.trim()) {
            const ov = this.factTextOverrides[id]
            const prev = prevMap.get(id)
            text = (ov && ov.trim()) ? ov : ((prev && prev.trim()) ? prev : '')
            if (!text) {
              // No known text for this id; skip to avoid '(no text yet)'
              continue
            }
          } else {
            // Sync override with server text
            this.factTextOverrides[id] = text
          }
          out.push({ factId: id, fact: text })
        }
        this.facts = out
        try { localStorage.setItem('pqa_factTextOverrides', JSON.stringify(this.factTextOverrides)) } catch {}
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
        this.facts.unshift({ factId: tempId, fact: t })
        const { factId } = await PersonalQAAPI.ingestFact({ owner: auth.ownerId, fact: t })
        const idx = this.facts.findIndex(f => f.factId === tempId)
        if (idx >= 0) this.facts[idx] = { factId: factId || tempId, fact: t }
        if (factId) {
          this.factTextOverrides[factId] = t
          try { localStorage.setItem('pqa_factTextOverrides', JSON.stringify(this.factTextOverrides)) } catch {}
        }
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
        this.deletedFactIds[factId] = true
        try { localStorage.setItem('pqa_deletedFactIds', JSON.stringify(this.deletedFactIds)) } catch {}
        if (this.factTextOverrides[factId]) {
          delete this.factTextOverrides[factId]
          try { localStorage.setItem('pqa_factTextOverrides', JSON.stringify(this.factTextOverrides)) } catch {}
        }
        await PersonalQAAPI.forgetFact({ owner: auth.ownerId, factId })
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to forget fact'
        throw e
      } finally { this.loading = false }
    },

    // Regular chatbot flow
  resetChat() { this.messages = []; this.qas = [] },
    pushUser(text: string) { this.messages.push({ role: 'user', text }) },
    pushAssistant(text: string) { this.messages.push({ role: 'assistant', text }) },

  async ask(question: string): Promise<string> {
    const auth = useAuthStore()
    if (!auth.ownerId) throw new Error('ownerId not set')
    const q = (question || '').trim()
    if (!q) throw new Error('Question cannot be empty')
    if (this.asking) return ''
    this.asking = true; this.error = null
    try {
      const requester = auth.ownerId!
      this.pushUser(q)

      // Ensure we have the latest facts
      if (!this.facts.length) {
        try { await this.refreshFacts() } catch { /* best-effort */ }
      }

      // Build a combined selection of entries: meals, check-ins, and notes (facts)
      const [meals, checkins] = await Promise.all([
        this.getRecentMeals(requester).catch(() => []),
        this.getRecentCheckIns(requester).catch(() => [])
      ])

      type Entry = { id: string; text: string; at?: string; src: 'note' | 'meal' | 'check_in' }
      const noteEntries: Entry[] = this.facts
        .filter(f => f.fact && f.fact.trim())
        .map(f => ({ id: String(f.factId), text: f.fact.trim(), src: 'note' as const }))

      const mealEntries: Entry[] = (meals || []).map((m: any) => {
        const items = Array.isArray(m.items) ? m.items.join(', ') : ''
        const notes = m.notes ? `; notes: ${m.notes}` : ''
        const body = [items && `items: ${items}`].filter(Boolean).join('; ')
        const text = body ? `Meal ${body}${notes}` : (m.notes ? `Meal notes: ${m.notes}` : 'Meal entry')
        return { id: `meal_${m.mealId}`, text, at: m.at, src: 'meal' as const }
      })

      const ciEntries: Entry[] = (checkins || []).map((ci: any) => {
        const label = ci.metricName || ci.metricId
        const text = `${label}: ${ci.value}`
        const ts = ci.ts
        const tsComp = ts ? new Date(ts).getTime() : Date.now()
        return { id: `ci_${ci.metricId}_${tsComp}`, text, at: ts, src: 'check_in' as const }
      })

      const parseAt = (s?: string) => {
        const t = s ? Date.parse(s) : NaN
        return Number.isFinite(t) ? t : -Infinity
      }
      let combined: Entry[] = [...mealEntries, ...ciEntries, ...noteEntries]
      combined.sort((a, b) => parseAt(b.at) - parseAt(a.at))
      // Ensure at least a couple of note facts if available
      const topLogs = combined.slice(0, 12)
      if (noteEntries.length > 0) {
        const ensuredNotes = noteEntries.slice(0, 3)
        const existingIds = new Set(topLogs.map(e => e.id))
        const merged = [...ensuredNotes, ...topLogs.filter(e => !existingIds.has(e.id))]
        combined = merged
      } else {
        combined = topLogs
      }
      const uniq = (arr: Entry[]) => {
        const seen = new Set<string>()
        const out: Entry[] = []
        for (const e of arr) { if (!seen.has(e.id)) { seen.add(e.id); out.push(e) } }
        return out
      }
      const selection = uniq(combined).slice(0, 12)

      const factsBlock = selection
        .map((e) => `${e.id}: ${e.text} (src:${e.src}${e.at ? `, at:${e.at}` : ''})`)
        .join('\n')

      const template = `You are a careful coach answering ONLY with the user's provided facts.
Return STRICT JSON of the shape:
{"answer": "...", "citations": ["factId1","factId2"], "confidence": 0.0}
Rules:
- Keep the answer ≤ 120 words.
- Every claim MUST be supported by provided facts; cite by fact ids.
- You MUST ONLY use fact IDs exactly as shown below in your citations. Do NOT invent, change, or guess any IDs. If you cite a fact, copy its ID exactly as given.
- If facts conflict, clearly describe the nature of the conflict, mention uncertainty, and lower confidence. Suggest what additional data would help resolve the ambiguity.
- If evidence is weak or inconclusive, make a clear, reasoned conclusion based on the closest facts, but lower the confidence accordingly. Never refuse to answer. If the data is inconclusive, suggest what a web search might reveal or what further information would be needed, and include this in your answer.
- For every answer, you must always cite at least one fact from the provided list, even if it is only tangentially related to the question.
- When reasoning about meal timing, interpret times after 20:00 as 'late' and before 18:00 as 'early'. Use this in your answer if relevant.
 - If possible, include one concrete numeric example from the facts to support your answer.
- If the question is out of scope for the provided facts, state this clearly, cite the closest fact, and suggest a web search or further data. In this case, also provide a clearly labeled "Web note" with a general knowledge answer, separated from the personal answer.
Question: {{question}}
Facts (id: text):
{{facts}}`
      const prompt = template
        .replace('{{question}}', q)
        .replace('{{facts}}', factsBlock || '(none)')

      const tryAsk = async () => {
        const { parsed, raw } = await askLLMJson<any>(requester, prompt)
        const result = parsed && typeof parsed === 'object' ? parsed : this.safeParseJSON(raw)
        const ids = new Set(selection.map((e) => e.id))
        let ansText = ''
        try {
          this.validateDraft(result, ids)
          ansText = String(result.answer || '').trim()
        } catch {
          const lastFew = selection.slice(-3).map((e) => ({ factId: e.id, fact: e.text }))
          let local = this.conservativeSummary(q, lastFew as Fact[])
          try {
            const web = await this.fetchWikipediaSummary(q)
            if (web) {
              const short = this.limitWords(web, 40)
              local = `${local}\nWeb note: ${short}`
            }
          } catch { /* optional */ }
          ansText = local
        }
        const clean = ansText
        this.pushAssistant(clean)
        this.qas.push({ question: q, answer: clean })
        this.backendDown = false
        return clean
      }

      try {
        return await tryAsk()
      } catch (e: any) {
        this.backendDown = true
        const lastFew = selection.slice(-3).map((e) => ({ factId: e.id, fact: e.text }))
        let local = this.conservativeSummary(q, lastFew as Fact[])
        try {
          const web = await this.fetchWikipediaSummary(q)
          if (web) local = `${local}\nWeb note: ${this.limitWords(web, 40)}`
        } catch { /* best-effort */ }
        const cleanLocal = local || 'Here’s a quick perspective based on what I could find.'
        this.pushAssistant(cleanLocal); this.qas.push({ question: q, answer: cleanLocal })
        return cleanLocal
      }
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to ask question'
      throw e
    } finally { this.asking = false }
  }
  }
})
