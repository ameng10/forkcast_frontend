<template>
  <section>
    <h2>Personal Q&A</h2>
    <div class="card">
      <form @submit.prevent="ask" class="row">
        <input class="input" v-model="text" placeholder="Ask a question..." />
        <button class="btn" type="submit">Ask</button>
        <button class="btn secondary" type="button" @click="load">Refresh</button>
      </form>
    </div>

    <div class="list card">
      <ul>
        <li v-for="(q, i) in questions" :key="i">
          <div>
            <strong>{{ q.question?.text }}</strong>
            <small> @ {{ q.question?.timestamp }}</small>
          </div>
          <div v-if="q.question?.answer">Answer: {{ q.question.answer }} <small> ({{ q.question?.answerTimestamp }})</small></div>
          <div v-else class="answer">
            <input class="input" v-model="answers[i]" placeholder="Type answer" />
            <button class="btn" @click="answer(q, i)">Submit</button>
          </div>
        </li>
      </ul>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { PersonalQAService } from '../services/personalQAService';

const auth = useAuthStore();
onMounted(() => { auth.load(); load(); });

const text = ref('');
const answers = ref({});
const questions = ref([]);
const error = ref('');

async function ask() {
  error.value = '';
  try {
  if (!auth.userId) { error.value = 'Please login and set a user ID.'; return; }
  if (!text.value || !text.value.trim()) { error.value = 'Question text is required.'; return; }
  await PersonalQAService.ask({ user: auth.userId, text: text.value.trim() });
    text.value = '';
    await load();
  } catch (e) {
  error.value = (e && (e.error || e.message)) || 'Failed to ask question';
  }
}

async function load() {
  try {
  const res = await PersonalQAService.getUserQAs({ user: auth.userId });
  questions.value = Array.isArray(res) ? res : [];
  } catch (e) {
    error.value = e?.error || 'Failed to load questions';
  }
}

async function answer(q, i) {
  try {
    const questionId = q.question?.id || q.question;
  await PersonalQAService.ingestFact({ user: auth.userId, question: questionId, answer: answers.value[i] });
    await load();
  } catch (e) {
    error.value = e?.error || 'Failed to answer question';
  }
}
</script>

<style scoped>
.list { margin-top: 1rem; }
.answer { display: flex; gap: 0.5rem; align-items: center; }
.error { color: #b00020; }
</style>
