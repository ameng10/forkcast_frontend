import { createRouter, createWebHistory } from 'vue-router'
import QuickCheckInsPage from '../views/QuickCheckInsPage.vue'
import MealLogPage from '../views/MealLogPage.vue'
import PersonalQAPage from '../views/PersonalQAPage.vue'

const routes = [
  { path: '/', name: 'quick-check-ins', component: QuickCheckInsPage },
  { path: '/meals', name: 'meals', component: MealLogPage },
  { path: '/qa', name: 'qa', component: PersonalQAPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
