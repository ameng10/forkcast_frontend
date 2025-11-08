import { createRouter, createWebHistory } from 'vue-router'
import QuickCheckInsPage from '../views/QuickCheckInsPage.vue'
import MealLogPage from '../views/MealLogPage.vue'
import PersonalQAPage from '../views/PersonalQAPage.vue'
import WeeklySummaryPage from '../views/WeeklySummaryPage.vue'
import HomePage from '../views/HomePage.vue'
import AuthPage from '../views/AuthPage.vue'
import { useAuthStore } from '../stores/auth'
import { UserAuthAPI } from '../lib/api'

const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/auth', name: 'auth', component: AuthPage },
  { path: '/checkins', name: 'quick-check-ins', component: QuickCheckInsPage, meta: { requiresAuth: true } },
  { path: '/meals', name: 'meals', component: MealLogPage, meta: { requiresAuth: true } },
  { path: '/qa', name: 'qa', component: PersonalQAPage, meta: { requiresAuth: true } },
  { path: '/weekly', name: 'weekly', component: WeeklySummaryPage, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (!to.meta?.requiresAuth) return true
  const auth = useAuthStore()
  // Trust presence of a session to avoid blocking on slow/async backend checks
  if (auth.session) return true
  // Otherwise require explicit login
  auth.clear()
  return { name: 'auth', query: { redirect: to.fullPath } }
})

export default router
