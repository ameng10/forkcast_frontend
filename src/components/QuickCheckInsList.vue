<template>
  <div>
    <div class="filters">
      <label>
        Metric:
        <input v-model.trim="metricFilter" list="metricOptions" placeholder="e.g. weight" />
        <datalist id="metricOptions">
          <option v-for="m in store.allMetrics" :key="m.metricId" :value="m.name" />
        </datalist>
      </label>
      <button @click="applyFilter">Apply</button>
      <button @click="clearFilter" v-if="metricFilter">Clear</button>
      <label>
        Sort by:
        <select v-model="store.sortBy" @change="applyFilter">
          <option value="time">Date (newest)</option>
          <option value="metricName">Metric name (A→Z)</option>
        </select>
      </label>
      <label style="margin-left:16px;">
        Group by day
        <input type="checkbox" v-model="groupByDay" />
      </label>
    </div>


    <div v-if="showDefinedMetricsToggle" class="defined-metrics">
      <button class="metrics-toggle" @click="showMetrics = !showMetrics">Defined metrics ({{ store.allMetrics.length }}) ▾</button>
      <div v-if="showMetrics" class="metrics-popup">
        <ul v-if="store.allMetrics.length" class="metrics-list">
          <li v-for="m in store.allMetrics" :key="m.metricId" class="metric-item">
            <span>{{ m.name }}</span>
            <button class="delete-metric" title="Delete metric" @click="onDeleteMetric(m.metricId)">Delete</button>
          </li>
        </ul>
        <p v-else class="empty">No metrics defined yet.</p>
        <p v-if="store.error" class="err">{{ store.error }}</p>
      </div>
    </div>

    <p v-if="store.loading">Loading…</p>
    <p v-if="store.error" class="err">{{ store.error }}</p>

    <ul class="list">
      <template v-for="group in groupedCheckIns" :key="group.day || 'all'">
  <li v-if="groupByDay && group.day" class="day-header" style="margin: 8px 0 4px; font-family: 'Fredoka', Nunito, Arial, sans-serif; font-size: 18px; font-weight: 700; color: var(--brand-primary);">{{ group.day }}</li>
        <li v-for="ci in group.items" :key="ci.checkInId">
          <div class="row">
            <div>
              <div class="meta" style="font-size:12px;">{{ ci.metricName || 'metric' }} · {{ formatTime(ci.timestamp, ci.at) }}</div>
              <div class="val" style="font-size:16px; font-weight:600;">{{ ci.value }}</div>
            </div>
            <div class="actions">
              <button @click="startEdit(ci.checkInId, ci.value)" style="background:var(--brand-primary);color:#fff;border-radius:8px;padding:8px 18px;font-size:15px;font-weight:600;border:1px solid var(--brand-primary);margin-left:0;margin-right:8px;">Edit</button>
              <button @click="remove(ci.checkInId)" style="background:#b00020;color:#fff;border-radius:8px;padding:8px 18px;font-size:15px;font-weight:600;border:1px solid #b00020;margin-left:0;">Delete</button>
            </div>
          </div>
          <div v-if="editingId === ci.checkInId" class="edit">
            <label class="edit-field">
              Value
              <input type="number" v-model.number="editValue" step="any" />
            </label>
            <label class="edit-field">
              When
              <input type="datetime-local" v-model="editAt" step="1" />
            </label>
            <button @click="saveEdit(ci.checkInId)" :disabled="store.loading">{{ store.loading ? 'Saving…' : 'Save' }}</button>
            <button @click="cancelEdit" :disabled="store.loading">Cancel</button>
          </div>
        </li>
      </template>
    </ul>
  <p v-if="!store.loading && store.checkIns.length === 0">No check-ins yet.</p>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, computed, watchEffect } from 'vue'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'

const groupByDay = ref(false)
// Metric filter lives client-side to avoid unnecessary server refreshes
const metricFilter = ref('')
const groupedCheckIns = computed(() => {
  const base = store.checkIns.filter(ci => {
    const f = metricFilter.value.trim()
    if (!f) return true
    return (ci.metricName || '').toLowerCase() === f.toLowerCase()
  })
  if (!groupByDay.value) return [{ day: null, items: base }]
  const groups = new Map<string, any[]>()
  for (const ci of base) {
    const d = ci.timestamp ? new Date(ci.timestamp) : (ci.at ? new Date(ci.at) : new Date())
    const key = isNaN(d.getTime()) ? 'Unknown' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  if (!groups.has(key)) groups.set(key, [])
  const arr = groups.get(key)
  if (arr) arr.push(ci)
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0] < b[0] ? 1 : -1)
    .map(([day, items]) => ({ day, items }))
})

const store = useQuickCheckInsStore()
const props = defineProps<{ showDefinedMetricsToggle?: boolean }>()
const showMetrics = ref(false)
async function onDeleteMetric(metricId: string) {
  await store.deleteMetric(metricId)
  // Keep the popup open; list will update reactively
}
onMounted(() => { store.hydrateAllMetrics().catch(() => {}) })
const editingId = ref<string | null>(null)
const editValue = ref<number | null>(null)
const editAt = ref<string | null>(null)
// only edit value/time; name is displayed from store

function formatTime(ts?: number, at?: string) {
  const d = ts ? new Date(ts) : (at ? new Date(at) : new Date())
  return d.toLocaleString()
}
function shorten(id?: string) {
  if (!id) return undefined
  return id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id
}
function applyFilter() {
  // client-side only; server list updates are triggered on navigation and mutations (record/edit/delete)
}
function clearFilter() {
  metricFilter.value = ''
}
function setMetric(name?: string) {
  metricFilter.value = name ?? ''
}
function startEdit(id: string, value: number) {
  editingId.value = id
  editValue.value = value
  const ci = store.checkIns.find(x => x.checkInId === id)
  const d = ci?.timestamp ? new Date(ci.timestamp) : (ci?.at ? new Date(ci.at) : new Date())
  editAt.value = toInputLocal(d)
  // no name editing
}
function cancelEdit() {
  editingId.value = null
  editValue.value = null
  editAt.value = null
  // no name editing
}
async function saveEdit(id: string) {
  if (editValue.value == null) return
  let ts: number | undefined = undefined
  if (editAt.value) {
    const t = Date.parse(editAt.value)
    if (!Number.isNaN(t)) ts = t
  }
  await store.edit(id, editValue.value, ts)
  cancelEdit()
}

async function remove(id: string) {
  await store.deleteCheckIn(id)
}

async function doDelete(metricId: string) {
  if (!metricId) return
  const ok = await store.deleteMetric(metricId)
  if (ok) await applyFilter()
}

watchEffect(async () => {
  // When the user types a filter, attempt to load metrics by that name to populate dropdown
  const name = metricFilter.value.trim()
  if (name) {
    try { await store.loadMetrics(name) } catch {}
  }
})

defineExpose({ setMetric })

function toInputLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${m}-${d}T${h}:${min}:${s}`
}
</script>

<style scoped>
.filters { display:flex; gap:8px; align-items:center; margin-bottom: 8px; flex-wrap: wrap; }
.list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.row { display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border); border-radius:8px; background: var(--surface); }
.actions { display:flex; align-items:center; gap:8px; }
.meta { color:var(--text-muted); font-size:12px; }
.val { font-weight:600; font-size:16px; }
.edit { margin-top:8px; display:flex; gap:8px; align-items:flex-end; flex-wrap: wrap; }
.edit-field { display:flex; gap:6px; align-items:center; }
.rename { margin-top:4px; }
.rename-row { display:flex; gap:8px; align-items:center; margin-top:4px; }
.danger { color:#b00020; }
.err { color: #b00020; }
</style>
<style scoped>
.defined-metrics { position: relative; margin-bottom: 8px; }
.metrics-toggle { border:1px solid var(--border); background:var(--surface); padding:6px 10px; border-radius:6px; cursor:pointer; color: var(--brand-accent); }
.metrics-toggle:hover { background: rgba(34,197,94,0.08); }
.metrics-popup { position: absolute; z-index: 10; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px; margin-top: 6px; width: 260px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.metrics-list { list-style: none; margin: 0; padding: 0; max-height: 200px; overflow: auto; }
.metrics-list li { padding: 6px 4px; border-bottom: 1px solid var(--border); }
.metrics-list li:last-child { border-bottom: none; }
.metric-item { display:flex; justify-content:space-between; gap:8px; align-items:center; }
.delete-metric { color:#b00020; border:none; background:transparent; cursor:pointer; }
.empty { color: var(--text-muted); }
</style>
