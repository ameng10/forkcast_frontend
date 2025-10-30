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

    async buildWebParagraph(question: string, intro?: string): Promise<string> {
      const lead = intro?.trim() ? `${intro.trim()} ` : ''
      try {
        const summary = await this.fetchWikipediaSummary(question)
        if (summary) {
          const normalized = summary.replace(/\s+/g, ' ').trim()
          const trimmed = this.limitWords(normalized, 80)
          return `${lead}Here's what I found from a quick search: ${trimmed}`.trim()
        }
      } catch {
        // Ignore fetch errors and fall through to default messaging
      }
      return `${lead}I couldn't retrieve a quick public summary right now. Please consult a trusted health source or a medical professional for more detail.`.trim()
    },

    wordCount(s: string): number {
      const txt = (s || '').trim()
      if (!txt) return 0
      const parts = txt.split(/\s+/g)
      return parts.filter(Boolean).length
    },

    shouldRequestWeb(draft: any): boolean {
      if (!draft || typeof draft !== 'object') return false
      const rawFlag = (draft.needs_web ?? draft.needsWeb ?? draft.requires_web ?? draft.requiresWeb) as unknown
      if (typeof rawFlag === 'boolean') return rawFlag
      if (typeof rawFlag === 'string') {
        const lowered = rawFlag.toLowerCase()
        if (['true', 'yes', 'y', '1'].includes(lowered)) return true
        if (['false', 'no', 'n', '0'].includes(lowered)) return false
      }
      const answer = typeof draft.answer === 'string' ? draft.answer.toLowerCase() : ''
      return /out of scope|insufficient|not enough|need (?:more|additional) data|no relevant personal/i.test(answer)
    },

    async summarizeAnswer(requester: string, answer: string): Promise<string> {
      const prompt = `Summarize the following response for the user in no more than 3 sentences and 90 words. Return STRICT JSON of the form {"summary":"..."}.\nResponse: ${answer}`
      try {
        const { parsed, raw } = await askLLMJson<any>(requester, prompt)
        const data = parsed && typeof parsed === 'object' ? parsed : this.safeParseJSON(raw)
        if (data && typeof data.summary === 'string' && data.summary.trim()) {
          return this.limitWords(data.summary.trim(), 90)
        }
      } catch {
        // Fall back to local truncation below
      }
      return this.limitWords(answer, 90)
    },

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

      const finalize = (text: string) => {
        const clean = text.replace(/\s*\n+\s*/g, ' ').trim()
        const limited = this.limitWords(clean, 150)
        this.pushAssistant(limited)
        this.qas.push({ question: q, answer: limited })
        return limited
      }

      const [meals, checkIns] = await Promise.all([
        this.getRecentMeals(requester),
        this.getRecentCheckIns(requester)
      ])

      const factItems = this.facts
        .filter((f) => f.fact && f.fact.trim().length)
        .slice(0, 12)
        .map((f) => ({
          id: String(f.factId),
          text: f.fact.trim(),
          source: 'fact' as const
        }))

      const mealItems = (meals || []).slice(0, 5).map((meal: any, idx: number) => {
        const id = meal.mealId ? `meal-${meal.mealId}` : `meal-${idx}`
        const items = Array.isArray(meal.items)
          ? meal.items
              .map((item: any) => (typeof item === 'string' ? item.trim() : (item?.name || item?.title || String(item || '')).trim()))
              .filter(Boolean)
          : []
        const parts = [
          `Meal at ${meal.at}`,
          items.length ? `Items: ${items.join(', ')}` : '',
          meal.notes ? `Notes: ${meal.notes}` : ''
        ].filter(Boolean)
        return { id, text: parts.join(' | ').trim(), source: 'meal' as const }
      })

      const checkInItems = (checkIns || []).slice(0, 6).map((entry: any, idx: number) => {
        const baseId = entry.metricId ? `check-${entry.metricId}` : `check-${idx}`
        const id = idx === 0 ? baseId : `${baseId}-${idx}`
        const label = (entry.metricName || entry.metricId || 'metric').toString().trim() || 'metric'
        const parts = [
          `${label}: ${entry.value}`,
          entry.ts ? `at ${entry.ts}` : ''
        ].filter(Boolean)
        return { id, text: parts.join(' | ').trim(), source: 'check' as const }
      })

      const contextItems = [...factItems, ...mealItems, ...checkInItems]
      const contextIds = new Set(contextItems.map((item) => item.id))

      if (contextItems.length === 0) {
        const fallback = await this.buildWebParagraph(q, 'I checked your meals, check-ins, and saved facts but there is no relevant personal data yet.')
        this.backendDown = false
        return finalize(fallback)
      }

      const factsBlock = factItems.length ? factItems.map((item) => `${item.id}: ${item.text}`).join('\n') : '(none)'
      const mealsBlock = mealItems.length ? mealItems.map((item) => `${item.id}: ${item.text}`).join('\n') : '(none)'
      const checkInsBlock = checkInItems.length ? checkInItems.map((item) => `${item.id}: ${item.text}`).join('\n') : '(none)'

      const prompt = [
        'You are Gemini, a friendly health assistant answering the user as a chatbot.',
        'You must return STRICT JSON in the form {"answer":"...","citations":["id1","id2"],"confidence":0.0,"needs_web":false}.',
        'Rely on the provided personal context (facts, meals, check-ins) whenever possible.',
        'Cite only IDs exactly as they appear below. Keep the answer to 120 words or fewer and write a single paragraph.',
        'If the personal context is insufficient to answer, set "needs_web" to true, explain briefly why in the answer, keep confidence ≤ 0.5, and do not invent external facts.',
        'Question: {{question}}',
        'Facts (id: text):',
        '{{facts}}',
        'Meals (id: text):',
        '{{meals}}',
        'Quick check-ins (id: text):',
        '{{checkIns}}'
      ].join('\n')
        .replace('{{question}}', q)
        .replace('{{facts}}', factsBlock)
        .replace('{{meals}}', mealsBlock)
        .replace('{{checkIns}}', checkInsBlock)

      const makeAnswer = async (): Promise<{ text: string; backendIssue: boolean }> => {
        try {
          const { parsed, raw } = await askLLMJson<any>(requester, prompt)
          const result = parsed && typeof parsed === 'object' ? parsed : this.safeParseJSON(raw)
          try {
            this.validateDraft(result, contextIds)
          } catch {
            const fallback = await this.buildWebParagraph(q, 'I reviewed your personal logs but the assistant response was incomplete.')
            return { text: fallback, backendIssue: false }
          }
          const rawAnswer = String(result.answer ?? '').replace(/\s+/g, ' ').trim()
          let trimmedAnswer = this.limitWords(rawAnswer, 140)
          if (this.wordCount(trimmedAnswer) > 120) {
            trimmedAnswer = await this.summarizeAnswer(requester, trimmedAnswer)
          }

          if (this.shouldRequestWeb(result)) {
            const fallback = await this.buildWebParagraph(q, trimmedAnswer || 'I checked your personal data but need outside sources to respond usefully.')
            return { text: fallback, backendIssue: false }
          }

          return { text: trimmedAnswer, backendIssue: false }
        } catch (err) {
          throw err
        }
      }

      try {
        const { text, backendIssue } = await makeAnswer()
        this.backendDown = backendIssue
        return finalize(text)
      } catch (err) {
        this.backendDown = true
        const fallback = await this.buildWebParagraph(q, 'I checked your meals, check-ins, and saved facts but ran into an issue reaching the assistant.')
        return finalize(fallback)
      }
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to ask question'
      throw e
    } finally { this.asking = false }
  }
  }
})
