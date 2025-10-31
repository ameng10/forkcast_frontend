<template>
  <section class="home">
    <h2>Welcome to Forkcast!</h2>
    <div class="card">
      <h3>What is Forkcast?</h3>
      <p>Forkcast is your personal nutrition and wellness tracker. Log your meals, record quick check-ins for any metric you care about, and get AI-powered insights and summaries to help you stay on track.</p>
    </div>
    <div class="card">
      <h3>How to use Forkcast</h3>
      <ol>
        <li><strong>Set your user/owner ID</strong> at the top of each page. This keeps your data private and lets you switch between users.</li>
        <li><strong>Quick Check-Ins:</strong> Record any metric (e.g., weight, mood, water intake) in the <router-link to="/">Quick Check-Ins</router-link> page. Define new metrics, record values, and see your recent history.</li>
        <li><strong>Meals:</strong> Log your meals on the <router-link to="/meals">Meals</router-link> page. Add foods, meal type, and notes for each entry.</li>
        <li><strong>Personal Q&amp;A:</strong> Ask questions or save facts for your AI coach on the <router-link to="/qa">Personal Q&amp;A</router-link> page.</li>
        <li><strong>Weekly Summary:</strong> See a summary of your meals and check-ins for the week on the <router-link to="/weekly">Weekly Summary</router-link> page, including trends and insights.</li>
      </ol>
    </div>
    <div class="card">
      <h3>Tips</h3>
      <ul>
        <li>You can switch users at any time by changing the Owner ID at the top of any page.</li>
        <li>All your data is stored privately and only accessible with your Owner ID.</li>
        <li>Use the AI Q&amp;A to get personalized advice or explanations based on your data and facts.</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
// No logic needed
</script>

<style scoped>
.home { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
.card { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 20px 24px; margin-bottom: 0; }
h2 { margin-bottom: 8px; }
</style>
