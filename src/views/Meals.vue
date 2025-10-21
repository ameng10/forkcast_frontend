<template>
  <section>
    <h2>Meals</h2>
    <div class="card">
      <form @submit.prevent="record">
        <div class="row">
          <label class="label">Date <input class="input" v-model="date" type="date" required /></label>
          <label class="label">Type
            <select class="input" v-model="mealType" required>
              <option>breakfast</option>
              <option>lunch</option>
              <option>dinner</option>
              <option>snack</option>
            </select>
          </label>
        </div>
        <div>
          <h4>Food Items</h4>
          <div v-for="(fi, i) in foodItems" :key="i" class="food-row">
            <input class="input" v-model="fi.name" placeholder="name" required />
            <input class="input" v-model.number="fi.calories" type="number" placeholder="cal" min="0" />
            <input class="input" v-model.number="fi.macronutrients.carbs" type="number" placeholder="carbs" min="0" />
            <input class="input" v-model.number="fi.macronutrients.protein" type="number" placeholder="protein" min="0" />
            <input class="input" v-model.number="fi.macronutrients.fat" type="number" placeholder="fat" min="0" />
            <button class="btn danger" type="button" @click="removeFood(i)">Remove</button>
          </div>
          <button class="btn secondary" type="button" @click="addFood">+ Add Food</button>
        </div>
        <div class="row">
          <button class="btn" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Record Meal' }}</button>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="success" class="success">Meal recorded.</div>
      </form>
    </div>

    <div class="list">
      <h3>Your Meal Logs</h3>
      <div class="filters">
        <input type="date" v-model="startDate" />
        <input type="date" v-model="endDate" />
        <button @click="load">Load</button>
      </div>
      <div class="id-fallback card">
        <small>
          If your meal logs below don't include IDs, enter a MealLog ID here for update/delete:
        </small>
        <input class="input" v-model="editMealLogId" placeholder="MealLog ID for edit/delete" />
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    <ul class="card">
        <li v-for="(m, idx) in meals" :key="idx">
          <strong>{{ m.mealLog?.date }} - {{ m.mealLog?.mealType }}</strong>
          <ul>
            <li v-for="(fi, j) in m.mealLog?.foodItems || []" :key="j">
              {{ fi.name }} ({{ fi.calories }} cal)
            </li>
          </ul>
      <button class="btn" @click="update(m)">Update</button>
      <button class="btn danger" @click="del(m)">Delete</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { MealLogService } from '../services/mealLogService';

const auth = useAuthStore();
onMounted(() => auth.load());

const date = ref(new Date().toISOString().slice(0,10));
const mealType = ref('breakfast');
const foodItems = ref([defaultFoodItem()]);

function defaultFoodItem() {
  return { name: '', calories: 0, macronutrients: { carbs: 0, protein: 0, fat: 0 } };
}

function addFood() { foodItems.value.push(defaultFoodItem()); }
function removeFood(i) { foodItems.value.splice(i, 1); }

const startDate = ref('');
const endDate = ref('');
const meals = ref([]);
const error = ref('');
const editMealLogId = ref('');
const saving = ref(false);
const success = ref(false);

async function record() {
  error.value = '';
  success.value = false;
  try {
  if (!auth.userId || !String(auth.userId).trim()) { error.value = 'Please login and set a valid user ID.'; return; }
    if (!date.value || !mealType.value || !foodItems.value.length) { error.value = 'Date, meal type, and at least one food item are required.'; return; }
    saving.value = true;
  const ownerId = String(auth.userId).trim();
  const payload = { owner: ownerId, ownerId, user: ownerId, date: date.value, mealType: mealType.value, foodItems: foodItems.value };
  await MealLogService.submit(payload);
    success.value = true;
    await load();
    // reset form minimally
    foodItems.value = [defaultFoodItem()];
  } catch (e) {
  error.value = (e && (e.error || e.message)) || 'Failed to record meal';
  }
  finally { saving.value = false; }
}

async function load() {
  error.value = '';
  try {
    if (!auth.userId) return;
  const res = await MealLogService.getMealsForOwner({ owner: auth.userId, startDate: startDate.value, endDate: endDate.value });
    meals.value = Array.isArray(res) ? res : [];
  } catch (e) {
    error.value = (e && (e.error || e.message)) || 'Failed to load meals';
  }
}

async function update(m) {
  try {
    const id = editMealLogId.value || m.mealLog?.id || m.mealLog;
    await MealLogService.edit({
      mealId: id,
      date: m.mealLog?.date,
      mealType: m.mealLog?.mealType,
      foodItems: m.mealLog?.foodItems,
    });
    await load();
  } catch (e) {
    error.value = e?.error || 'Failed to update meal';
  }
}

async function del(m) {
  try {
    const id = editMealLogId.value || m.mealLog?.id || m.mealLog;
  await MealLogService.delete({ mealId: id });
    await load();
  } catch (e) {
    error.value = e?.error || 'Failed to delete meal';
  }
}

</script>

<style scoped>
.row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.food-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem; }
.list { margin-top: 1rem; }
.filters { display: flex; gap: 0.5rem; align-items: center; }
.id-fallback { margin: 0.5rem 0; display: grid; gap: 0.25rem; max-width: 420px; }
.error { color: #b00020; }
</style>
