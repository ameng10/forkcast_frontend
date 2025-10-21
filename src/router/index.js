import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { requiresAuth: false } },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  { path: '/meals', name: 'meals', component: () => import('../views/Meals.vue'), meta: { requiresAuth: false } },
  { path: '/insights', name: 'insights', component: () => import('../views/Insights.vue'), meta: { requiresAuth: false } },
  { path: '/swaps', name: 'swaps', component: () => import('../views/Swaps.vue'), meta: { requiresAuth: false } },
  { path: '/qa', name: 'qa', component: () => import('../views/PersonalQA.vue'), meta: { requiresAuth: false } },
  { path: '/checkins', name: 'checkins', component: () => import('../views/CheckIns.vue'), meta: { requiresAuth: false } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta?.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
