import { createRouter, createWebHistory } from 'vue-router'
import QuickCheckInsPage from '../views/QuickCheckInsPage.vue'
import MealLogPage from '../views/MealLogPage.vue'
import PersonalQAPage from '../views/PersonalQAPage.vue'
import WeeklySummaryPage from '../views/WeeklySummaryPage.vue'
import HomePage from '../views/HomePage.vue'

const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/checkins', name: 'quick-check-ins', component: QuickCheckInsPage },
  { path: '/meals', name: 'meals', component: MealLogPage },
  { path: '/qa', name: 'qa', component: PersonalQAPage },
  { path: '/weekly', name: 'weekly', component: WeeklySummaryPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
