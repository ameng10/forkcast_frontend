import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL
  : '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
  timeout: 15000
})

// Attach auth token if present
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${auth.token}`
  }
  return config
})

// Basic response error handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // If backend returns { error: string }
    if (error.response?.data?.error) {
      error.message = error.response.data.error
    }
    return Promise.reject(error)
  }
)

// QuickCheckIns API helpers (from spec)
export const QuickCheckInsAPI = {
  // Record using metric ID and ISO-8601 time per backend flow
  record(payload: { owner: string; metric: string; value: number; at: string }) {
    return api.post('/QuickCheckIns/record', payload).then(r => r.data as { checkInId: string })
  },
  // Define metric by name only; normalize response to metricId
  defineMetric(payload: { name: string }) {
    const body: any = { name: payload.name }
    return api.post('/QuickCheckIns/defineMetric', body).then(r => {
      const d = r.data as any
      const metricId = d?.metric || d?.metricId || d?.id || d?._id
      return { metricId } as { metricId: string }
    })
  },
  edit(payload: { owner: string; checkInId: string; newValue: number; newTimestamp?: number }) {
    const owner = payload.owner
    const id = payload.checkInId
    const tsMs = payload.newTimestamp
    const tsSec = tsMs != null ? Math.floor(tsMs / 1000) : undefined
    const atIso = tsMs != null ? new Date(tsMs).toISOString() : undefined
    const base: any = {
      owner,
      ownerId: owner,
      requester: owner,
      user: owner,
      uid: owner,
      checkInId: id,
      checkIn: id,
      id,
      value: payload.newValue,
      newValue: payload.newValue
    }
    if (tsMs != null) {
      Object.assign(base, {
        newTimestamp: tsSec,
        timestamp: tsSec,
        newTimestampSeconds: tsSec,
        timestampSeconds: tsSec,
        newTimestampMs: tsMs,
        timestampMs: tsMs,
        newDate: tsMs,
        date: tsMs,
        newTime: tsMs,
        time: tsMs,
        newWhen: atIso,
        when: atIso,
        newAt: atIso,
        at: atIso,
        updatedAt: atIso,
        ts: tsSec,
        tsMs,
        new_ts: tsSec
      })
    }
    const endpoints = [
      '/QuickCheckIns/edit',
      '/QuickCheckIns/_edit',
      '/QuickCheckIns/update',
      '/QuickCheckIns/_update',
      '/QuickCheckIns/editCheckIn',
      '/QuickCheckIns/_editCheckIn'
    ]
  const run = async (): Promise<{}> => {
      let lastErr: any
      for (const url of endpoints) {
        try {
          const res = await api.post(url, base)
      return (res.data as any) ?? {}
        } catch (err: any) {
          lastErr = err
          if (![400, 404, 422].includes(err?.response?.status)) throw err
        }
      }
      throw lastErr
    }
    return run()
  },
  getCheckIn(payload: { checkInId: string }) {
    return api.post('/QuickCheckIns/_getCheckIn', payload).then(r => r.data as Array<{ checkInId: string; owner: string; metricName: string; value: number; timestamp: number }>)
  },
  // No owner in request; normalize to array of {metricId,name}
  getMetricsByName(payload: { name: string }) {
    return api.post('/QuickCheckIns/_getMetricsByName', payload).then(r => {
      const d = r.data as any
      const arr = Array.isArray(d) ? d : (d ? [d] : [])
      return arr.map((m: any) => ({ metricId: m?._id || m?.id || m?.metricId || m?.metric, name: m?.name, unit: m?.unit })) as Array<{ metricId: string; name: string; unit?: string }>
    })
  },
  // Rename metric by id or by (id,name). Fallback to alternate shapes.
  renameMetric(payload: { metricId: string; name: string; owner?: string }) {
    const base: any = { metricId: payload.metricId, metric: payload.metricId, id: payload.metricId, name: payload.name }
    if (payload.owner) base.owner = payload.owner
    return api.post('/QuickCheckIns/renameMetric', base).then(r => r.data as {})
      .catch(async (e) => {
        if ([400, 404, 422].includes(e?.response?.status)) {
          // Try underscore or alternate field names
          try { const r2 = await api.post('/QuickCheckIns/_renameMetric', base); return r2.data as {} } catch {}
          try { const r3 = await api.post('/QuickCheckIns/editMetric', { id: payload.metricId, metricId: payload.metricId, metric: payload.metricId, name: payload.name, owner: payload.owner }); return r3.data as {} } catch {}
          try { const r4 = await api.post('/QuickCheckIns/_editMetric', { id: payload.metricId, metricId: payload.metricId, metric: payload.metricId, name: payload.name, owner: payload.owner }); return r4.data as {} } catch {}
        }
        throw e
      })
  },
  deleteMetric(payload: { metricId: string; owner?: string }) {
    const base: any = { metricId: payload.metricId, metric: payload.metricId, id: payload.metricId }
    if (payload.owner) {
      base.owner = payload.owner
      base.requester = payload.owner
      base.ownerId = payload.owner
      base.user = payload.owner
      base.uid = payload.owner
    }
    const tryList = [
      ['/QuickCheckIns/deleteMetric', base],
      ['/QuickCheckIns/_deleteMetric', base],
      ['/QuickCheckIns/removeMetric', base],
      ['/QuickCheckIns/_removeMetric', base]
    ] as const
    const run = async () => {
      let lastErr: any
      for (const [url, body] of tryList) {
        try {
          const r = await api.post(url, body)
          const data = r.data as any
          if (data && typeof data === 'object' && typeof data.error === 'string' && data.error) {
            throw new Error(data.error)
          }
          return data as {}
        } catch (err: any) {
          lastErr = err
          const code = err?.response?.status
          if (code === 404) {
            // Treat not-found as already-deleted success in owner scope
            return {}
          }
          if (![400,404,422].includes(code)) throw err
        }
      }
      throw lastErr
    }
    return run()
  },
  // Allow filtering by metric ID; try multiple endpoints and include time range aliases for compatibility
  listByOwner(payload: { owner: string; metricId?: string; metric?: string; startDate?: number; endDate?: number }) {
    const { owner, metricId, metric } = payload
    const start = payload.startDate
    const end = payload.endDate
    // Build a comprehensive body with common aliases some backends expect
    const body: any = {
      owner,
      ownerId: owner,
      user: owner,
      uid: owner,
      requester: owner,
      // Metric identifiers
      ...(metricId ? { metricId, metric: metricId, id: metricId } : {}),
      ...(!metricId && metric ? { metric } : {})
    }
    if (start != null) {
      const ms = start
      const sec = Math.floor(ms / 1000)
      Object.assign(body, {
        startDate: ms,
        endDate: end ?? undefined,
        // common aliases
        start: ms,
        end: end ?? undefined,
        startAt: ms,
        endAt: end ?? undefined,
        startTime: ms,
        endTime: end ?? undefined,
        from: ms,
        to: end ?? undefined,
        rangeStart: ms,
        rangeEnd: end ?? undefined,
        // seconds variants
        startSeconds: sec,
        endSeconds: end != null ? Math.floor(end / 1000) : undefined
      })
    }
    // Endpoint candidates to maximize compatibility
    const endpoints = [
      '/QuickCheckIns/_listCheckInsByOwner',
      '/QuickCheckIns/listCheckInsByOwner',
      '/QuickCheckIns/getCheckInsByOwner',
      '/QuickCheckIns/listByOwner',
      '/QuickCheckIns/_listByOwner',
      '/QuickCheckIns/list',
      '/QuickCheckIns/_list'
    ]
    const normalizeList = (d: any): any[] => {
      if (Array.isArray(d)) return d
      if (!d) return []
      // Unwrap common containers
      const containers = [
        'data','items','list','results','records','rows','checkIns','checkins','entries'
      ]
      for (const key of containers) {
        const v = d?.[key]
        if (Array.isArray(v)) return v
      }
      // If object contains numeric keys (array-like), use values
      if (typeof d === 'object') {
        const vals = Object.values(d)
        if (vals.every(x => typeof x === 'object')) return vals as any[]
      }
      return [d]
    }
    const run = async () => {
      let lastErr: any
      for (const url of endpoints) {
        try {
          const r = await api.post(url, body)
          const d = r.data as any
          const arr = normalizeList(d)
          return arr as any[]
        } catch (err: any) {
          lastErr = err
          // If it's not a contract error, surface it
          if (![400, 404, 422].includes(err?.response?.status)) throw err
        }
      }
      // Final attempts: try GET with query params for some backends
      try {
        const params: any = { owner, ownerId: owner, user: owner, uid: owner }
        if (metricId) params.metricId = metricId
        if (!metricId && metric) params.metric = metric
        if (start != null) {
          params.startDate = start
          if (end != null) params.endDate = end
        }
        const candidates = [
          '/QuickCheckIns/listByOwner',
          '/QuickCheckIns/_listCheckInsByOwner',
          '/QuickCheckIns/listCheckInsByOwner'
        ]
    for (const url of candidates) {
          try {
            const rGet = await api.get(url, { params })
            const d = rGet.data as any
      return normalizeList(d)
          } catch (err2: any) {
            if (![400,404,422].includes(err2?.response?.status)) throw err2
          }
        }
  // If every attempt resulted in a 404, treat as no data
  const code = lastErr?.response?.status
  if (code === 404) return []
  throw lastErr
      } catch (err) {
  const code = lastErr?.response?.status
  if (code === 404) return []
  throw lastErr
      }
    }
    return run()
  }
  ,
  // List all metrics for an owner (used to map names/units)
  listMetricsForOwner(payload: { owner: string }) {
    const body: any = { owner: payload.owner, requester: payload.owner }
    const endpoints = [
      '/QuickCheckIns/_listMetricsForOwner',
      '/QuickCheckIns/listMetricsForOwner',
      '/QuickCheckIns/getMetricsForOwner',
      '/QuickCheckIns/_getMetricsForOwner',
      '/QuickCheckIns/listMetrics',
      '/QuickCheckIns/_listMetrics'
    ]
    const normalize = (arr: any): Array<{ metricId: string; name: string; unit?: string }> => {
      const list = Array.isArray(arr) ? arr : (arr ? [arr] : [])
      return list.map((m: any) => ({
        metricId: m?.metricId || m?.metric || m?.id || m?._id,
        name: m?.name || m?.metricName || m?.label || '',
        unit: m?.unit || m?.units || m?.u
      })).filter(x => x.metricId)
    }
    const run = async () => {
      let lastErr: any
      for (const url of endpoints) {
        try { const r = await api.post(url, body); return normalize(r.data) } catch (err: any) {
          lastErr = err
          const code = err?.response?.status
          if (![400,404,422].includes(code)) throw err
        }
      }
      // Treat pure 404 path absence as no metrics yet
      if (lastErr?.response?.status === 404) return []
      throw lastErr
    }
    return run()
  },
  // Permanently delete a check-in by id for an owner
  deleteCheckIn(payload: { owner: string; checkIn: string }) {
    const body: any = { owner: payload.owner, checkIn: payload.checkIn, checkInId: payload.checkIn, id: payload.checkIn }
    return api.post('/QuickCheckIns/delete', body).then(r => r.data as {})
      .catch(async (e) => {
        if ([400,404,422].includes(e?.response?.status)) {
          try { const r2 = await api.post('/QuickCheckIns/_delete', body); return r2.data as {} } catch {}
        }
        throw e
      })
  }
}

// MealLog API helpers (updated shapes from spec)
export const MealLogAPI = {
  // Spec-compliant: fetch logs for a specific date
  getLogsForDate(payload: { user: string; date: string }) {
    // Accept various date shapes; ensure ISO
    const body: any = { user: payload.user }
    try {
      const ms = Date.parse(payload.date)
      body.date = Number.isFinite(ms) ? new Date(ms).toISOString() : payload.date
    } catch { body.date = payload.date }
    return api.post('/MealLog/_getLogsForDate', body)
      .then(r => r.data as any[])
      .catch((e) => {
        if (e?.response?.status === 404) return [] as any[]
        throw e
      })
  },
  submit(payload: { owner: string; at: Date | string; items: Array<{ id: string; name: string }>; notes?: string }) {
    // Backend expects exact keys: owner (User), at (Date), items (FoodItem[]), notes?
    // Ensure 'at' is a Date object the server can parse reliably.
    const atDate = (payload.at instanceof Date) ? payload.at : new Date(payload.at)
    const body = {
      owner: payload.owner,
      at: atDate,
      items: payload.items.map(it => ({ id: it.id, name: it.name })),
      ...(payload.notes ? { notes: payload.notes } : {})
    }
    return api.post('/MealLog/submit', body).then(r => {
      const d: any = r.data
      // Backend returns { meal }
      const mealId = d?.meal
      return { mealId: mealId ? String(mealId) : '' } as { mealId: string }
    })
  },
  edit(payload: { caller: string; meal: string; at?: Date | string; items?: Array<{ id: string; name: string }>; notes?: string }) {
    const body: any = {
      caller: payload.caller,
      meal: payload.meal,
      ...(payload.items ? { items: payload.items.map(it => ({ id: it.id, name: it.name })) } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
      ...(payload.at ? { at: (payload.at instanceof Date) ? payload.at : new Date(payload.at) } : {})
    }
    return api.post('/MealLog/edit', body).then(r => r.data as {})
  },
  delete(payload: { caller: string; meal: string }) {
    return api.post('/MealLog/delete', payload).then(r => r.data as {})
  },
  getMealsForOwner(payload: { owner: string; includeDeleted?: boolean }) {
    const body: any = { owner: payload.owner, includeDeleted: payload.includeDeleted === true }
    return api.post('/MealLog/_getMealsByOwner', body)
      .then(r => r.data as any)
      .catch(async (e) => {
        if (e?.response?.status === 404) {
          // Try legacy underscore naming variants
          const fallbacks = ['/MealLog/_getMealsForOwner','/MealLog/_getMealOwner']
          for (const url of fallbacks) {
            try { const r2 = await api.post(url, body); return r2.data as any } catch (e2: any) {
              if (![400,404,422].includes(e2?.response?.status)) throw e2
            }
          }
          return [] as any[]
        }
        throw e
      })
  },
  getMealById(payload: { meal: string }) {
    const body: any = { meal: payload.meal }
    return api.post('/MealLog/_getMealById', body)
      .then(r => r.data as any)
      .catch(async (e) => {
        if (e?.response?.status === 404) {
          // Try underscore/object variant fallback
          const r2 = await api.post('/MealLog/_getMealObjectById', { mealObjectId: payload.meal })
          return r2.data as any
        }
        throw e
      })
  }
}

// PersonalQA API helpers
export const PersonalQAAPI = {
  ingestFact(payload: { owner: string; fact: string; source?: string; at?: string }) {
    const trimmed = (payload.fact || '').trim()
    // Map arbitrary source to backend enum values; default to 'insight' to avoid tying to meals/check-ins
    const rawSrc = (payload.source || '').toLowerCase().trim()
    const source = ['meal','check_in','insight','behavior'].includes(rawSrc) ? rawSrc : 'insight'
    // Prefer ISO-8601 string; server may coerce to Date
    const at = (payload.at && payload.at.trim()) || new Date().toISOString()
    // Backend expects { owner, at, content, source }
    const variants: Array<Record<string, any>> = [
      { owner: payload.owner, at, content: trimmed, source },
      // Fallbacks in case router expects alternate keys
      { requester: payload.owner, owner: payload.owner, at, content: trimmed, source },
      { owner: payload.owner, at, fact: trimmed, source },
      { requester: payload.owner, at, fact: trimmed, source }
    ]
    const run = async (): Promise<{ factId: string }> => {
      let lastErr: any
      for (const body of variants) {
        try {
          const res = await api.post('/PersonalQA/ingestFact', body)
          const d: any = res.data
          const id = d?.fact || d?.factId || d?._id || d?.id || d?.key || d?.uuid || d?.docId || d?.documentId || d?.insertedId || d?.upsertedId || d?.result?.id || d?.result?._id || d?.document?._id || d?.document?.id
          return { factId: id ? String(id) : '' }
        } catch (err: any) {
          lastErr = err
          if (![400, 404, 422].includes(err?.response?.status)) throw err
        }
      }
      throw lastErr
    }
    return run()
  },
  forgetFact(payload: { owner: string; factId: string }) {
    // Try a few payload variants for broader backend compatibility
    const attempts: Array<Record<string, any>> = [
      // Primary (backend requires requester = owner)
      { requester: (payload as any).owner, owner: (payload as any).owner, factId: payload.factId },
      // Owner with alternate id keys
      { requester: (payload as any).owner, owner: (payload as any).owner, id: payload.factId },
      { requester: (payload as any).owner, owner: (payload as any).owner, fact: payload.factId },
      // Legacy shapes
      { owner: (payload as any).owner, factId: payload.factId },
      // Owner with alternate id keys
      { owner: (payload as any).owner, id: payload.factId },
      { owner: (payload as any).owner, fact: payload.factId },
      // Requester variants
      { requester: (payload as any).owner, factId: payload.factId },
      { requester: (payload as any).owner, id: payload.factId },
      { requester: (payload as any).owner, fact: payload.factId }
    ]
    const run = async () => {
      let lastErr: any
      for (const body of attempts) {
        try {
          const r = await api.post('/PersonalQA/forgetFact', body)
          return r.data as {}
        } catch (err: any) {
          lastErr = err
          // Try next variant only for typical contract errors
          if (![400, 404, 422].includes(err?.response?.status)) throw err
          // Try underscore variant for the same body before moving on
          try {
            const r2 = await api.post('/PersonalQA/_forgetFact', body)
            return r2.data as {}
          } catch (e2: any) {
            // if still schema-ish, continue; otherwise surface
            if (![400,404,422].includes(e2?.response?.status)) throw e2
          }
        }
      }
      throw lastErr
    }
    return run()
  },
  ask(payload: { requester: string; question: string }) {
    // Send aliases for compatibility
    const body: any = {
      requester: payload.requester,
      owner: payload.requester,
      user: payload.requester,
      question: (payload.question || '').trim()
    }
    const run = async () => {
      // Prefer underscore variant first in case primary path aggregates other sources server-side
      try {
        const r2 = await api.post('/PersonalQA/_ask', body)
  const d: any = r2.data
  const qa = d?.qa ?? d
  const ans = qa?.answer ?? d?.answer ?? d?.text ?? d?.output ?? d?.result?.answer
        if (typeof d?.error === 'string' && d.error) throw new Error(d.error)
        if (!ans || String(ans).trim() === '') throw new Error('Empty answer')
        return { answer: String(ans) } as { answer: string }
      } catch (eUnderscore: any) {
        if (![400,404,422,500].includes(eUnderscore?.response?.status)) throw eUnderscore
        // Fallback to primary
        const r = await api.post('/PersonalQA/ask', body)
  const d: any = r.data
  const qa = d?.qa ?? d
  const ans = qa?.answer ?? d?.answer ?? d?.text ?? d?.output ?? d?.result?.answer
        if (typeof d?.error === 'string' && d.error) throw new Error(d.error)
        if (!ans || String(ans).trim() === '') throw new Error('Empty answer')
        return { answer: String(ans) } as { answer: string }
      }
    }
    return run()
  },
  askLLM(payload: { requester: string; question: string; k?: number; model?: string }) {
    const body: any = {
      requester: payload.requester,
      owner: payload.requester,
      user: payload.requester,
      question: (payload.question || '').trim()
    }
    if (payload.k != null) body.k = payload.k
    if (payload.model) body.model = payload.model
    const endpoints = [
      '/PersonalQA/askLLM',
      '/PersonalQA/_askLLM',
      '/PersonalQA/ask-llm',
      '/PersonalQA/_ask-llm',
      '/PersonalQA/askLlm',
      '/PersonalQA/AskLLM',
      '/PersonalQA/ask_llm'
    ]
    const run = async () => {
      let lastErr: any
      for (const url of endpoints) {
        try {
          const r = await api.post(url, body)
          const d: any = r.data
          if (typeof d?.error === 'string' && d.error) throw new Error(d.error)
          const qa = d?.qa ?? d
          const ans = qa?.answer ?? d?.answer ?? d?.text ?? d?.output ?? d?.result?.answer
          if (!ans || String(ans).trim() === '') throw new Error('Empty answer')
          return { answer: String(ans), citedFacts: qa?.citedFacts ?? d?.citedFacts, confidence: qa?.confidence ?? d?.confidence } as { answer: string; citedFacts?: string[]; confidence?: number }
        } catch (e: any) {
          lastErr = e
          if (![400,404,422,500].includes(e?.response?.status)) throw e
        }
      }
      // Surface a descriptive error instead of falling back to rule-based ask
      const code = lastErr?.response?.status
      if (code === 404) {
        throw new Error('PersonalQA.askLLM endpoint not found (404). Please enable askLLM on the server.')
      }
      throw lastErr
    }
    return run()
  },
  setTemplate(payload: { requester: string; name: string; template: string }) {
    const body: any = {
      requester: payload.requester,
      owner: payload.requester,
      name: payload.name,
      template: payload.template
    }
    return api.post('/PersonalQA/setTemplate', body).then(r => r.data as {})
  },
  getUserDrafts(payload: { owner: string }) {
    const body: any = { owner: payload.owner, requester: payload.owner }
    return api.post('/PersonalQA/_getUserDrafts', body).then(r => {
      const d: any = r.data
      const arr = Array.isArray(d) ? d : (d ? [d] : [])
      return arr.map((x: any) => ({
        question: x?.question ?? x?.q ?? '',
        answer: x?.answer ?? x?.a ?? undefined,
        draft: x?.draft ?? true,
        at: x?.at ?? x?.timestamp ?? x?.time,
        citedFacts: x?.citedFacts ?? x?.facts,
        confidence: x?.confidence
      })) as Array<{ question: string; answer?: string; draft?: boolean; at?: string; citedFacts?: any; confidence?: number }>
    })
  },
  getUserFacts(payload: { owner: string }) {
    const normalize = (item: any) => {
  if (item == null) return { factId: '', fact: '' }
      // If backend returns a bare string, treat it as text unless it looks like an ID
      if (typeof item === 'string') {
        const s = item.trim()
        const isMongo = /^[a-f0-9]{24}$/i.test(s)
        const isUUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)
        const isULID = /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s)
        if (isMongo || isUUID || isULID) {
          return { factId: s, fact: '' }
        }
        // Otherwise assume the string is the human-readable fact and also usable as identifier
        return { factId: s, fact: s }
      }
      // Collect candidate id/text fields across common shapes
      const idCandidates = [
        item.factId, item._id, item.id, item.key, item.identifier, item.uuid, item.docId, item.documentId,
        item?.document?._id, item?.document?.id
      ]
      const textCandidates = [
  item.fact, item.text, item.value, item.content, item.statement, item.body, item.note,
        item.name, item.title, item.message, item.description, item.label,
        item?.data?.text, item?.data?.fact, item?.payload?.text, item?.payload?.fact,
  item?.document?.fact, item?.document?.text, item?.document?.content
      ]
      const sourceCandidates = [
  item.source, item.factSource, item.type, item.category,
        item?.data?.source, item?.payload?.source, item?.document?.source
      ]
      const timeCandidates = [
  item.at, item.time, item.timestamp, item.ts, item.date, item.when,
        item?.data?.at, item?.payload?.at, item?.document?.at,
        item?.createdAt, item?.updatedAt
      ]
      // ID: accept first non-null candidate and stringify to retain ability to delete problematic records
      let rawId = idCandidates.find((v: any) => v != null && String(v).trim().length > 0)
      // Text: prefer clear, non-empty strings only
      const rawTxt = textCandidates.find((v: any) => typeof v === 'string' && v.trim().length > 0)
      if (rawId == null && rawTxt != null) rawId = rawTxt // fall back to text as identifier if no id
      const sourceTxt = sourceCandidates.find((v: any) => typeof v === 'string' && v.trim().length > 0)
      const rawTime = timeCandidates.find((v: any) => typeof v === 'string' && v.trim().length > 0)
      let atIso: string | undefined
      if (typeof rawTime === 'string' && rawTime.trim()) {
        // Prefer preserving ISO strings; attempt to normalize recognizable formats
        const parsed = Date.parse(rawTime)
        atIso = Number.isFinite(parsed) ? new Date(parsed).toISOString() : rawTime
      } else if (typeof rawTime === 'number') {
        const ms = rawTime < 1e12 ? rawTime * 1000 : rawTime
        atIso = new Date(ms).toISOString()
      }
      return {
        factId: rawId != null ? String(rawId) : '',
        fact: rawTxt != null ? String(rawTxt) : '',
        source: sourceTxt ? String(sourceTxt) : undefined,
        at: atIso
      }
    }
    const mapData = (d: any) => {
      if (Array.isArray(d)) return d
      if (d && typeof d === 'object') return Object.values(d)
      return d ? [d] : []
    }
    const tryPrimary = async () => {
      const r = await api.post('/PersonalQA/_getUserFacts', payload)
      return mapData(r.data).map(normalize) as Array<{ factId: string; fact: string; source?: string; at?: string }>
    }
    const tryAlt = async () => {
      const r = await api.post('/PersonalQA/getUserFacts', payload as any)
      return mapData(r.data).map(normalize) as Array<{ factId: string; fact: string; source?: string; at?: string }>
    }
    const tryGet = async () => {
      const r = await api.get('/PersonalQA/getUserFacts', { params: payload as any })
      return mapData(r.data).map(normalize) as Array<{ factId: string; fact: string; source?: string; at?: string }>
    }
    return tryPrimary()
      .catch(async (e) => {
        // Underscore variant failed; try non-underscore or GET variants
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          try {
            return await tryAlt()
          } catch (e2: any) {
            if (e2?.response?.status === 400 || e2?.response?.status === 404) {
              return await tryGet()
            }
            throw e2
          }
        }
        // As a last resort, try underscore with requester alias
        try {
          const r2 = await api.post('/PersonalQA/_getUserFacts', { requester: (payload as any).owner })
          return mapData(r2.data).map(normalize) as Array<{ factId: string; fact: string; source?: string; at?: string }>
        } catch (e3) {
          throw e
        }
      })
  },
  getUserQAs(payload: { owner: string }) {
    return api.post('/PersonalQA/_getUserQAs', payload)
      .then(r => {
        const d = r.data as any
        const arr = Array.isArray(d) ? d : (d ? [d] : [])
        return arr.map((qa: any) => ({
          question: qa?.question ?? qa?.q ?? '',
          answer: qa?.answer ?? qa?.a ?? ''
        })) as Array<{ question: string; answer: string }>
      })
      .catch(async (e) => {
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          const alt = { requester: (payload as any).owner }
          const r2 = await api.post('/PersonalQA/_getUserQAs', alt)
          const d2 = r2.data as any
          const arr2 = Array.isArray(d2) ? d2 : (d2 ? [d2] : [])
          return arr2.map((qa: any) => ({
            question: qa?.question ?? qa?.q ?? '',
            answer: qa?.answer ?? qa?.a ?? ''
          })) as Array<{ question: string; answer: string }>
        }
        throw e
      })
  }
}

// InsightMining API helpers
export const InsightMiningAPI = {
  ingest(payload: { owner: string; observation: string }) {
    return api.post('/InsightMining/ingest', payload).then(r => {
      const d: any = r.data
      const id = d?.observationId || d?._id || d?.id || d?.key || d?.uuid
      return { observationId: id ? String(id) : '' } as { observationId: string }
    })
  },
  analyze(payload: { owner: string }) {
    return api.post('/InsightMining/analyze', payload).then(r => r.data as { insightIds?: string[] })
  },
  summarize(payload: { owner: string }) {
    // Try primary, then underscore variants
    const run = async () => {
      try {
        const r = await api.post('/InsightMining/summarize', payload)
        return r.data as { report?: string }
      } catch (e: any) {
        if ([400,404,422].includes(e?.response?.status)) {
          try { const r2 = await api.post('/InsightMining/_summarize', payload); return r2.data as { report?: string } } catch {}
        }
        throw e
      }
    }
    return run()
  },
  getObservationsForUser(payload: { owner: string }) {
    return api.post('/InsightMining/_getObservationsForUser', payload).then(r => r.data as Array<{ observationId: string; observation: string }>)
  },
  getInsightsForUser(payload: { owner: string }) {
    return api.post('/InsightMining/_getInsightsForUser', payload).then(r => r.data as Array<{ insightId: string; insight: string }>)
  },
  getReport(payload: { owner: string }) {
    return api.post('/InsightMining/_getReport', payload).then(r => {
      const d: any = r.data
      const arr = Array.isArray(d) ? d : (d ? [d] : [])
      const rep = arr.find((x: any) => typeof x?.report === 'string')?.report || ''
      return { report: rep } as { report: string }
    })
  }
}
