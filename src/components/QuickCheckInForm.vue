<template>
  <div class="card">
    <h3>Record a Check-In</h3>
    <div class="row">
      <label>
        Metric Name
        <input v-model.trim="metricName" list="metricOptions" placeholder="e.g. weight" />
        <datalist id="metricOptions">
          <option v-for="m in store.allMetrics" :key="m.metricId" :value="m.name" />
        </datalist>
        <small v-if="metricName && !metricExists" class="warn">This metric doesn't exist. Please define it first.</small>
      </label>
      <label>
        Choose Metric
        <select v-model="selectedMetricName" @change="onChooseMetric">
          <option value="">Select metric…</option>
          <option v-for="m in metricsOptions" :key="m.metricId" :value="m.name">{{ m.name }}</option>
        </select>
      </label>
      <label>
        Value
        <input v-model.number="value" type="number" step="any" placeholder="e.g. 175.2" ref="valueInput" />
      </label>
    </div>
    <div class="row">
      <label>
        When
        <input v-model="timestampLocal" type="datetime-local" step="1" />
      </label>
      <button type="button" @click="setNow">Now</button>
    </div>
    <div class="row">
      <button @click="submit" :disabled="!canSubmit">Record</button>
    </div>
    <p v-if="store.error" class="err">{{ store.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'

const store = useQuickCheckInsStore()

const props = defineProps<{ presetMetricName?: string }>()
const metricName = ref('')
const value = ref<number | null>(null)
const timestamp = ref<number | null>(null)
const timestampLocal = ref<string>('')
const valueInput = ref<HTMLInputElement | null>(null)
const selectedMetricName = ref('')
const metricsOptions = computed(() => (store.allMetrics || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')))

watch(() => props.presetMetricName, async (nm) => {
  if (nm) {
    metricName.value = nm
    await nextTick()
    valueInput.value?.focus()
  }
}, { immediate: true })

const metricExists = computed(() => {
  const name = metricName.value.trim().toLowerCase()
  if (!name) return false
  return store.allMetrics.some(m => (m.name || '').toLowerCase() === name)
})
const canSubmit = computed(() => !!metricName.value && value.value !== null && metricExists.value)
onMounted(async () => {
  // Seed dropdown with a common query (empty or wildcard equivalents aren't supported, so we can request popular terms if you have any)
  try {
  // Hydrate full metric list for owner so the datalist is useful
  await store.hydrateAllMetrics()
  // If there is a preset metric, load that name for caching and suggestions
  if (props.presetMetricName) await store.loadMetrics(props.presetMetricName)
  } catch {}
})

function onChooseMetric() {
  if (selectedMetricName.value) {
    metricName.value = selectedMetricName.value
    nextTick(() => valueInput.value?.focus())
  }
}

async function submit() {
  if (!canSubmit.value) return
  // Convert local datetime to ms if provided
  let ts: number | undefined = undefined
  if (timestampLocal.value) {
    const t = Date.parse(timestampLocal.value)
    if (!Number.isNaN(t)) ts = t
  } else if (timestamp.value != null) {
    ts = timestamp.value
  }
  await store.record(metricName.value, value.value!, ts)
  const emittedName = metricName.value
  emit('recorded', { metricName: emittedName })
  metricName.value = ''
  value.value = null
  timestamp.value = null
  timestampLocal.value = ''
}
function setNow() {
  const d = new Date()
  timestampLocal.value = toInputLocal(d)
}
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

const emit = defineEmits<{ (e: 'recorded', payload: { metricName: string }): void }>()
</script>

<style scoped>
.card { border:1px solid var(--border); border-radius:8px; padding:12px; background: var(--surface); }
.row { display:flex; gap:12px; align-items:flex-end; margin:8px 0; flex-wrap: wrap; }
label { display:flex; flex-direction:column; gap:4px; }
.err { color:#b00020; }
</style>
