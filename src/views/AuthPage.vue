<template>
  <section class="auth-page">
    <h2>User Authentication</h2>
    <div v-if="auth.userId" class="status">
      <p>Logged in as <strong>{{ auth.username }}</strong></p>
      <button @click="doLogout">Logout</button>
    </div>
    <div v-else class="panes">
      <form class="card" @submit.prevent="doRegister">
        <h3>Register</h3>
        <input v-model.trim="regUsername" placeholder="Username" />
        <input v-model.trim="regPassword" type="password" placeholder="Password" />
        <button :disabled="!canRegister">Register</button>
        <p v-if="regError" class="err">{{ regError }}</p>
      </form>
      <form class="card" @submit.prevent="doLogin">
        <h3>Login</h3>
        <input v-model.trim="loginUsername" placeholder="Username" />
        <input v-model.trim="loginPassword" type="password" placeholder="Password" />
        <button :disabled="!canLogin">Login</button>
        <p v-if="loginError" class="err">{{ loginError }}</p>
      </form>
    </div>
    <p v-if="redirectPath && auth.userId" class="hint">Redirecting...</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const redirectPath = (route.query.redirect as string) || ''

const regUsername = ref('')
const regPassword = ref('')
const regError = ref('')
const loginUsername = ref('')
const loginPassword = ref('')
const loginError = ref('')

const canRegister = ref(false)
const canLogin = ref(false)

watch([regUsername, regPassword], () => { canRegister.value = !!regUsername.value && !!regPassword.value })
watch([loginUsername, loginPassword], () => { canLogin.value = !!loginUsername.value && !!loginPassword.value })

async function doRegister() {
  regError.value = ''
  try {
    await auth.register(regUsername.value, regPassword.value)
    if (redirectPath) router.replace(redirectPath)
    else router.replace({ name: 'home' })
  } catch (e: any) {
    regError.value = e?.message || 'Registration failed'
  }
}
async function doLogin() {
  loginError.value = ''
  try {
    await auth.login(loginUsername.value, loginPassword.value)
    if (redirectPath) router.replace(redirectPath)
    else router.replace({ name: 'home' })
  } catch (e: any) {
    loginError.value = e?.message || 'Login failed'
  }
}
async function doLogout() {
  await auth.logout()
}
</script>

<style scoped>
.auth-page { max-width: 640px; margin: 0 auto; display:flex; flex-direction:column; gap:24px; }
.panes { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
@media (max-width: 720px) { .panes { grid-template-columns: 1fr; } }
.card { border:1px solid var(--border); border-radius:12px; background:var(--surface); padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
input { width:100%; }
.err { color:#b00020; font-size:13px; }
.status { display:flex; align-items:center; gap:12px; }
.hint { font-size:12px; color: var(--text-muted); }
</style>
