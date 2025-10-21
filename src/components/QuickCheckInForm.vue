<template>
  <div class="card">
    <h3>Record a Check-In</h3>
    <div class="row">
      <label>
        Metric Name
        <input v-model.trim="metricName" placeholder="e.g. weight" />
      </label>
      <label>
        Value
        <input v-model.number="value" type="number" step="any" placeholder="e.g. 175.2" ref="valueInput" />
      </label>
    </div>
    <div class="row">
      <label>
        Timestamp (ms, optional)
        <input v-model.number="timestamp" type="number" placeholder="Date.now()" />
      </label>
    </div>
    <div class="row">
      <button @click="submit" :disabled="!canSubmit">Record</button>
    </div>
    <p v-if="store.error" class="err">{{ store.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'

const store = useQuickCheckInsStore()

const props = defineProps<{ presetMetricName?: string }>()
const metricName = ref('')
const value = ref<number | null>(null)
const timestamp = ref<number | null>(null)
const valueInput = ref<HTMLInputElement | null>(null)

watch(() => props.presetMetricName, async (nm) => {
  if (nm) {
    metricName.value = nm
    await nextTick()
    valueInput.value?.focus()
  }
}, { immediate: true })

const canSubmit = computed(() => !!metricName.value && value.value !== null)

async function submit() {
  if (!canSubmit.value) return
  await store.record(metricName.value, value.value!, timestamp.value ?? undefined)
  metricName.value = ''
  value.value = null
  timestamp.value = null
  emit('recorded', { metricName: metricName.value })
}

const emit = defineEmits<{ (e: 'recorded', payload: { metricName: string }): void }>()
</script>

<style scoped>
.card { border:1px solid #e5e5e5; border-radius:8px; padding:12px; }
.row { display:flex; gap:12px; align-items:flex-end; margin:8px 0; }
label { display:flex; flex-direction:column; gap:4px; }
.err { color:#b00020; }
</style>
