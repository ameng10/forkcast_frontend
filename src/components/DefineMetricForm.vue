<template>
  <div class="card">
    <h3>Define a Metric</h3>
    <div class="row">
      <label>
        Name
          <input v-model.trim="name" placeholder="e.g. weight (lb)" />
          <small class="hint">Tip: include the unit in parentheses, e.g., "weight (lb)"</small>
      </label>
        <button @click="submit" :disabled="!name">Create</button>
    </div>
    <p v-if="store.error" class="err">{{ store.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuickCheckInsStore } from '../stores/quickCheckIns'

const store = useQuickCheckInsStore()
const name = ref('')
const emit = defineEmits<{ (e: 'metric-defined', payload: { name: string }): void }>()

async function submit() {
  await store.defineMetric(name.value)
  emit('metric-defined', { name: name.value })
  name.value = ''
}
</script>

<style scoped>
.card { border:1px solid var(--border); border-radius:8px; padding:12px; background: var(--surface); }
.row { display:flex; gap:12px; align-items:flex-end; margin:8px 0; }
label { display:flex; flex-direction:column; gap:4px; }
.hint { color:var(--text-muted); }
.err { color:#b00020; }
</style>
