<template>
  <section>
    <h2>Quick Check-Ins</h2>
    <div class="card">
      <form class="row" @submit.prevent="record">
        <input class="input" v-model="mood" placeholder="mood" />
        <input class="input" v-model.number="energyLevel" type="number" placeholder="energy level" />
        <input class="input" v-model="notes" placeholder="notes" />
        <button class="btn" type="submit">Record</button>
      </form>
    </div>

    <div class="list card">
      <div class="row">
        <input class="input" v-model="startDate" type="date" />
        <input class="input" v-model="endDate" type="date" />
        <button class="btn secondary" @click="load">Load</button>
      </div>
      <ul>
        <li v-for="(ci, i) in checkins" :key="i">
          {{ ci.checkIn?.timestamp }} — {{ ci.checkIn?.mood }} ({{ ci.checkIn?.energyLevel }}) — {{ ci.checkIn?.notes }}
        </li>
      </ul>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CheckInsService } from '../services/checkInsService';

const auth = useAuthStore();
onMounted(() => { auth.load(); load(); });

const mood = ref('');
const energyLevel = ref(5);
const notes = ref('');
const startDate = ref('');
const endDate = ref('');
const checkins = ref([]);
const error = ref('');

async function record() {
  error.value = '';
  try {
  await CheckInsService.record({ owner: auth.userId, mood: mood.value, energyLevel: energyLevel.value, notes: notes.value });
    await load();
  } catch (e) {
    error.value = e?.error || 'Failed to record check-in';
  }
}

async function load() {
  error.value = '';
  try {
  const res = await CheckInsService.listCheckInsByOwner({ owner: auth.userId, startDate: startDate.value, endDate: endDate.value });
  checkins.value = Array.isArray(res) ? res : [];
  } catch (e) {
    error.value = e?.error || 'Failed to load check-ins';
  }
}
</script>

<style scoped>
.row { display: flex; gap: 0.5rem; align-items: center; }
.list { margin-top: 1rem; }
.error { color: #b00020; }
</style>
