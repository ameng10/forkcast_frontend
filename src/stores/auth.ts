import { defineStore } from 'pinia'

type AuthState = {
  ownerId: string | null,
  token: string | null
}

const STORAGE_KEY = 'forkcast_auth'

function loadPersisted(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ownerId: null, token: null }
    const parsed = JSON.parse(raw)
    return { ownerId: parsed.ownerId ?? null, token: parsed.token ?? null }
  } catch {
    return { ownerId: null, token: null }
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => loadPersisted(),
  actions: {
    setSession(ownerId: string, token: string | null = null) {
      const norm = normalizeOwnerId(ownerId)
      this.ownerId = norm
      this.token = token
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId: this.ownerId, token: this.token }))
    },
    clear() {
      this.ownerId = null
      this.token = null
      localStorage.removeItem(STORAGE_KEY)
    }
  }
})

function normalizeOwnerId(id: string) {
  const trimmed = (id ?? '').trim()
  if (!trimmed) return trimmed
  // If no scheme provided, default to user:
  return trimmed.includes(':') ? trimmed : `user:${trimmed}`
}
