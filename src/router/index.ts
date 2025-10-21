import { createRouter, createWebHistory } from 'vue-router'
import QuickCheckInsPage from '../views/QuickCheckInsPage.vue'
import MealLogPage from '../views/MealLogPage.vue'

const routes = [
  { path: '/', name: 'quick-check-ins', component: QuickCheckInsPage },
  { path: '/meals', name: 'meals', component: MealLogPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
