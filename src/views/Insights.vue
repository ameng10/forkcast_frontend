<template>
  <section>
    <h2>Insights</h2>
    <div class="card actions">
      <input class="input" v-model="mealLogId" placeholder="MealLog ID to process" />
      <button class="btn" @click="process">Process Meal Log</button>
      <button class="btn secondary" @click="load">Refresh Patterns</button>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <ul class="card">
      <li v-for="(p, i) in patterns" :key="i">
        <strong>{{ p.pattern?.patternType }}</strong> - {{ p.pattern?.description }}
        <em v-if="p.pattern?.suggestedAdjustment"> ({{ p.pattern.suggestedAdjustment }})</em>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { InsightService } from '../services/insightService';

const auth = useAuthStore();
onMounted(() => { auth.load(); load(); });

const patterns = ref([]);
const error = ref('');
const mealLogId = ref('');

async function load() {
  error.value = '';
  try {
  const res = await InsightService.getInsightsForUser({ user: auth.userId });
  patterns.value = Array.isArray(res) ? res : [];
  } catch (e) {
    error.value = e?.error || 'Failed to load patterns';
  }
}

async function process() {
  error.value = '';
  try {
    if (!mealLogId.value) return;
  // For example: ingest a new meal reference then analyze
  await InsightService.ingest({ user: auth.userId, mealLog: mealLogId.value });
  await InsightService.analyze({ user: auth.userId });
    await load();
  } catch (e) {
    error.value = e?.error || 'Failed to process meal log';
  }
}
</script>

<style scoped>
.actions { display: flex; gap: 0.5rem; align-items: center; }
.error { color: #b00020; }
</style>
