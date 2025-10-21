<template>
  <div class="card">
    <h3>Define a Metric</h3>
    <div class="row">
      <label>
        Name
        <input v-model.trim="name" placeholder="e.g. weight" />
      </label>
      <label>
        Unit
        <input v-model.trim="unit" placeholder="e.g. lbs" />
      </label>
      <button @click="submit" :disabled="!name || !unit">Create</button>
    </div>
    <p v-if="store.error" class="err">{{ store.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'

const store = useQuickCheckInsStore()
const name = ref('')
const unit = ref('')
const emit = defineEmits<{ (e: 'metric-defined', payload: { name: string }): void }>()

async function submit() {
  await store.defineMetric(name.value, unit.value)
  emit('metric-defined', { name: name.value })
  name.value = ''
  unit.value = ''
}
</script>

<style scoped>
.card { border:1px solid #e5e5e5; border-radius:8px; padding:12px; }
.row { display:flex; gap:12px; align-items:flex-end; margin:8px 0; }
label { display:flex; flex-direction:column; gap:4px; }
.err { color:#b00020; }
</style>
