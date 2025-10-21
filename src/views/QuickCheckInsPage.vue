<template>
  <section>
    <h2>Quick Check-Ins</h2>

    <div class="auth-box">
      <label>
        Owner ID:
  <input v-model.trim="owner" placeholder="Alice or user:Alice" />
      </label>
      <button @click="saveOwner" :disabled="!owner">Use Owner</button>
      <button @click="clearOwner" v-if="auth.ownerId">Clear</button>
      <p v-if="auth.ownerId">Active owner: <strong>{{ auth.ownerId }}</strong></p>
    </div>

    <div class="grid">
      <div>
  <QuickCheckInForm :presetMetricName="presetMetric" @recorded="onRecorded" />
        <hr />
        <DefineMetricForm @metric-defined="onMetricDefined" />
      </div>
      <div>
  <h3>Recent Check-Ins</h3>
  <QuickCheckInsList ref="listRef" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'
import QuickCheckInsList from '../components/QuickCheckInsList.vue'
import QuickCheckInForm from '../components/QuickCheckInForm.vue'
import DefineMetricForm from '../components/DefineMetricForm.vue'

const auth = useAuthStore()
const qci = useQuickCheckInsStore()
const listRef = ref<InstanceType<typeof QuickCheckInsList> | null>(null)
const presetMetric = ref<string | undefined>(undefined)

const owner = ref(auth.ownerId ?? '')

function saveOwner() {
  auth.setSession(owner.value)
  refreshList()
}
function clearOwner() {
  auth.clear()
}
function refreshList() {
  if (auth.ownerId) {
    qci.listCheckIns()
  }
}

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

watchEffect(() => {
  if (auth.ownerId && qci.checkIns.length === 0) {
    qci.listCheckIns()
  }
})
</script>

<style scoped>
.auth-box { display:flex; gap:8px; align-items:center; margin-bottom: 16px; }
.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
