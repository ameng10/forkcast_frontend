<template>
  <section>
    <h2>Food Swaps</h2>
    <details open class="card">
      <summary>Propose a Swap</summary>
      <form @submit.prevent="propose" class="row">
        <input class="input" v-model="proposePayload.mealItem" placeholder="mealItem ID" />
        <input class="input" v-model="proposePayload.preferences.goal" placeholder="goal (optional)" />
        <button class="btn" type="submit">Propose</button>
      </form>
    </details>

    <details class="card">
      <summary>Accept a Proposal</summary>
      <form @submit.prevent="accept" class="row">
        <input class="input" v-model="acceptPayload.proposalId" placeholder="proposal ID" />
        <button class="btn" type="submit">Accept</button>
      </form>
    </details>

    <details class="card" open>
      <summary>Your Proposals</summary>
      <div class="row">
        <button class="btn secondary" @click="listProposals">Refresh</button>
      </div>
      <ul class="card">
        <li v-for="(p, i) in proposals" :key="i">Proposal: {{ p.proposal || p.id || JSON.stringify(p) }}</li>
      </ul>
    </details>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { SwapService } from '../services/swapService';

const auth = useAuthStore();
auth.load();

const proposePayload = ref({ owner: '', mealItem: '', preferences: {} });
const acceptPayload = ref({ owner: '', proposalId: '' });
const proposals = ref([]);
const error = ref('');

async function propose() {
  error.value = '';
  try {
    const payload = { ...proposePayload.value, owner: auth.userId };
    await SwapService.propose(payload);
    await listProposals();
  } catch (e) {
    error.value = e?.error || 'Failed to propose swap';
  }
}

async function accept() {
  error.value = '';
  try {
    const payload = { ...acceptPayload.value, owner: auth.userId };
    await SwapService.accept(payload);
    await listProposals();
  } catch (e) {
    error.value = e?.error || 'Failed to accept proposal';
  }
}

async function listProposals() {
  error.value = '';
  try {
    const res = await SwapService.getProposalsByOwner({ owner: auth.userId });
    proposals.value = Array.isArray(res) ? res : [];
  } catch (e) {
    error.value = e?.error || 'Failed to fetch proposals';
  }
}
</script>

<style scoped>
.row { display: flex; gap: 0.5rem; align-items: center; }
.error { color: #b00020; }
details { margin-bottom: 1rem; }
form { display: grid; gap: 0.5rem; max-width: 520px; }
</style>
