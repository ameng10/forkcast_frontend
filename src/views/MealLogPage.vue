<template>
  <section>
    <h2>Meal Log</h2>

    <div class="auth-box">
      <label>
        Owner ID
  <input v-model.trim="owner" placeholder="Alice or user:Alice" />
      </label>
      <button @click="saveOwner" :disabled="!owner">Use Owner</button>
      <button @click="clearOwner" v-if="auth.ownerId">Clear</button>
      <p v-if="auth.ownerId">Active owner: <strong>{{ auth.ownerId }}</strong></p>
    </div>

  <div class="grid">
      <div>
  <div class="card">
          <h3>Submit Meal</h3>
          <label>
            At
            <input type="datetime-local" v-model="atLocal" step="60" />
          </label>
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
          <label>
            At
            <input type="datetime-local" v-model="editAtLocal" step="60" />
          </label>
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
            <li v-for="m in ml.meals" :key="m.mealId">
              <button class="id-btn" @click="selectMeal(m.mealId)">
                <div class="meal-row">
                  <code class="meal-id">{{ shorten(m.mealId) }}</code>
                  <span class="meal-time">{{ formatAt(m.at) }}</span>
                  <span class="meal-items">{{ summarizeItems(m.items) }}</span>
                </div>
              </button>
            </li>
          </ul>
          <p v-if="!ml.loading && ml.meals.length === 0">No meals yet.</p>
        </div>

        <div v-if="ml.current" class="card">
          <h3>Selected Meal</h3>
          <div class="kv"><span>Meal ID:</span> <code>{{ ml.current.mealId }}</code></div>
          <div class="kv"><span>When:</span> <span>{{ formatAt(ml.current.at || ml.current.date) || '—' }}</span></div>
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
import { useMealLogStore, type MealItem, type MealSummary } from '../stores/mealLog'

const auth = useAuthStore()
const ml = useMealLogStore()

const owner = ref(auth.ownerId ?? '')

// Submit form state
const atLocal = ref(toInputLocalMinute(new Date()))
const items = ref<MealItem[]>([{ id: 'food:apple', name: 'Apple' }])
const notes = ref('')
const canSubmit = computed(() => !!auth.ownerId && !!atLocal.value && items.value.length > 0)
const submitOk = ref(false)

function addItem() { items.value.push({ id: '', name: '' }) }
function removeItem(i: number) { items.value.splice(i, 1) }

async function submitMeal() {
  submitOk.value = false
  if (!canSubmit.value) return
  try {
  const atIso = atLocal.value ? new Date(atLocal.value).toISOString() : new Date().toISOString()
  const id = await ml.submit(atIso, items.value, notes.value || undefined)
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
const editAtLocal = ref('')
const editMealIdInput = ref<HTMLInputElement | null>(null)
const originalEdit = ref<{ items: MealItem[]; notes: string }>({ items: [], notes: '' })
function editAddItem() { editItems.value.push({ id: '', name: '' }) }
function editRemoveItem(i: number) { editItems.value.splice(i, 1) }

async function loadMeal() {
  if (!editMealId.value) return
  const rec = await ml.fetchById(editMealId.value)
  if (rec) {
    // best-effort mapping
    editItems.value = (rec.items as MealItem[]) || []
    editNotes.value = (rec.notes as string) || ''
  const d = rec.at != null
    ? (typeof rec.at === 'number' ? new Date(rec.at) : new Date(String(rec.at)))
    : (rec.date != null ? new Date(Number(rec.date)) : null)
  editAtLocal.value = d ? toInputLocalMinute(d) : ''
  originalEdit.value = { items: JSON.parse(JSON.stringify(editItems.value)), notes: editNotes.value }
  }
}

async function performEdit() {
  if (!editMealId.value) return
  const atIso = editAtLocal.value ? new Date(editAtLocal.value).toISOString() : undefined
  // Only send items/notes if changed since last load
  const itemsChanged = JSON.stringify(editItems.value) !== JSON.stringify(originalEdit.value.items)
  const notesChanged = (editNotes.value || '') !== (originalEdit.value.notes || '')
  await ml.edit(
    editMealId.value,
    itemsChanged ? editItems.value : undefined,
    notesChanged ? (editNotes.value || undefined) : undefined,
    atIso
  )
  // After successful edit, reset originals to current
  originalEdit.value = { items: JSON.parse(JSON.stringify(editItems.value)), notes: editNotes.value }
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

function shorten(id: string) { return id?.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id }
function formatAt(at: any) {
  if (!at) return ''
  try {
    const d = typeof at === 'number' ? new Date(at) : new Date(String(at))
    return isNaN(d.getTime()) ? '' : d.toLocaleString()
  } catch { return '' }
}
function summarizeItems(items?: MealItem[]) {
  if (!items || items.length === 0) return ''
  const names = items.map(i => (i?.name || i?.id || '').toString().trim()).filter(Boolean)
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '')
}

function toInputLocalMinute(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  // No seconds to enforce minute precision
  return `${y}-${m}-${d}T${h}:${min}`
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
.meal-row { display:flex; gap:8px; align-items:center; justify-content:flex-start; }
.meal-id { color:#555; }
.meal-time { color:#555; font-size:12px; }
.meal-items { color:#222; }
.kv { display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin: 4px 0; }
</style>
