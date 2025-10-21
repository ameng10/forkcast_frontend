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
    // Prefer backend flow: { owner, checkIn, value, at? }
    const primary = {
      owner: (payload as any).owner,
      checkIn: payload.checkInId,
      value: payload.newValue,
      ...(payload.newTimestamp ? { at: new Date(payload.newTimestamp).toISOString() } : {})
    }
    return api.post('/QuickCheckIns/edit', primary)
      .then(r => r.data as {})
      .catch(async (e) => {
        // Fallback to previous shape
        const fallback = {
          owner: (payload as any).owner,
          checkInId: payload.checkInId,
          newValue: payload.newValue,
          newTimestamp: payload.newTimestamp
        }
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          const r2 = await api.post('/QuickCheckIns/edit', fallback)
          return r2.data as {}
        }
        throw e
      })
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
    return api.post('/PersonalQA/forgetFact', payload)
      .then(r => r.data as {})
      .catch(async (e) => {
        if (e?.response?.status === 400 || e?.response?.status === 404) {
          const alt = { requester: (payload as any).owner, factId: payload.factId }
          const r2 = await api.post('/PersonalQA/forgetFact', alt)
          return r2.data as {}
        }
        throw e
      })
  },
  ask(payload: { requester: string; question: string }) {
    return api.post('/PersonalQA/ask', payload).then(r => r.data as { answer: string })
  },
  getUserFacts(payload: { owner: string }) {
    return api.post('/PersonalQA/_getUserFacts', payload).then(r => {
      const d = r.data as any
      return Array.isArray(d) ? d : (d ? [d] : [])
    })
  },
  getUserQAs(payload: { owner: string }) {
    return api.post('/PersonalQA/_getUserQAs', payload).then(r => {
      const d = r.data as any
      return Array.isArray(d) ? d : (d ? [d] : [])
    })
  }
}
