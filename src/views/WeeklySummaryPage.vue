<template>
  <section>
    <h2>Weekly Summary</h2>

    <div class="auth-box">
      <label>
        User:
        <input v-model.trim="owner" placeholder="e.g. alice" />
      </label>
      <button @click="saveOwner" :disabled="!owner">Use User</button>
      <button @click="clearOwner" v-if="auth.ownerId">Clear</button>
      <p v-if="auth.ownerId">Active User: <strong>{{ ownerLabel }}</strong></p>
    </div>

    <div class="range-bar">
      <div class="range-label">{{ rangeLabel }}</div>
      <div class="range-controls">
        <button @click="shiftWeek(-1)">◀ Previous week</button>
        <button @click="resetWeek">This week</button>
        <button @click="shiftWeek(1)" :disabled="!canShiftForward">Next week ▶</button>
      </div>
    </div>

    <p v-if="loadError" class="err">{{ loadError }}</p>

    <div class="grid">
      <div class="card">
        <h3>Selected week</h3>
        <p class="hint">{{ rangeLabel }}</p>
        <ul class="bullets">
          <li>Total meals: <strong>{{ mealsSummary.total }}</strong> (Breakfast {{ mealsSummary.byType.Breakfast || 0 }}, Lunch {{ mealsSummary.byType.Lunch || 0 }}, Snacks {{ mealsSummary.byType.Snacks || 0 }}, Dinner {{ mealsSummary.byType.Dinner || 0 }})</li>
          <li v-if="mealsSummary.topFoods.length">Top foods: <strong>{{ mealsSummary.topFoods.slice(0,5).join(', ') }}</strong></li>
        </ul>
        <details class="diag">
          <summary>Diagnostics</summary>
          <div class="diag-body">
            <div>API ranged count: <strong>{{ diag.apiRangedCount }}</strong></div>
            <div>API unfiltered count: <strong>{{ diag.apiAllCount }}</strong></div>
            <div>Client filtered in-range: <strong>{{ diag.clientInRangeCount }}</strong></div>
            <div>Final samples: <strong>{{ ciSamples.length }}</strong></div>
          </div>
        </details>
      </div>

      <div class="card">
        <h3>Check-ins</h3>
  <p v-if="ciSummary.size === 0" class="hint">No check-ins in this range.</p>
        <template v-else>
          <ul class="ci-list">
            <li v-for="([name, s], idx) in Array.from(ciSummary.entries())" :key="name + '_' + idx">
              <div class="row">
                <div class="metric-name">{{ name }}</div>
                <div class="metric-stats">
                  avg {{ fmt(s.avg) }} ({{ fmt(s.min) }}–{{ fmt(s.max) }}) · {{ s.count }} entries
                  <span v-if="s.delta !== 0" :class="{ up: s.delta > 0, down: s.delta < 0 }">
                    {{ s.delta > 0 ? '▲' : '▼' }} {{ fmt(Math.abs(s.delta)) }}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </template>
      </div>

      <div class="card">
        <h3>Insights</h3>
  <div v-if="backendReport" class="report-box">{{ backendReport }}</div>
        <ul class="bullets" v-if="aiInsights.length">
          <li v-for="(line, i) in aiInsights" :key="i">{{ line }}</li>
        </ul>
        <ul class="bullets" v-else>
          <li v-if="mealsSummary.dominantType">Most meals were <strong>{{ mealsSummary.dominantType }}</strong>.</li>
          <li v-if="trendingUp.length">Trending up: <strong>{{ trendingUp.join(', ') }}</strong></li>
          <li v-if="trendingDown.length">Trending down: <strong>{{ trendingDown.join(', ') }}</strong></li>
          <li v-if="mealsSummary.topFoods.length">You often had: <strong>{{ mealsSummary.topFoods.slice(0,3).join(', ') }}</strong></li>
        </ul>
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMealLogStore, type MealItem, type MealSummary as MealRow } from '../stores/mealLog'
import { QuickCheckInsAPI, InsightMiningAPI } from '../lib/api'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'
import { mineWeeklyInsights } from '../lib/insightMining'

const auth = useAuthStore()
const ml = useMealLogStore()
const quickStore = useQuickCheckInsStore()
function stripOwner(id?: string | null) {
  const s = (id || '').trim()
  return s.startsWith('user:') ? s.slice(5) : s
}
const owner = ref(stripOwner(auth.ownerId))
const ownerLabel = computed(() => stripOwner(auth.ownerId))

const now = () => Date.now()
const ONE_DAY = 24 * 60 * 60 * 1000
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime() }
const endOfDay = (ms: number) => { const d = new Date(ms); d.setHours(23,59,59,999); return d.getTime() }
const endMs = ref(endOfDay(now()))
const startMs = ref(startOfDay(endMs.value - 6 * ONE_DAY)) // last 7 full days (local)
const aiInsights = ref<string[]>([])
const backendReport = ref<string>('')
const diag = ref({ apiRangedCount: 0, apiAllCount: 0, clientInRangeCount: 0 })
const loadError = ref<string | null>(null)

const rangeLabel = computed(() => {
  const a = new Date(startMs.value)
  const b = new Date(endMs.value)
  return `${a.toLocaleDateString()} – ${b.toLocaleDateString()}`
})

// Navigation controls
const canShiftForward = computed(() => endMs.value + 7 * ONE_DAY <= endOfDay(now()))
function shiftWeek(delta: number) {
  const deltaMs = delta * 7 * ONE_DAY
  startMs.value = startOfDay(startMs.value + deltaMs)
  endMs.value = endOfDay(endMs.value + deltaMs)
  loadAll()
}
function resetWeek() {
  const end = endOfDay(now())
  endMs.value = end
  startMs.value = startOfDay(end - 6 * ONE_DAY)
  loadAll()
}

function isTypeItem(it?: MealItem) { return !!(it && typeof it.id === 'string' && it.id.startsWith('type:')) }
function mealTypeOf(items?: MealItem[]) {
  if (!items) return undefined
  const t = items.find(i => String(i?.id || '').startsWith('type:'))
  return t?.name as 'Breakfast'|'Lunch'|'Snacks'|'Dinner'|undefined
}
function friendlyItemName(it?: MealItem) {
  if (!it) return ''
  const name = (it.name || '').toString().trim()
  if (name) return name
  const id = (it.id || '').toString()
  if (id.startsWith('food:')) {
    const slug = id.slice('food:'.length)
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  return ''
}

// Meals summary
const mealsInRange = computed<MealRow[]>(() => {
  const in7 = (ml.meals || []).filter(m => {
    const t = typeof m.at === 'number' ? m.at : (m.at ? Date.parse(String(m.at)) : 0)
    return t >= startMs.value && t <= endMs.value
  })
  return in7
})

const mealsSummary = computed(() => {
  const total = mealsInRange.value.length
  const byType: Record<string, number> = { Breakfast: 0, Lunch: 0, Snacks: 0, Dinner: 0 }
  const foodCounts = new Map<string, number>()
  for (const m of mealsInRange.value) {
    const t = mealTypeOf(m.items)
    if (t) byType[t] = (byType[t] || 0) + 1
    for (const it of (m.items || [])) {
      if (isTypeItem(it)) continue
      const nm = friendlyItemName(it)
      if (!nm) continue
      foodCounts.set(nm, (foodCounts.get(nm) || 0) + 1)
    }
  }
  const topFoods = Array.from(foodCounts.entries()).sort((a,b)=>b[1]-a[1]).map(([n]) => n)
  const dominantType = Object.entries(byType).sort((a,b)=> (b[1]||0) - (a[1]||0))[0]?.[0] || ''
  return { total, byType, topFoods, dominantType }
})

// Check-ins summary
type CISample = { name: string; value: number; ts: number; checkInId?: string }
const ciSamples = ref<CISample[]>([])
const ciSummary = computed(() => {
  // group by name
  const byName = new Map<string, CISample[]>()
  for (const s of ciSamples.value) {
    const key = s.name || 'metric'
    const arr = byName.get(key) || []
    arr.push(s); byName.set(key, arr)
  }
  const out = new Map<string, { avg: number; min: number; max: number; count: number; delta: number }>()
  for (const [name, arr] of byName.entries()) {
    const sorted = arr.slice().sort((a,b)=>a.ts-b.ts)
    const vals = sorted.map(s=>s.value)
    const avg = vals.reduce((a,b)=>a+b,0) / vals.length
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const delta = vals.length >= 2 ? (vals[vals.length-1] - vals[0]) : 0
    out.set(name, { avg, min, max, count: vals.length, delta })
  }
  // Keep map for keyed iteration in template
  return out
})

const trendingUp = computed(() => Array.from(ciSummary.value.entries()).filter(([,s])=>s.delta>0).map(([n])=>n))
const trendingDown = computed(() => Array.from(ciSummary.value.entries()).filter(([,s])=>s.delta<0).map(([n])=>n))

function fmt(n: number) {
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (abs >= 100) return n.toFixed(0)
  if (abs >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

// Avoid showing raw IDs as metric names (MongoID/UUID/ULID/long hex etc.)
function isLikelyId(s?: string) {
  if (!s) return false
  const str = String(s).trim()
  if (!str) return false
  // Mongo ObjectId
  if (/^[a-f0-9]{24}$/i.test(str)) return true
  // UUID v4-like
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(str)) return true
  // ULID
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(str)) return true
  // Long hex-ish tokens
  if (/^[a-f0-9]{16,}$/i.test(str)) return true
  return false
}

async function loadAll() {
  if (!auth.ownerId) return
  loadError.value = null
  diag.value = { apiRangedCount: 0, apiAllCount: 0, clientInRangeCount: 0 }
  const issues: string[] = []
  // Track metric loading errors across scopes
  let metricsError: string | null = null
  // Meals: hydrate list and rely on client-side filter by date
  try {
    await ml.listForOwner()
  } catch (err: any) {
    const code = err?.response?.status
    // Treat 404 as no meals available for owner (not an error)
    if (code !== 404) {
      issues.push(err?.message ?? 'Unable to load meals')
    }
  }
  if (auth.ownerId && quickStore.allMetrics.length === 0) {
    try { await quickStore.hydrateAllMetrics() } catch {}
  }
  // Check-ins: fetch strictly within the selected time window using the API
  const parseTs = (r: any): number | undefined => {
    const candidates = [
      r?.timestamp, r?.ts, r?.date, r?.time, r?.when, r?.createdAt, r?.created_at, r?.created, r?.updatedAt, r?.at,
      r?.timestampMs, r?.timeMs, r?.t
    ]
    for (const c of candidates) {
      if (c == null) continue
      if (typeof c === 'number') return c < 1e12 ? c * 1000 : c
      if (typeof c === 'string' && c.trim()) {
        if (/^\d{9,}$/.test(c.trim())) {
          const n = Number(c.trim())
          if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n
        }
        const p = Date.parse(c)
        if (!Number.isNaN(p)) return p
      }
    }
    return undefined
  }
  const parseVal = (r: any): number | undefined => {
    const candidates = [r?.value, r?.val, r?.amount, r?.score, r?.reading, r?.v, r?.metricValue, r?.data?.value, r?.payload?.value]
    for (const c of candidates) {
      if (c == null) continue
      const num = Number(c)
      if (Number.isFinite(num)) return num
    }
    return undefined
  }
  try {
    let metrics: Array<{ metricId: string; name: string }> = []
    try {
      metrics = await QuickCheckInsAPI.listMetricsForOwner({ owner: auth.ownerId })
    } catch (err: any) {
      metrics = []
  const code = err?.response?.status
  // Treat 404 as no metrics defined yet (not an error)
  metricsError = code === 404 ? null : (err?.message ?? 'Unable to load metric names')
    }
    const nameMap = new Map<string, string>()
    for (const m of metrics) {
      if (!m?.metricId) continue
      const nm = typeof m.name === 'string' ? m.name.trim() : ''
      if (nm) nameMap.set(m.metricId, nm)
      if (nm) quickStore.mergeAllMetrics({ metricId: m.metricId, name: nm })
    }
    for (const m of quickStore.allMetrics) {
      if (m?.metricId && m.name?.trim()) nameMap.set(m.metricId, m.name.trim())
    }

    let listRaw: any[] = []
    let rangedError: string | null = null
    try {
      const ranged = await QuickCheckInsAPI.listByOwner({ owner: auth.ownerId, startDate: startMs.value, endDate: endMs.value })
      listRaw = Array.isArray(ranged) ? ranged : []
      diag.value.apiRangedCount = listRaw.length
    } catch (err: any) {
      const code = err?.response?.status
      // Treat 404 as no data for this range (not an error)
      if (code === 404) {
        listRaw = []
        rangedError = null
      } else {
        listRaw = []
        rangedError = err?.message ?? 'Unable to load check-ins for the selected range'
      }
    }

    if (listRaw.length === 0) {
      let allError: string | null = null
      try {
        const allRaw = await QuickCheckInsAPI.listByOwner({ owner: auth.ownerId })
        const all = Array.isArray(allRaw) ? allRaw : []
        diag.value.apiAllCount = all.length
        listRaw = all.filter((r: any) => {
          const ts = parseTs(r)
          return ts && ts >= startMs.value && ts <= endMs.value
        })
        diag.value.clientInRangeCount = listRaw.length
      } catch (err: any) {
        const code = err?.response?.status
        listRaw = []
        diag.value.clientInRangeCount = 0
        // Treat 404 as no history rather than an error
        if (code === 404) {
          allError = null
        } else {
          allError = err?.message ?? 'Unable to load full check-in history'
        }
      }
      if (!listRaw.length && rangedError) {
        issues.push(allError || rangedError)
      }
    } else {
      diag.value.apiAllCount = listRaw.length
      diag.value.clientInRangeCount = listRaw.length
    }

    const samples: CISample[] = []
    for (const r of listRaw) {
      let ts = parseTs(r)
      if (!ts || Number.isNaN(ts)) continue
      const metricId = (r as any).metricId || (r as any).metric || (r as any).metric_id
      const checkInId = (r as any).checkInId || (r as any).checkIn || (r as any).id || (r as any)._id
      if (checkInId) {
        const override = quickStore.timeOverrides?.[checkInId]
        if (typeof override === 'number' && !Number.isNaN(override)) ts = override
        else if (quickStore.pendingTimes?.[checkInId] != null) {
          const pending = quickStore.pendingTimes[checkInId]
          if (typeof pending === 'number' && !Number.isNaN(pending)) ts = pending
        }
      }
      if (ts < startMs.value || ts > endMs.value) continue
      const value = parseVal(r)
      if (!Number.isFinite(value as number)) continue
      const primaryNameCandidates = [
        (r as any).metricName,
        (r as any).name,
        (r as any).metricLabel,
        (r as any).label,
        (r as any).metric_title,
        (r as any).metric?.name,
        (r as any).metric?.title,
        (r as any).metric?.label,
        (r as any).metricDocument?.name,
        (r as any).metricDocument?.title,
        (r as any).metricDocument?.label,
        (r as any).details?.metricName,
        (r as any).data?.metricName,
        (r as any).payload?.metricName,
        metricId ? nameMap.get(metricId) : undefined
      ]
      // Pick the first non-empty, non-ID-like candidate
      let candidate = primaryNameCandidates.find((n) => typeof n === 'string' && n.trim().length && !isLikelyId(String(n))) as string | undefined
      if (candidate) {
        candidate = candidate.trim()
        if (metricId && candidate === metricId) candidate = ''
      }
      if (!candidate && metricId && typeof metricId === 'string') {
        const cached = quickStore.allMetrics.find((m) => m.metricId === metricId)
        const nm = cached?.name?.trim()
        if (nm && !isLikelyId(nm)) candidate = nm
      }
      // Derive a readable name only if the metricId encodes a label (e.g., "metric:weight"); skip for id-like tokens
      if (!candidate && metricId && typeof metricId === 'string') {
        const cleaned = metricId.replace(/^metric[:_-]?/i, '').replace(/^check[:_-]?/i, '')
        if (cleaned.trim() && !isLikelyId(cleaned) && /[a-zA-Z]/.test(cleaned)) {
          candidate = cleaned
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        }
      }
      const name = (candidate && candidate.trim()) || 'Metric'
      samples.push({ name, value: value as number, ts, checkInId })
    }
    ciSamples.value = samples
  } catch (err: any) {
    ciSamples.value = []
    issues.push(err?.message ?? 'Unable to process check-in data')
  }
    if (ciSamples.value.length === 0 && metricsError) {
      issues.push(metricsError)
    }
  // Build AI insights after data loads
  try { await buildAIInsights() } catch {}
  try { await buildBackendReport() } catch {}
  if (issues.length) {
    const unique = issues.filter(Boolean).filter((msg, idx, arr) => arr.indexOf(msg) === idx)
    const friendly = unique.map((msg) => {
      if (typeof msg === 'string' && msg.toLowerCase().includes('internal server error')) {
        return 'The quick check-ins service returned an internal error. Please try again later.'
      }
      return msg
    })
    loadError.value = friendly.join(' | ')
  }
}

function useOwner() {
  auth.setSession(owner.value)
  loadAll()
}
// Keep compatibility with template's button handler
const saveOwner = useOwner
function clearOwner() {
  auth.clear()
  loadError.value = null
  ciSamples.value = []
  aiInsights.value = []
  backendReport.value = ''
  diag.value = { apiRangedCount: 0, apiAllCount: 0, clientInRangeCount: 0 }
}

onMounted(() => { if (auth.ownerId) loadAll() })
// Build a compact weekly summary and ask the LLM for plain-language insights.
async function buildAIInsights() {
  if (!auth.ownerId) { aiInsights.value = []; return }
  // Compose a concise, ID-free summary object
  const week: any = {
    window: {
      start: new Date(startMs.value).toISOString(),
      end: new Date(endMs.value).toISOString(),
  widenedTo30Days: false
    },
    meals: {
      total: mealsSummary.value.total,
      byType: mealsSummary.value.byType,
      topFoods: mealsSummary.value.topFoods.slice(0, 10)
    },
    checkIns: Array.from(ciSummary.value.entries()).map(([name, s]) => ({
      name, avg: s.avg, min: s.min, max: s.max, count: s.count, delta: s.delta
    }))
  }
  try {
    aiInsights.value = await mineWeeklyInsights(auth.ownerId, week)
  } catch {
    aiInsights.value = []
  }
}

// Compose a weekly observation and ask InsightMining backend to analyze + summarize
async function buildBackendReport() {
  backendReport.value = ''
  if (!auth.ownerId) return
  // Build a compact, human-readable weekly quick check-ins summary as one observation string
  const parts: string[] = []
  for (const [name, s] of ciSummary.value.entries()) {
    const trend = s.delta ? `, ${s.delta > 0 ? 'up' : 'down'} ${fmt(Math.abs(s.delta))}` : ''
    parts.push(`${name}: avg ${fmt(s.avg)} (min ${fmt(s.min)}, max ${fmt(s.max)}) over ${s.count} entries${trend}`)
  }
  const obs = parts.length
    ? `Weekly quick check-ins from ${new Date(startMs.value).toISOString()} to ${new Date(endMs.value).toISOString()}: ` + parts.join('; ')
    : `No quick check-ins between ${new Date(startMs.value).toISOString()} and ${new Date(endMs.value).toISOString()}.`
  try {
    // Ingest observation, analyze, then summarize
    await InsightMiningAPI.ingest({ owner: auth.ownerId, observation: obs })
    try { await InsightMiningAPI.analyze({ owner: auth.ownerId }) } catch {}
    const { report } = await InsightMiningAPI.summarize({ owner: auth.ownerId })
    if (typeof report === 'string' && report.trim()) {
      backendReport.value = report.trim()
      return
    }
    // Fallback to _getReport if summarize didn’t return inline
    try {
      const r = await InsightMiningAPI.getReport({ owner: auth.ownerId })
      if (r?.report) backendReport.value = r.report
    } catch {}
  } catch {}
}
</script>

<style scoped>
.auth-box { display:flex; gap:8px; align-items:center; margin-bottom: 16px; }
.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
.card { border:1px solid var(--border); border-radius:8px; padding:12px; background: var(--surface); }
.hint { color:var(--text-muted); font-size:12px; }
.bullets { margin: 0; padding-left: 16px; }
.ci-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.metric-name { font-weight:600; }
.metric-stats { color:var(--text); font-size: 13px; display:flex; gap:8px; align-items:center; }
.up { color:var(--brand-primary-strong); }
.down { color:#b00020; }
.note { color:var(--text-muted); font-size:12px; margin-top: 8px; }
.err { color:#b00020; margin: 12px 0; font-size:13px; }
.report-box { background: #F8FAFC; border: 1px solid var(--border); padding: 8px; border-radius: 6px; margin: 8px 0; white-space: pre-wrap; }
</style>
<style scoped>
.range-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
