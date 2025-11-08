<template>
  <section>
    <h2>Quick Check-Ins</h2>

    <div class="auth-box" v-if="!auth.userId">
      <p>Please <router-link to="/auth">login or register</router-link> to continue.</p>
    </div>

    <div class="grid grid-3">
      <!-- Left: Record a Check-In -->
      <div class="col">
        <QuickCheckInForm :presetMetricName="presetMetric" @recorded="onRecorded" />
      </div>

      <!-- Middle: Recent Check-Ins -->
      <div class="col">
        <div class="card">
          <h3>Recent Check-Ins</h3>
          <QuickCheckInsList ref="listRef" :showDefinedMetricsToggle="false" />
        </div>
      </div>

      <!-- Right: Define a Metric + Defined Metrics list -->
      <div class="col">
        <div class="card">
          <h3>Define a Metric</h3>
          <DefineMetricForm @metric-defined="onMetricDefined" />
          <hr />
          <h3 class="metrics-title">Defined metrics ({{ qci.allMetrics.length }})</h3>
          <ul class="metrics-list">
            <li v-for="m in qci.allMetrics" :key="m.metricId" class="metric-item">
              <button class="metric-link" @click="selectMetric(m.name)">{{ m.name }}</button>
              <button class="delete-metric" title="Delete metric" @click="doDeleteMetric(m.metricId)">Delete</button>
            </li>
          </ul>
          <p v-if="!qci.allMetrics.length" class="empty">No metrics defined yet.</p>
          <p v-if="qci.error" class="err">{{ qci.error }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'
import QuickCheckInsList from '../components/QuickCheckInsList.vue'
import QuickCheckInForm from '../components/QuickCheckInForm.vue'
import DefineMetricForm from '../components/DefineMetricForm.vue'

const auth = useAuthStore()
const qci = useQuickCheckInsStore()
const listRef = ref<InstanceType<typeof QuickCheckInsList> | null>(null)
const presetMetric = ref<string | undefined>(undefined)

function onRecorded(payload: { metricName: string }) {
  // Refresh and focus on that metric
  listRef.value?.setMetric(payload.metricName)
  // keep preset to encourage continued recording
  presetMetric.value = payload.metricName
}

function onMetricDefined(payload: { name: string }) {
  // After defining, show an empty list for that metric as a hint
  listRef.value?.setMetric(payload.name)
  // Prefill the record form metric to tie user->metric->record flow
  presetMetric.value = payload.name
}

async function doDeleteMetric(metricId: string) {
  if (!metricId) return
  const ok = await qci.deleteMetric(metricId)
  if (ok) {
    // keep UI reactive; list and metrics will refresh via store
  }
}

function selectMetric(name?: string) {
  if (!name) return
  listRef.value?.setMetric(name)
}

onMounted(() => {
  // Hydrate metrics once for the right-side list
  qci.hydrateAllMetrics(false).catch(() => {})
  // Explicit initial list load (navigation to page). Force ensures _listCheckInsByOwner attempted first.
  if (auth.session) {
    qci.listCheckIns({ force: true })
  }
})
</script>

<style scoped>
.auth-box { display:flex; gap:8px; align-items:center; margin-bottom: 16px; }
.grid { display:grid; gap: 20px; align-items: start; }
.grid-3 { grid-template-columns: repeat(3, minmax(450px, 1fr)); }
.col { min-width: 0; }
.col .card { border:1px solid var(--border); border-radius:8px; padding:12px; background: var(--surface); }
/* Breakpoints for strict 3/2/1 layout based on 450px min column + gaps */
@media (max-width: 1420px) {
  .grid-3 { grid-template-columns: repeat(2, minmax(450px, 1fr)); }
}
@media (max-width: 960px) {
  .grid-3 { grid-template-columns: minmax(450px, 1fr); }
}
/* Defined metrics styling */
.metrics-title { color: var(--brand-accent); }
.metrics-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.metric-item { display:flex; justify-content:space-between; gap:8px; align-items:center; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.metric-item:last-child { border-bottom: none; }
.metric-link { background: transparent; border: none; padding: 0; color: var(--text); cursor: pointer; text-align: left; max-width: 100%; overflow-wrap: anywhere; }
.delete-metric { color:#b00020; border:none; background:transparent; cursor:pointer; }
.empty { color: var(--text-muted); }
</style>
