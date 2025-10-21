<template>
  <section>
    <h2>Meal Log</h2>

    <div class="auth-box">
      <label>
        Owner ID
        <input v-model.trim="owner" placeholder="user:Alice" />
      </label>
      <button @click="saveOwner" :disabled="!owner">Use Owner</button>
      <button @click="clearOwner" v-if="auth.ownerId">Clear</button>
      <p v-if="auth.ownerId">Active owner: <strong>{{ auth.ownerId }}</strong></p>
    </div>

  <div class="grid">
      <div>
  <div class="card">
          <h3>Submit Meal</h3>
          <label>At (ISO)<input v-model.trim="at" placeholder="2025-10-21T10:00:00.000Z" /></label>
          <div class="items">
            <h4>Items</h4>
            <div v-for="(it, i) in items" :key="i" class="row">
              <input v-model.trim="it.id" placeholder="food:apple" />
              <input v-model.trim="it.name" placeholder="Apple" />
              <button @click="removeItem(i)">Remove</button>
            </div>
            <button @click="addItem" type="button">+ Add Item</button>
          </div>
          <label>Notes<input v-model.trim="notes" placeholder="snack" /></label>
          <button @click="submitMeal" :disabled="ml.loading || !canSubmit">{{ ml.loading ? 'Submitting…' : 'Submit' }}</button>
          <p v-if="!auth.ownerId" class="hint">Set an Owner ID above to enable submission.</p>
          <p v-if="submitOk" class="ok">Meal submitted. New ID set in the edit panel.</p>
          <p v-if="ml.error" class="err">{{ ml.error }}</p>
        </div>

        <div class="card">
          <h3>Edit/Delete Meal</h3>
          <label>Meal ID<input v-model.trim="editMealId" placeholder="<meal-id>" ref="editMealIdInput" /></label>
          <div class="items">
            <h4>Items</h4>
            <div v-for="(it, i) in editItems" :key="i" class="row">
              <input v-model.trim="it.id" placeholder="food:..." />
              <input v-model.trim="it.name" placeholder="Name" />
              <button @click="editRemoveItem(i)">Remove</button>
            </div>
            <button @click="editAddItem" type="button">+ Add Item</button>
          </div>
          <label>Notes<input v-model.trim="editNotes" placeholder="..." /></label>
          <div class="row">
            <button @click="performEdit" :disabled="ml.loading || !editMealId">{{ ml.loading ? 'Saving…' : 'Save Edit' }}</button>
            <button @click="performDelete" :disabled="ml.loading || !editMealId">{{ ml.loading ? 'Deleting…' : 'Delete' }}</button>
            <button @click="loadMeal" :disabled="ml.loading || !editMealId">Load Existing</button>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <h3>Your Meals</h3>
          <label>
            Include deleted
            <input type="checkbox" v-model="ml.includeDeleted" @change="refreshMeals" />
          </label>
          <button @click="refreshMeals" :disabled="ml.loading">{{ ml.loading ? 'Loading…' : 'Refresh' }}</button>
          <ul class="ids">
            <li v-for="id in ml.meals" :key="id">
              <button class="id-btn" @click="selectMeal(id)"><code>{{ id }}</code></button>
            </li>
          </ul>
          <p v-if="!ml.loading && ml.meals.length === 0">No meals yet.</p>
        </div>

        <div v-if="ml.current" class="card">
          <h3>Selected Meal</h3>
          <div class="kv"><span>Meal ID:</span> <code>{{ ml.current.mealId }}</code></div>
          <div class="kv"><span>When:</span> <span>{{ (ml.current.at || ml.current.date) ?? '—' }}</span></div>
          <div class="kv"><span>Notes:</span> <span>{{ ml.current.notes ?? '—' }}</span></div>
          <div>
            <h4>Items</h4>
            <ul>
              <li v-for="(it, i) in (ml.current.items || [])" :key="i">
                {{ it.id || 'item' }} — {{ it.name || '' }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMealLogStore, type MealItem } from '../stores/mealLog'

const auth = useAuthStore()
const ml = useMealLogStore()

const owner = ref(auth.ownerId ?? '')

// Submit form state
const at = ref(new Date().toISOString())
const items = ref<MealItem[]>([{ id: 'food:apple', name: 'Apple' }])
const notes = ref('')
const canSubmit = computed(() => !!auth.ownerId && !!at.value && items.value.length > 0)
const submitOk = ref(false)

function addItem() { items.value.push({ id: '', name: '' }) }
function removeItem(i: number) { items.value.splice(i, 1) }

async function submitMeal() {
  submitOk.value = false
  if (!canSubmit.value) return
  try {
    const id = await ml.submit(at.value, items.value, notes.value || undefined)
    if (id) {
      editMealId.value = id
      submitOk.value = true
  await ml.fetchById(id)
    }
  } catch {}
}

// Edit state
const editMealId = ref('')
const editItems = ref<MealItem[]>([])
const editNotes = ref('')
const editMealIdInput = ref<HTMLInputElement | null>(null)
function editAddItem() { editItems.value.push({ id: '', name: '' }) }
function editRemoveItem(i: number) { editItems.value.splice(i, 1) }

async function loadMeal() {
  if (!editMealId.value) return
  const rec = await ml.fetchById(editMealId.value)
  if (rec) {
    // best-effort mapping
    editItems.value = (rec.items as MealItem[]) || []
    editNotes.value = (rec.notes as string) || ''
  }
}

async function performEdit() {
  if (!editMealId.value) return
  await ml.edit(editMealId.value, editItems.value, editNotes.value || undefined)
}

async function performDelete() {
  if (!editMealId.value) return
  await ml.remove(editMealId.value)
}

function saveOwner() {
  auth.setSession(owner.value)
  refreshMeals()
}
function clearOwner() {
  auth.clear()
}
function refreshMeals() {
  if (auth.ownerId) ml.listForOwner()
}

watch(
  () => auth.ownerId,
  (id) => {
    if (id) ml.listForOwner()
  },
  { immediate: true }
)

async function selectMeal(id: string) {
  editMealId.value = id
  await nextTick()
  editMealIdInput.value?.focus()
}
</script>

<style scoped>
.auth-box { display:flex; gap:8px; align-items:center; margin-bottom: 16px; }
.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
.row { display:flex; gap:8px; align-items:center; }
.card { border:1px solid #e5e5e5; border-radius:8px; padding:12px; margin-bottom: 16px; }
.items { margin: 8px 0; }
.err { color:#b00020; }
.ok { color:#0b7a0b; }
.hint { color:#666; font-size: 12px; }
.ids { list-style: none; padding: 0; display: grid; gap: 6px; }
.id-btn { background: transparent; border: 1px solid #ddd; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.kv { display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin: 4px 0; }
</style>
