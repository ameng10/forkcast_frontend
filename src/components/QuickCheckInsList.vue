<template>
  <div>
    <div class="filters">
      <label>
        Metric:
        <input v-model.trim="metricFilter" placeholder="e.g. weight" />
      </label>
  <button @click="applyFilter">Apply</button>
      <button @click="clearFilter" v-if="metricFilter">Clear</button>
    </div>

    <p v-if="store.loading">Loading…</p>
    <p v-if="store.error" class="err">{{ store.error }}</p>

    <ul class="list">
  <li v-for="ci in store.checkIns" :key="ci.checkInId">
        <div class="row">
          <div>
            <div class="meta">{{ ci.metricName || shorten(ci.metric) || 'metric' }} · {{ formatTime(ci.timestamp, ci.at) }}</div>
            <div class="val">{{ ci.value }}</div>
          </div>
          <div class="actions">
            <button @click="startEdit(ci.checkInId, ci.value)">Edit</button>
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
    </ul>
  <p v-if="!store.loading && store.checkIns.length === 0">No check-ins yet.</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'

const store = useQuickCheckInsStore()

const metricFilter = ref('')
const editingId = ref<string | null>(null)
const editValue = ref<number | null>(null)
const editAt = ref<string | null>(null)

function formatTime(ts?: number, at?: string) {
  const d = ts ? new Date(ts) : (at ? new Date(at) : new Date())
  return d.toLocaleString()
}
function shorten(id?: string) {
  if (!id) return undefined
  return id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id
}
async function applyFilter() {
  await store.listCheckIns({ metricName: metricFilter.value })
}
async function clearFilter() {
  metricFilter.value = ''
  await store.listCheckIns({ metricName: '' })
}
async function setMetric(name?: string) {
  metricFilter.value = name ?? ''
  await store.listCheckIns({ metricName: metricFilter.value })
}
function startEdit(id: string, value: number) {
  editingId.value = id
  editValue.value = value
  const ci = store.checkIns.find(x => x.checkInId === id)
  const d = ci?.timestamp ? new Date(ci.timestamp) : (ci?.at ? new Date(ci.at) : new Date())
  editAt.value = toInputLocal(d)
}
function cancelEdit() {
  editingId.value = null
  editValue.value = null
  editAt.value = null
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
.filters { display:flex; gap:8px; align-items:center; margin-bottom: 8px; }
.list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.row { display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #e5e5e5; border-radius:8px; }
.meta { color:#666; font-size:12px; }
.val { font-weight:600; font-size:16px; }
.edit { margin-top:8px; display:flex; gap:8px; align-items:flex-end; flex-wrap: wrap; }
.edit-field { display:flex; gap:6px; align-items:center; }
.err { color: #b00020; }
</style>
