<template>
  <div class="app">
    <header class="app-header">
      <div class="container row header-inner">
        <h1>🍽️ Forkcast</h1>
        <nav class="row">
          <RouterLink to="/">Dashboard</RouterLink>
          <RouterLink to="/meals">Meals</RouterLink>
          <RouterLink to="/insights">Insights</RouterLink>
          <RouterLink to="/swaps">Swaps</RouterLink>
          <RouterLink to="/qa">Personal Q&A</RouterLink>
          <RouterLink to="/checkins">Check-Ins</RouterLink>
          <RouterLink to="/login">Login</RouterLink>
        </nav>
      </div>
    </header>
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
// root app
</script>

<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
.app-header { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid var(--border); }
.header-inner { align-items: center; justify-content: space-between; }
nav a { text-decoration: none; color: var(--text); }
main { padding: 1rem 0; }
</style>
