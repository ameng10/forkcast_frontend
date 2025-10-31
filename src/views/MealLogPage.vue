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
            Meal Type
            <select v-model="mealType">
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Snacks</option>
              <option>Dinner</option>
            </select>
          </label>
          <div class="row">
            <label>
              Date
              <input type="date" v-model="dateLocal" />
            </label>
            <label>
              Time
              <div class="time-with-ampm">
                <input type="time" v-model="timeLocal" step="60" />
                <div class="ampm">
                  <button type="button" :class="{ active: timePeriod === 'AM' }" @click="setTimePeriod('AM')">AM</button>
                  <button type="button" :class="{ active: timePeriod === 'PM' }" @click="setTimePeriod('PM')">PM</button>
                </div>
              </div>
            </label>
          </div>
          <div class="items">
            <h4>Foods</h4>
            <div v-for="(name, i) in foods" :key="i" class="row">
              <input v-model.trim="foods[i]" placeholder="e.g. Apple" />
              <button @click="removeFood(i)">Remove</button>
            </div>
            <button @click="addFood" type="button">+ Add Food</button>
          </div>
          <label>Notes<input v-model.trim="notes" placeholder="snack" /></label>
          <button @click="submitMeal" :disabled="ml.loading || !canSubmit">{{ ml.loading ? 'Submitting…' : 'Submit' }}</button>
          <p v-if="!auth.ownerId" class="hint">Set an Owner ID above to enable submission.</p>
          <p v-if="submitOk" class="ok">Meal submitted.</p>
          <p v-if="ml.error" class="err">{{ ml.error }}</p>
        </div>

  <div class="card" ref="editPanelRef">
          <h3>Edit/Delete Meal</h3>
          <p class="hint" v-if="!editMealId">Select a meal from the list to edit or delete.</p>
          <label>
            Meal Type
            <select v-model="editMealType">
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Snacks</option>
              <option>Dinner</option>
            </select>
          </label>
          <div class="row">
            <label>
              Date
              <input type="date" v-model="editDateLocal" />
            </label>
            <label>
              Time
              <div class="time-with-ampm">
                <input type="time" v-model="editTimeLocal" step="60" />
                <div class="ampm">
                  <button type="button" :class="{ active: editTimePeriod === 'AM' }" @click="setEditTimePeriod('AM')">AM</button>
                  <button type="button" :class="{ active: editTimePeriod === 'PM' }" @click="setEditTimePeriod('PM')">PM</button>
                </div>
              </div>
            </label>
          </div>
          <div class="items">
            <h4>Foods</h4>
            <div v-for="(name, i) in editFoods" :key="i" class="row">
              <input v-model.trim="editFoods[i]" placeholder="e.g. Apple" />
              <button @click="editRemoveFood(i)">Remove</button>
            </div>
            <button @click="editAddFood" type="button">+ Add Food</button>
          </div>
          <label>Notes<input v-model.trim="editNotes" placeholder="..." /></label>
          <div class="row">
            <button @click="performEdit" :disabled="ml.loading || !editMealId">{{ ml.loading ? 'Saving…' : 'Save Edit' }}</button>
            <button @click="performDelete" :disabled="ml.loading || !editMealId">{{ ml.loading ? 'Deleting…' : 'Delete' }}</button>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <h3>Your Meals</h3>
          <div class="row">
            <label>
              Filter type
              <select v-model="filterType">
                <option value="">All</option>
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Snacks</option>
                <option>Dinner</option>
              </select>
            </label>
            <label>
              Sort by
              <select v-model="sortBy">
                <option value="newest">Date (newest)</option>
                <option value="oldest">Date (oldest)</option>
                <option value="type-az">Meal type (A→Z)</option>
                <option value="type-za">Meal type (Z→A)</option>
              </select>
            </label>
            <label>
              Group by day
              <input type="checkbox" v-model="groupByDay" />
            </label>
          </div>

          <template v-if="groupByDay">
            <div v-for="group in groupedMeals" :key="group.day" class="day-group">
              <h4 class="day-header">{{ group.day }}</h4>
              <ul class="ids">
                <li v-for="m in group.items" :key="m.mealId">
                  <button class="id-btn" @click="selectMeal(m.mealId)">
                    <div class="meal-row">
                      <span class="meal-time">{{ formatAt(m.at) }}</span>
                      <span class="meal-type">{{ mealTypeOf(m.items) || '—' }}</span>
                      <span class="meal-items">{{ summarizeItems(m.items) }}</span>
                      <span class="edit-inline" @click.stop="quickEdit(m.mealId)">Edit</span>
                      <span class="delete-inline" @click.stop="quickDelete(m.mealId)">Delete</span>
                    </div>
                  </button>
                </li>
              </ul>
            </div>
          </template>
          <template v-else>
            <ul class="ids">
              <li v-for="m in displayedMeals" :key="m.mealId">
                <button class="id-btn" @click="selectMeal(m.mealId)">
                  <div class="meal-row">
                    <span class="meal-time">{{ formatAt(m.at) }}</span>
                    <span class="meal-type">{{ mealTypeOf(m.items) || '—' }}</span>
                    <span class="meal-items">{{ summarizeItems(m.items) }}</span>
                    <span class="edit-inline" @click.stop="quickEdit(m.mealId)">Edit</span>
                    <span class="delete-inline" @click.stop="quickDelete(m.mealId)">Delete</span>
                  </div>
                </button>
              </li>
            </ul>
          </template>
          <p v-if="!ml.loading && ml.meals.length === 0">No meals yet.</p>
        </div>

  <div v-if="ml.current" class="card">
          <h3>Selected Meal</h3>
          <div class="kv"><span>When:</span> <span>{{ formatAt(ml.current.at || ml.current.date) || '—' }}</span></div>
          <div class="kv"><span>Meal type:</span> <span>{{ mealTypeOf(ml.current.items) || '—' }}</span></div>
          <div class="kv"><span>Notes:</span> <span>{{ ml.current.notes ?? '—' }}</span></div>
          <div>
            <h4>Items</h4>
            <ul>
              <li v-for="(it, i) in nonTypeItems(ml.current.items)" :key="i">
                {{ friendlyItemName(it) }}
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
const dateLocal = ref(toLocalDate(new Date()))
const timeLocal = ref(toLocalTime(new Date()))
const mealType = ref<'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner'>('Lunch')
// Foods input: user enters names only; we compose item ids under the hood
const foods = ref<string[]>(['Apple'])
const notes = ref('')
const timePeriod = computed<'AM'|'PM'>(() => getPeriodFromTime(timeLocal.value))
const canSubmit = computed(() => !!auth.ownerId && !!dateLocal.value && !!timeLocal.value && foods.value.filter(s => s.trim()).length > 0)
const submitOk = ref(false)

function addFood() { foods.value.push('') }
function removeFood(i: number) { foods.value.splice(i, 1) }

function toSlug(s: string) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
function composeItemsFromFoods(typeName: 'Breakfast'|'Lunch'|'Snacks'|'Dinner', names: string[]): MealItem[] {
  const out: MealItem[] = []
  // encode type as special item
  out.push({ id: `type:${typeName.toLowerCase()}`, name: typeName })
  for (const n of names) {
    const t = (n || '').trim(); if (!t) continue
    out.push({ id: `food:${toSlug(t)}`, name: t })
  }
  return out
}

async function submitMeal() {
  submitOk.value = false
  if (!canSubmit.value) return
  try {
  const atIso = combineDateTime(dateLocal.value, timeLocal.value) || new Date().toISOString()
  const composed = composeItemsFromFoods(mealType.value, foods.value)
  const id = await ml.submit(atIso, composed, notes.value || undefined)
    if (id) {
      editMealId.value = id
      submitOk.value = true
  await ml.fetchById(id)
    }
  } catch {}
}

// Edit state
const editMealId = ref('')
const editItems = ref<MealItem[]>([]) // kept internally; UI binds to editFoods
const editFoods = ref<string[]>([])
const editMealType = ref<'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner'>('Lunch')
const editNotes = ref('')
const editDateLocal = ref('')
const editTimeLocal = ref('')
const editTimePeriod = computed<'AM'|'PM'>(() => getPeriodFromTime(editTimeLocal.value))
const originalEdit = ref<{ foods: string[]; mealType: 'Breakfast'|'Lunch'|'Snacks'|'Dinner'; notes: string }>({ foods: [], mealType: 'Lunch', notes: '' })
function editAddFood() { editFoods.value.push('') }
function editRemoveFood(i: number) { editFoods.value.splice(i, 1) }

async function loadMeal() {
  if (!editMealId.value) return
  const rec = await ml.fetchById(editMealId.value)
  if (!rec) return
  // best-effort mapping
  editItems.value = (rec.items as MealItem[]) || []
  editNotes.value = (rec.notes as string) || ''
  // derive meal type and foods from items
  const type = mealTypeOf(editItems.value) as ('Breakfast'|'Lunch'|'Snacks'|'Dinner'|undefined)
  editMealType.value = type || 'Lunch'
  editFoods.value = (editItems.value || [])
    .filter(it => !isTypeItem(it))
    .map(it => friendlyItemName(it))
  const d = rec.at != null
    ? (typeof rec.at === 'number' ? new Date(rec.at) : new Date(String(rec.at)))
    : (rec.date != null ? new Date(Number(rec.date)) : null)
  if (d) {
    editDateLocal.value = toLocalDate(d)
    editTimeLocal.value = toLocalTime(d)
  } else {
    editDateLocal.value = ''
    editTimeLocal.value = ''
  }
  originalEdit.value = { foods: JSON.parse(JSON.stringify(editFoods.value)), mealType: editMealType.value, notes: editNotes.value }
}

async function performEdit() {
  if (!editMealId.value) return
  const atIso = (editDateLocal.value && editTimeLocal.value) ? combineDateTime(editDateLocal.value, editTimeLocal.value) : undefined
  // Compose items from current UI state
  const composedNow = composeItemsFromFoods(editMealType.value, editFoods.value)
  const composedBefore = composeItemsFromFoods(originalEdit.value.mealType, originalEdit.value.foods)
  const itemsChanged = JSON.stringify(composedNow) !== JSON.stringify(composedBefore)
  const notesChanged = (editNotes.value || '') !== (originalEdit.value.notes || '')
  await ml.edit(
    editMealId.value,
    itemsChanged ? composedNow : undefined,
    notesChanged ? (editNotes.value || undefined) : undefined,
    atIso
  )
  // After successful edit, reset originals to current
  originalEdit.value = { foods: JSON.parse(JSON.stringify(editFoods.value)), mealType: editMealType.value, notes: editNotes.value }
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
  await loadMeal()
}

const editPanelRef = ref<HTMLElement | null>(null)
async function quickEdit(id: string) {
  await selectMeal(id)
  // Smooth scroll to the edit panel
  requestAnimationFrame(() => {
    editPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function quickDelete(id: string) {
  if (!id) return
  await ml.remove(id)
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
  const names = items
    .filter(i => !isTypeItem(i))
    .map(i => friendlyItemName(i))
    .filter(Boolean)
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '')
}

function mealTypeOf(items?: MealItem[]) {
  if (!items) return undefined
  const t = items.find(i => String(i?.id || '').startsWith('type:'))
  return t?.name
}

function isTypeItem(it?: MealItem) {
  return !!(it && typeof it.id === 'string' && it.id.startsWith('type:'))
}
function friendlyItemName(it?: MealItem) {
  if (!it) return ''
  const name = (it.name || '').toString().trim()
  if (name) return name
  const id = (it.id || '').toString()
  if (id.startsWith('food:')) {
    const slug = id.slice('food:'.length)
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  return id || ''
}
function nonTypeItems(items?: MealItem[]) {
  return (items || []).filter(it => !isTypeItem(it))
}

const filterType = ref<string>('')
const sortBy = ref<'newest' | 'oldest' | 'type-az' | 'type-za'>('newest')
const groupByDay = ref<boolean>(false)

const displayedMeals = computed(() => {
  const arr = (ml.meals || []) as MealSummary[]
  const filtered = arr.filter(m => {
    if (!filterType.value) return true
    return (mealTypeOf(m.items) || '').toLowerCase() === filterType.value.toLowerCase()
  })
  const withType = filtered.map(m => ({ ...m, __mealType: (mealTypeOf(m.items) || '') as string }))
  const sorted = withType.sort((a, b) => {
    if (sortBy.value === 'oldest' || sortBy.value === 'newest') {
      const ta = Number(new Date(a.at as any))
      const tb = Number(new Date(b.at as any))
      return sortBy.value === 'oldest' ? ta - tb : tb - ta
    }
    const na = a.__mealType.toLowerCase()
    const nb = b.__mealType.toLowerCase()
    return sortBy.value === 'type-az' ? na.localeCompare(nb) : nb.localeCompare(na)
  })
  return sorted
})

const groupedMeals = computed(() => {
  const groups = new Map<string, MealSummary[]>()
  for (const m of displayedMeals.value) {
    const d = new Date(m.at as any)
    const key = isNaN(d.getTime()) ? 'Unknown' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const arr = groups.get(key) || []
    arr.push(m)
    groups.set(key, arr)
  }
  return Array.from(groups.entries()).sort((a,b)=>a[0]<b[0]?1:-1).map(([day, items]) => ({ day, items }))
})

function pad2(n: number) { return String(n).padStart(2, '0') }
function toLocalDate(date: Date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}
function toLocalTime(date: Date) {
  const h = pad2(date.getHours())
  const min = pad2(date.getMinutes())
  return `${h}:${min}`
}
function combineDateTime(dateStr?: string, timeStr?: string) {
  if (!dateStr || !timeStr) return undefined
  try {
    const iso = new Date(`${dateStr}T${timeStr}`).toISOString()
    return iso
  } catch { return undefined }
}

function parseHM(s?: string): { h: number; m: number } | null {
  if (!s) return null
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1]); const mm = Number(m[2])
  if (Number.isNaN(h) || Number.isNaN(mm)) return null
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null
  return { h, m: mm }
}
function formatHM(h: number, m: number) { return `${pad2(h)}:${pad2(m)}` }
function getPeriodFromTime(t?: string): 'AM'|'PM' {
  const p = parseHM(t)
  if (!p) return 'AM'
  return p.h >= 12 ? 'PM' : 'AM'
}
function coerceTimeToPeriod(t: string | undefined, target: 'AM'|'PM'): string {
  const p = parseHM(t)
  if (!p) return target === 'AM' ? '08:00' : '20:00'
  let { h, m } = p
  if (target === 'AM') {
    if (h === 12) h = 0
    else if (h > 12) h = h - 12
  } else { // PM
    if (h === 0) h = 12
    else if (h >= 1 && h <= 11) h = h + 12
  }
  return formatHM(h, m)
}
function setTimePeriod(target: 'AM'|'PM') {
  timeLocal.value = coerceTimeToPeriod(timeLocal.value, target)
}
function setEditTimePeriod(target: 'AM'|'PM') {
  editTimeLocal.value = coerceTimeToPeriod(editTimeLocal.value, target)
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
.meal-time { color:#555; font-size:12px; }
.meal-type { color:#333; font-size:12px; font-weight:600; }
.meal-items { color:#222; }
.edit-inline { margin-left: auto; color:#0b5ed7; font-size:12px; cursor:pointer; text-decoration: underline; }
.delete-inline { color:#b00020; font-size:12px; cursor:pointer; margin-left: 8px; text-decoration: underline; }
.time-with-ampm { display:flex; gap:8px; align-items:center; }
.ampm { display:flex; gap:4px; }
.ampm button { border:1px solid #ccc; background:#fff; padding:2px 6px; border-radius:4px; cursor:pointer; }
.ampm button.active { background:#0b5ed7; color:#fff; border-color:#0b5ed7; }
.day-header { margin: 8px 0 4px; }
.kv { display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin: 4px 0; }
</style>
