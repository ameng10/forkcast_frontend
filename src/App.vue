<template>
  <div class="app">
    <header class="app-header">
      <h1 class="logo" aria-label="Forkcast">
        <img src="/forkcast-logo.png" alt="Forkcast logo" class="logo-img" />
      </h1>
      <nav>
  <RouterLink to="/">Home</RouterLink>
  <RouterLink to="/checkins">Quick Check-Ins</RouterLink>
        <RouterLink to="/meals">Meals</RouterLink>
        <RouterLink to="/qa">Personal Q&A</RouterLink>
  <RouterLink to="/weekly">Weekly Summary</RouterLink>
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
:root {
  /* Brand palette */
  --brand-primary: #38A700; /* vivid green */
  --brand-primary-strong: #294936; /* deep green for hover/active */
  --brand-accent: #FF8200; /* orange */
  --brand-accent-strong: #B80C09; /* backup red/orange */
  --bg: #FFFFFF;
  --surface: #FFFFFF;
  --text: #294936;
  --text-muted: #6B7A6A;
  --border: #E5E7EB;
  --focus: rgba(56, 167, 0, 0.25);
}
* { box-sizing: border-box; }
body, html, #app {
  margin: 0;
  height: 100%;
  background: linear-gradient(120deg, #f6ffe7 0%, #e0f7fa 100%);
  color: var(--text);
  font-family: 'Nunito', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app::before {
  content: '';
  position: fixed;
  z-index: 0;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  background: none;
}

#app::after {
  content: '';
  position: fixed;
  z-index: 0;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  background:
    url('/forkcast-logo.png') no-repeat center 20vh,
    url('/fork.png') no-repeat left 5vh bottom 10vh,
    url('/apple.png') no-repeat right 10vw top 15vh,
    url('/carrot.png') no-repeat right 5vw bottom 5vh;
  background-size:
    500px,
    180px,
    140px,
    160px;
  opacity: 0.10;
}
.app-header { display:flex; align-items:center; gap:16px; padding:12px 16px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 10; }
.app-header h1 { font-size: 18px; margin: 0; color: var(--text); font-family: 'Fredoka', 'Nunito', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-weight: 600; letter-spacing: 0.2px; }
.app-header h1.logo { display:flex; align-items:center; }
.app-header .logo-img { height: 50px; display:block; }
nav a { margin-right: 12px; text-decoration: none; color: var(--text-muted); padding: 6px 10px; border-radius: 8px; transition: background .15s, color .15s; }
nav a.router-link-active { color: var(--surface); background: var(--brand-primary); }
nav a:hover { background: rgba(56,167,0,0.08); color: var(--brand-primary-strong); }
main { padding: 24px 20px 40px; max-width: 1440px; margin: 0 auto; }

/* Global form controls */
input, select, textarea { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 8px 10px; font: inherit; }
input:focus, select:focus, textarea:focus { outline: 3px solid var(--focus); border-color: var(--brand-primary); }
/* Modernized native selects */
select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding-right: 36px; /* room for chevron */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px 16px;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
}
select:hover { background-color: rgba(56,167,0,0.06); }
select:disabled { cursor: not-allowed; opacity: 0.7; }
button { font: inherit; border-radius: 8px; padding: 8px 12px; border: 1px solid var(--brand-primary); background: var(--brand-primary); color: #fff; cursor: pointer; transition: background .15s, border-color .15s; }
button:hover { background: var(--brand-primary-strong); border-color: var(--brand-primary-strong); }
button:disabled { opacity: 0.6; cursor: not-allowed; }

/* Headings and section spacing */
h2, h3, h4 { font-family: 'Fredoka', 'Nunito', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
h2 { font-size: 22px; margin: 4px 0 12px; font-weight: 600; letter-spacing: 0.2px; }
h3 { font-size: 16px; margin: 0 0 8px; font-weight: 600; letter-spacing: 0.2px; }
h4 { font-size: 14px; margin: 8px 0 4px; font-weight: 600; letter-spacing: 0.2px; }
section { display: block; }
section > .grid, section > .card, section > .auth-box { margin-top: 8px; }
hr { border: none; border-top: 1px solid var(--border); margin: 12px 0; }
</style>
