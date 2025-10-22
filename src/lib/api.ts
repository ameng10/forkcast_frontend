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
    return api.post('/QuickCheckIns/defineMetric', payload).then(r => {
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
  // Allow filtering by metric ID; send both metricId and metric for compatibility
  listByOwner(payload: { owner: string; metricId?: string; metric?: string; startDate?: number; endDate?: number }) {
    const body: any = { owner: payload.owner }
  if (payload.metricId) { body.metricId = payload.metricId; body.metric = payload.metricId }
    if (payload.metric && !payload.metricId) body.metric = payload.metric
    if (payload.startDate) body.startDate = payload.startDate
    if (payload.endDate) body.endDate = payload.endDate
    return api.post('/QuickCheckIns/_listCheckInsByOwner', body).then(r => r.data as any[])
  }
}

// MealLog API helpers (updated shapes from spec)
export const MealLogAPI = {
  submit(payload: { ownerId: string; at: string; items: Array<Record<string, any>>; notes?: string }) {
    return api.post('/MealLog/submit', payload).then(r => r.data as { mealId: string })
  },
  edit(payload: { callerId: string; mealId: string; items: Array<Record<string, any>>; notes?: string }) {
    return api.post('/MealLog/edit', payload).then(r => r.data as {})
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
      .then(r => r.data as { factId: string })
      .catch(async (e) => {
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          const alt = { requester: (payload as any).owner, fact: payload.fact }
          const r2 = await api.post('/PersonalQA/ingestFact', alt)
          return r2.data as { factId: string }
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
      if (typeof item === 'string') return { factId: item, fact: item }
      // Collect candidate id/text fields across common shapes
      const idCandidates = [
        item.factId, item._id, item.id, item.key, item.identifier, item.uuid, item.docId, item.documentId,
        item?.document?._id, item?.document?.id
      ]
      const textCandidates = [
        item.fact, item.text, item.value, item.content, item.statement, item.body, item.note,
        item.name, item.title, item.message, item.description,
        item?.data?.text, item?.data?.fact, item?.payload?.text, item?.payload?.fact,
        item?.document?.fact, item?.document?.text, item?.document?.content
      ]
      // Strict normalization: if there is no clear text field, leave it blank (do NOT fall back to owner or _id for text)
      const id = idCandidates.find((v: any) => typeof v === 'string' && v.trim().length > 0)
      const txt = textCandidates.find((v: any) => typeof v === 'string' && v.trim().length > 0)
      return { factId: String(id ?? ''), fact: String(txt ?? '') }
    }
    return api.post('/PersonalQA/_getUserFacts', payload)
      .then(r => {
        const d = r.data as any
        const arr = Array.isArray(d) ? d : (d ? [d] : [])
        return arr.map(normalize) as Array<{ factId: string; fact: string }>
      })
      .catch(async (e) => {
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          const alt = { requester: (payload as any).owner }
          const r2 = await api.post('/PersonalQA/_getUserFacts', alt)
          const d2 = r2.data as any
          const arr2 = Array.isArray(d2) ? d2 : (d2 ? [d2] : [])
          return arr2.map(normalize) as Array<{ factId: string; fact: string }>
        }
        throw e
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
