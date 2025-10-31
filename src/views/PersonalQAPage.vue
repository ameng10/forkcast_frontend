<template>
  <section class="pqa">
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

    <div class="chat-grid">
      <div class="chat-card">
        <div class="chat-header">
          <h3>Chat</h3>
          <button class="ghost" @click="resetChat" :disabled="pqa.asking || pqa.messages.length === 0">Clear chat</button>
        </div>
        <div class="chat-window" ref="chatWindow">
          <p v-if="pqa.messages.length === 0" class="empty">Say hello to start the conversation.</p>
          <div
            v-for="(msg, idx) in pqa.messages"
            :key="idx"
            :class="['bubble', msg.role]"
          >
            <span class="sender">{{ msg.role === 'user' ? 'You' : 'Coach' }}</span>
            <p>{{ msg.text }}</p>
          </div>
        </div>
        <form class="composer" @submit.prevent="ask">
          <input
            v-model.trim="question"
            :disabled="pqa.asking"
            placeholder="Ask anything…"
          />
          <button type="submit" :disabled="!question || pqa.asking">
            {{ pqa.asking ? 'Sending…' : 'Send' }}
          </button>
        </form>
        <p v-if="pqa.error" class="err">{{ pqa.error }}</p>
      </div>

      <div class="facts-card">
        <h3>Saved facts</h3>
        <div class="row">
          <input v-model.trim="newFact" placeholder="e.g. Oatmeal keeps me full" />
          <button @click="addFact" :disabled="!canAddFact || pqa.loading">{{ pqa.loading ? 'Adding…' : 'Add fact' }}</button>
        </div>
        <p class="hint">Facts help give the assistant quick context, but they’re optional.</p>
        <ul class="facts">
          <li v-for="f in pqa.facts" :key="f.factId || f.fact" class="fact-row">
            <span>{{ f.fact }}</span>
            <button class="ghost" @click="removeFact(f.factId)" :disabled="pqa.loading || !f.factId">Forget</button>
          </li>
        </ul>
        <p v-if="!pqa.loading && pqa.facts.length === 0" class="empty">No facts saved yet.</p>
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
const chatWindow = ref<HTMLDivElement | null>(null)

const canAddFact = ref(false)
watch(newFact, (v) => { canAddFact.value = !!v && v.length > 0 })

function saveOwner() {
  auth.setSession(owner.value)
  pqa.resetChat()
  pqa.refreshFacts()
}
function clearOwner() {
  auth.clear()
  pqa.resetChat()
  owner.value = ''
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
  if (!question.value || pqa.asking) return
  const prompt = question.value
  question.value = ''
  try {
    await pqa.ask(prompt)
  } catch {
    /* assistant store already surfaces the error */
  }
  scrollToBottom()
}

function resetChat() {
  pqa.resetChat()
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const el = chatWindow.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(() => pqa.messages.length, () => {
  scrollToBottom()
})

watch(() => auth.ownerId, (id) => {
  if (id) { pqa.resetChat(); pqa.refreshFacts() }
}, { immediate: true })
</script>

<style scoped>
.pqa { display:flex; flex-direction:column; gap:16px; }
.auth-box { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.auth-box input { min-width:220px; }
.chat-grid { display:grid; grid-template-columns: 2fr 1fr; gap:24px; align-items:start; }
@media (max-width: 960px) { .chat-grid { grid-template-columns: 1fr; } }
.chat-card { border:1px solid #e5e5e5; border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; background:#fff; min-height:420px; }
.chat-header { display:flex; justify-content:space-between; align-items:center; }
.ghost { border:none; background:transparent; color:#555; cursor:pointer; font-size:12px; }
.ghost:disabled { opacity:0.4; cursor:not-allowed; }
.chat-window { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-right:4px; max-height:460px; }
.composer { display:flex; gap:8px; }
.composer input { flex:1; padding:10px 12px; border:1px solid #dcdcdc; border-radius:20px; }
.composer button { padding:10px 18px; border:none; border-radius:20px; background:#2563eb; color:#fff; cursor:pointer; }
.composer button:disabled { opacity:0.5; cursor:not-allowed; }
.bubble { max-width:75%; padding:12px 14px; border-radius:18px; line-height:1.45; display:flex; flex-direction:column; gap:6px; font-size:14px; }
.bubble.user { margin-left:auto; background:#2563eb; color:#fff; border-bottom-right-radius:4px; }
.bubble.assistant { margin-right:auto; background:#f2f4f9; color:#1f2933; border-bottom-left-radius:4px; }
.sender { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; opacity:0.7; }
.chat-window .empty { text-align:center; color:#666; margin-top:40px; }
.facts-card { display:flex; flex-direction:column; gap:12px; }
.row { display:flex; gap:8px; align-items:center; }
.facts-card input { flex:1; padding:8px 10px; border:1px solid #dcdcdc; border-radius:8px; }
.facts-card button { padding:8px 12px; border:none; border-radius:8px; background:#2563eb; color:#fff; cursor:pointer; }
.facts-card button:disabled { opacity:0.5; cursor:not-allowed; }
.facts-card button.ghost { background:transparent; color:#555; border:1px solid transparent; padding:4px 8px; }
.facts-card button.ghost:hover { text-decoration:underline; }
.hint { font-size:12px; color:#666; }
.facts { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.fact-row { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:10px 12px; border:1px solid #eee; border-radius:10px; background:#fafafa; }
.fact-row .ghost { font-size:12px; }
.empty { color:#666; font-size:13px; }
.err { color:#b00020; font-size:13px; }
</style>
