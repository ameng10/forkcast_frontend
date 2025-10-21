<template>
  <div class="app">
    <header class="app-header">
      <h1>Forkcast</h1>
      <nav>
        <RouterLink to="/">Quick Check-Ins</RouterLink>
        <RouterLink to="/meals">Meals</RouterLink>
        <RouterLink to="/qa">Personal Q&A</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>

</template>

<script setup lang="ts">
// No-op
</script>

<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body, html, #app { margin: 0; height: 100%; }
.app-header { display:flex; align-items:center; gap:16px; padding:12px 16px; border-bottom: 1px solid #e5e5e5; }
nav a { margin-right: 12px; text-decoration: none; }
main { padding: 16px; }
</style>
