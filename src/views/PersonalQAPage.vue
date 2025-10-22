<template>
  <section>
    <h2>Personal Q&A</h2>

    <div class="auth-box">
      <label>
        Owner ID
  <input v-model.trim="owner" placeholder="Alice or user:Alice" />
      </label>
      <button @click="saveOwner" :disabled="!owner">Use Owner</button>
      <button @click="clearOwner" v-if="auth.ownerId">Clear</button>
      <p v-if="auth.ownerId">Active owner: <strong>{{ auth.ownerId }}</strong></p>
    </div>

    <div class="grid">
      <div>
        <div class="card">
          <h3>Facts</h3>
          <div class="row">
            <input v-model.trim="newFact" placeholder="e.g. I feel great after oatmeal" />
            <button @click="addFact" :disabled="!canAddFact || pqa.loading">{{ pqa.loading ? 'Adding…' : 'Add Fact' }}</button>
          </div>
          <div class="row" style="justify-content: space-between;">
            <span>{{ pqa.facts.length }} fact(s)</span>
            <button @click="pqa.refreshFacts" :disabled="pqa.loading">{{ pqa.loading ? 'Loading…' : 'Refresh Facts' }}</button>
          </div>
          <ul class="facts">
            <li v-for="f in pqa.facts" :key="f.factId || Math.random().toString(36).slice(2)" class="fact-row">
              <div class="body">{{ f.fact || '(no text)' }}</div>
              <div class="actions"><button @click="removeFact(f.factId)" :disabled="pqa.loading || !f.factId">Forget</button></div>
            </li>
          </ul>
          <p v-if="!pqa.loading && pqa.facts.length === 0">No facts yet.</p>
        </div>
      </div>
      <div>
        <div class="card">
          <h3>Ask a question</h3>
          <div class="row">
            <input v-model.trim="question" placeholder="What meals helped energy?" />
            <button @click="ask" :disabled="!question || pqa.loading">{{ pqa.loading ? 'Asking…' : 'Ask' }}</button>
          </div>
          <p v-if="lastAnswer"><strong>Answer:</strong> {{ lastAnswer }}</p>
          <h4>History</h4>
          <ul class="qas">
            <li v-for="(qa, i) in [...pqa.qas].slice().reverse()" :key="i">
              <div class="q">Q: {{ qa.question }}</div>
              <div class="a">A: {{ qa.answer }}</div>
            </li>
          </ul>
          <button @click="pqa.refreshQAs" :disabled="pqa.loading">Refresh History</button>
          <p v-if="pqa.error" class="err">{{ pqa.error }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePersonalQAStore } from '../stores/personalQA'

const auth = useAuthStore()
const pqa = usePersonalQAStore()

const owner = ref(auth.ownerId ?? '')
const newFact = ref('')
const question = ref('')
const lastAnswer = ref('')

const canAddFact = ref(false)
watch(newFact, (v) => { canAddFact.value = !!v && v.length > 0 })

function saveOwner() {
  auth.setSession(owner.value)
  pqa.refreshFacts()
  pqa.refreshQAs()
}
function clearOwner() {
  auth.clear()
}

async function addFact() {
  if (!newFact.value) return
  await pqa.ingestFact(newFact.value)
  newFact.value = ''
}
async function removeFact(id: string) {
  if (!id) return
  try { await pqa.forgetFact(id) } catch {}
}
async function ask() {
  const ans = await pqa.ask(question.value)
  lastAnswer.value = ans
  question.value = ''
}

watch(() => auth.ownerId, (id) => {
  if (id) { pqa.refreshFacts(); pqa.refreshQAs() }
}, { immediate: true })
</script>

<style scoped>
.auth-box { display:flex; gap:8px; align-items:center; margin-bottom: 16px; }
.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
.row { display:flex; gap:8px; align-items:center; }
.card { border:1px solid #e5e5e5; border-radius:8px; padding:12px; margin-bottom: 16px; }
.facts, .qas { list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; }
.fact-row { display:flex; align-items:center; justify-content:space-between; gap:8px; border:1px solid #eee; border-radius:8px; padding:8px; }
.q { font-weight: 600; }
.a { color:#333; }
.err { color:#b00020; }
</style>
