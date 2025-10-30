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
    // Spec-first: { owner, checkInId, newValue, newTimestamp? }
    const tsMs = payload.newTimestamp
    const tsSec = tsMs != null ? Math.floor(tsMs / 1000) : undefined
    const atIso = tsMs != null ? new Date(tsMs).toISOString() : undefined
    const specBody: any = {
      owner: (payload as any).owner,
      checkInId: payload.checkInId,
      newValue: payload.newValue,
      ...(tsSec != null ? { newTimestamp: tsSec } : {}),
      ...(tsSec != null ? { timestamp: tsSec } : {}),
      // Provide ISO too to help backends that accept `at`
      ...(atIso ? { at: atIso } : {}),
      // Also include alternate shape proactively for compatibility
      checkIn: payload.checkInId,
      value: payload.newValue
    }
    return api.post('/QuickCheckIns/edit', specBody).then(r => r.data as {})
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
    if (payload.owner) base.owner = payload.owner
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
            // Treat not-found as already-deleted success
            return {}
          }
          if (![400,404,422].includes(code)) throw err
        }
      }
      throw lastErr
    }
    return run()
  },
  // Allow filtering by metric ID; send both metricId and metric for compatibility
  listByOwner(payload: { owner: string; metricId?: string; metric?: string; startDate?: number; endDate?: number }) {
    const body: any = { owner: payload.owner }
  if (payload.metricId) { body.metricId = payload.metricId; body.metric = payload.metricId }
    if (payload.metric && !payload.metricId) body.metric = payload.metric
    if (payload.startDate) body.startDate = payload.startDate
    if (payload.endDate) body.endDate = payload.endDate
    return api.post('/QuickCheckIns/_listCheckInsByOwner', body).then(r => r.data as any[])
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
          if (![400,404,422].includes(err?.response?.status)) throw err
        }
      }
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
  submit(payload: { ownerId: string; at: string; items: Array<Record<string, any>>; notes?: string }) {
    return api.post('/MealLog/submit', payload).then(r => r.data as { mealId: string })
  },
  edit(payload: { callerId: string; mealId: string; items?: Array<Record<string, any>>; notes?: string; at?: string }) {
    // Spec-first with broad time aliases to maximize compatibility
    const at = (payload as any).at as string | undefined
    const body: any = {
      callerId: (payload as any).callerId,
      ownerId: (payload as any).callerId,
      owner: (payload as any).callerId,
      requester: (payload as any).callerId,
      mealId: payload.mealId,
      id: payload.mealId,
      _id: payload.mealId,
      mealObjectId: payload.mealId,
      mealDocumentId: payload.mealId
    }
    if (payload.items !== undefined) body.items = payload.items
    if (payload.notes !== undefined) body.notes = payload.notes
    if (at) {
      const ts = Date.parse(at)
      body.at = at
      if (!Number.isNaN(ts)) {
        const ms = ts
        const sec = Math.floor(ms / 1000)
        // Include common aliases some backends accept
        Object.assign(body, {
          date: ms,
          timestamp: sec,
          newAt: at,
          newDate: ms,
          newTimestamp: sec,
          when: at,
          time: at
        })
      }
    }
    return api.post('/MealLog/edit', body)
      .then(r => r.data as {})
      .catch(async (e) => {
        if ([400, 404, 422].includes(e?.response?.status)) {
          // Fallback: try minimal then alias variants flipped if primary failed
          const minimal: any = {
            callerId: (payload as any).callerId,
            ownerId: (payload as any).callerId,
            owner: (payload as any).callerId,
            requester: (payload as any).callerId,
            mealId: payload.mealId,
            id: payload.mealId,
            _id: payload.mealId,
            mealObjectId: payload.mealId,
            mealDocumentId: payload.mealId
          }
          if (payload.items !== undefined) minimal.items = payload.items
          if (payload.notes !== undefined) minimal.notes = payload.notes
          if (at) minimal.at = at
          try {
            const rMin = await api.post('/MealLog/edit', minimal)
            return rMin.data as {}
          } catch (e2: any) {
            if ([400, 404, 422].includes(e2?.response?.status)) {
              const ts = at ? Date.parse(at) : undefined
              const alt: any = {
                callerId: (payload as any).callerId,
                ownerId: (payload as any).callerId,
                owner: (payload as any).callerId,
                requester: (payload as any).callerId,
                mealId: payload.mealId,
                id: payload.mealId,
                _id: payload.mealId,
                mealObjectId: payload.mealId,
                mealDocumentId: payload.mealId,
                ...(payload.items !== undefined ? { items: payload.items } : {}),
                ...(payload.notes != null ? { notes: payload.notes } : {}),
                ...(at ? { at } : {}),
                ...(ts && !Number.isNaN(ts) ? { date: ts, timestamp: Math.floor(ts / 1000), newDate: ts, newTimestamp: Math.floor(ts / 1000), newAt: at, when: at, time: at } : {})
              }
              try {
                const r2 = await api.post('/MealLog/edit', alt)
                return r2.data as {}
              } catch (e3: any) {
                // Final fallback to underscore variant if available
                const r3 = await api.post('/MealLog/_edit', alt)
                return r3.data as {}
              }
            }
            throw e2
          }
        }
        throw e
      })
  },
  delete(payload: { callerId: string; mealId: string }) {
    return api.post('/MealLog/delete', payload).then(r => r.data as {})
  },
  getMealsForOwner(payload: { ownerId: string; includeDeleted?: boolean }) {
    return api.post('/MealLog/getMealsForOwner', payload)
      .then(r => r.data as any)
      .catch(async (e) => {
        if (e?.response?.status === 404) {
          // Try underscore variant as fallback
          const r2 = await api.post('/MealLog/_getMealsForOwner', payload)
          return r2.data as any
        }
        throw e
      })
  },
  getMealById(payload: { mealId: string; callerId: string }) {
    return api.post('/MealLog/getMealById', payload)
      .then(r => r.data as any)
      .catch(async (e) => {
        if (e?.response?.status === 404) {
          // Try underscore/object variant fallback
          const r2 = await api.post('/MealLog/_getMealObjectById', { mealObjectId: payload.mealId })
          return r2.data as any
        }
        throw e
      })
  }
}

// PersonalQA API helpers
export const PersonalQAAPI = {
  ingestFact(payload: { owner: string; fact: string }) {
    return api.post('/PersonalQA/ingestFact', payload)
      .then(r => {
        const d: any = r.data
        const id = d?.factId || d?._id || d?.id || d?.key || d?.uuid || d?.docId || d?.documentId || d?.insertedId || d?.upsertedId || d?.result?.id || d?.result?._id || d?.document?._id || d?.document?.id
        return { factId: id ? String(id) : '' } as { factId: string }
      })
      .catch(async (e) => {
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          const alt = { requester: (payload as any).owner, fact: payload.fact }
          const r2 = await api.post('/PersonalQA/ingestFact', alt)
          const d2: any = r2.data
          const id2 = d2?.factId || d2?._id || d2?.id || d2?.key || d2?.uuid || d2?.docId || d2?.documentId || d2?.insertedId || d2?.upsertedId || d2?.result?.id || d2?.result?._id || d2?.document?._id || d2?.document?.id
          return { factId: id2 ? String(id2) : '' } as { factId: string }
        }
        throw e
      })
  },
  forgetFact(payload: { owner: string; factId: string }) {
    // Try a few payload variants for broader backend compatibility
    const attempts: Array<Record<string, any>> = [
      // Primary
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
        }
      }
      throw lastErr
    }
    return run()
  },
  ask(payload: { requester: string; question: string }) {
    return api.post('/PersonalQA/ask', payload).then(r => r.data as { answer: string })
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
      // ID: accept first non-null candidate and stringify to retain ability to delete problematic records
      let rawId = idCandidates.find((v: any) => v != null && String(v).trim().length > 0)
      // Text: prefer clear, non-empty strings only
      const rawTxt = textCandidates.find((v: any) => typeof v === 'string' && v.trim().length > 0)
      if (rawId == null && rawTxt != null) rawId = rawTxt // fall back to text as identifier if no id
      return { factId: rawId != null ? String(rawId) : '', fact: rawTxt != null ? String(rawTxt) : '' }
    }
    const mapData = (d: any) => {
      if (Array.isArray(d)) return d
      if (d && typeof d === 'object') return Object.values(d)
      return d ? [d] : []
    }
    const tryPrimary = async () => {
      const r = await api.post('/PersonalQA/_getUserFacts', payload)
      return mapData(r.data).map(normalize)
    }
    const tryAlt = async () => {
      const r = await api.post('/PersonalQA/getUserFacts', payload as any)
      return mapData(r.data).map(normalize)
    }
    const tryGet = async () => {
      const r = await api.get('/PersonalQA/getUserFacts', { params: payload as any })
      return mapData(r.data).map(normalize)
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
          return mapData(r2.data).map(normalize)
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
