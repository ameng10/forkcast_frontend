<template>
  <section class="login">
    <h2>Login (mock)</h2>
    <div class="card">
      <form @submit.prevent="onLogin">
        <label class="label">
          User ID
          <input class="input" v-model="userId" placeholder="user-123" />
        </label>
        <label class="label">
          Token
          <input class="input" v-model="token" placeholder="dev-token" />
        </label>
        <div class="row">
          <button class="btn" type="submit">Login</button>
          <button class="btn danger" type="button" @click="onLogout" v-if="auth.isAuthenticated">Logout</button>
        </div>
      </form>
      <p v-if="auth.isAuthenticated">Logged in as {{ auth.userId }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const userId = ref('');
const token = ref('');

onMounted(() => auth.load());

function onLogin() {
  auth.setSession({ token: token.value || 'dev-token', userId: userId.value || 'user-123' });
}

function onLogout() {
  auth.logout();
}
</script>

<style scoped>
form { display: grid; gap: 0.5rem; max-width: 420px; }
</style>
