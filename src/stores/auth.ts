import { defineStore } from 'pinia'
import { UserAuthAPI } from '../lib/api'

type AuthState = {
  ownerId: string | null,
  token: string | null,
  username: string | null,
  session: string | null,
  userId: string | null
}

const STORAGE_KEY = 'forkcast_auth'

function loadPersisted(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ownerId: null, token: null, username: null, session: null, userId: null }
    const parsed = JSON.parse(raw)
    return {
      ownerId: parsed.ownerId ?? null,
      token: parsed.token ?? null,
      username: parsed.username ?? null,
      session: parsed.session ?? null,
      userId: parsed.userId ?? null
    }
  } catch {
    return { ownerId: null, token: null, username: null, session: null, userId: null }
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => loadPersisted(),
  actions: {
    setSession(ownerId: string, token: string | null = null) {
  // Legacy helper (kept for backward-compat UI); now ownerId should be the userId
  this.ownerId = ownerId
      this.token = token
      // Keep backward-compat behavior, but prefer new session persistence
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId: this.ownerId, token: this.token, username: this.username, session: this.session, userId: this.userId }))
      // Reset QuickCheckIns store for this user
      try { const { useQuickCheckInsStore } = require('./quickCheckIns'); useQuickCheckInsStore().resetForOwnerChange() } catch {}
    },
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId: this.ownerId, token: this.token, username: this.username, session: this.session, userId: this.userId }))
    },
    // New auth flow per api-spec
    async register(username: string, password: string) {
      const u = (username || '').trim()
      const p = (password || '').trim()
      if (!u || !p) throw new Error('Username and password are required')
      const { userId } = await UserAuthAPI.register({ username: u, password: p })
      this.username = u
      this.userId = userId
  // Registration does not return a session; user must explicitly login afterward.
  this.session = null
      this.ownerId = userId
      this.token = null
      this.persist()
      // Reset QuickCheckIns store for new user profile
      try { const { useQuickCheckInsStore } = await import('./quickCheckIns'); useQuickCheckInsStore().resetForOwnerChange() } catch {}
      return { userId }
    },
    async login(username: string, password: string) {
      const u = (username || '').trim()
      const p = (password || '').trim()
      if (!u || !p) throw new Error('Username and password are required')
      const { userId, session } = await UserAuthAPI.login({ username: u, password: p })
      this.username = u
      this.userId = userId
      this.session = session ?? null
      this.ownerId = userId
      this.token = null
      this.persist()
      try {
        // On successful login, hydrate meals in background (best-effort)
        const { useMealLogStore } = await import('./mealLog')
        const ml = useMealLogStore()
        ml.listForSession(undefined, true).catch(() => {})
      } catch {}
      // Reset QuickCheckIns store for this session user
      try { const { useQuickCheckInsStore } = await import('./quickCheckIns'); useQuickCheckInsStore().resetForOwnerChange() } catch {}
      return { userId, session }
    },
    async logout() {
      try {
        if (this.session) await UserAuthAPI.logout({ session: this.session })
      } catch {
        // ignore
      }
      this.username = null
      this.userId = null
      this.session = null
      this.ownerId = null
      this.token = null
      localStorage.removeItem(STORAGE_KEY)
      // Reset QuickCheckIns store after logout
      try { const { useQuickCheckInsStore } = await import('./quickCheckIns'); useQuickCheckInsStore().resetForOwnerChange() } catch {}
    },
    clear() {
      this.ownerId = null
      this.token = null
      this.username = null
      this.session = null
      this.userId = null
      localStorage.removeItem(STORAGE_KEY)
      try { const { useQuickCheckInsStore } = require('./quickCheckIns'); useQuickCheckInsStore().resetForOwnerChange() } catch {}
    }
  }
})
