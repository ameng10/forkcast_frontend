import { defineStore } from 'pinia';

const STORAGE_KEY = 'fc_auth';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null,
    userId: null,
  }),
  getters: {
    isAuthenticated: (s) => !!s.token && !!s.userId,
  },
  actions: {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { token, userId } = JSON.parse(raw);
          this.token = token || null;
          this.userId = userId || null;
        }
      } catch (_) {}
    },
    setSession({ token, userId }) {
      this.token = token;
      this.userId = userId;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, userId }));
    },
    logout() {
      this.token = null;
      this.userId = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});
