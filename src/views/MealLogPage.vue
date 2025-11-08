<template>
  <section>
    <h2>Meal Log</h2>

    <div class="auth-box" v-if="!auth.userId">
      <p>Please <router-link to="/auth">login or register</router-link> to log meals.</p>
    </div>

    <div class="grid grid-3">
      <!-- Left: Submit Meal -->
      <div class="col">
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
            <label class="time-field">
              <span class="field-label">Time</span>
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
              <button @click="removeFood(i)" style="margin-left:12px;">Remove</button>
            </div>
            <button @click="addFood" type="button" style="margin-top:12px;">+ Add Food</button>
          </div>
          <label>Notes<input v-model.trim="notes" placeholder="snack" /></label>
          <button @click="submitMeal" :disabled="ml.loading || !canSubmit" style="margin-left:12px;">{{ ml.loading ? 'Submitting…' : 'Submit' }}</button>
          <p v-if="!auth.ownerId" class="hint">Set an Owner ID above to enable submission.</p>
          <p v-if="submitOk" class="ok">Meal submitted.</p>
          <p v-if="ml.error" class="err">{{ ml.error }}</p>
        </div>
      </div>

      <!-- Middle: Your Meals -->
      <div class="col">
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
                  <div class="meal-card-row">
                    <div class="meal-card-main" @click="selectMeal(m.mealId)">
                      <div class="meal-card-meta">{{ mealTypeOf(m.items) || '—' }} · {{ formatAt(m.at) }}</div>
                      <div class="meal-card-items">{{ summarizeItems(m.items) }}</div>
                    </div>
                    <div class="meal-card-actions">
                      <button class="meal-action-btn edit-btn" @click.stop="quickEdit(m.mealId)">Edit</button>
                      <button class="meal-action-btn delete-btn" @click.stop="quickDelete(m.mealId)">Delete</button>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </template>
          <template v-else>
            <ul class="ids">
              <li v-for="m in displayedMeals" :key="m.mealId">
                <div class="meal-card-row">
                  <div class="meal-card-main" @click="selectMeal(m.mealId)">
                    <div class="meal-card-meta">{{ mealTypeOf(m.items) || '—' }} · {{ formatAt(m.at) }}</div>
                    <div class="meal-card-items">{{ summarizeItems(m.items) }}</div>
                  </div>
                  <div class="meal-card-actions">
                    <button class="meal-action-btn edit-btn" @click.stop="quickEdit(m.mealId)">Edit</button>
                    <button class="meal-action-btn delete-btn" @click.stop="quickDelete(m.mealId)">Delete</button>
                  </div>
                </div>
              </li>
            </ul>
          </template>
          <p v-if="!ml.loading && ml.meals.length === 0">No meals yet.</p>
        </div>
      </div>

      <!-- Right: Edit/Delete + Selected Meal -->
      <div class="col">
        <div class="card" ref="editPanelRef">
          <h3>Edit/Delete Meal</h3>
          <p class="hint" v-if="!editMealId">Select a meal from the list to edit or delete.</p>
          <label style="display:block; margin-bottom:18px;">
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
            <label class="time-field">
              <span class="field-label">Time</span>
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
              <button @click="editRemoveFood(i)" style="margin-left:12px;">Remove</button>
            </div>
            <button @click="editAddFood" type="button" style="margin-top:12px;">+ Add Food</button>
          </div>
          <label style="display:block; margin-bottom:24px;">Notes<input v-model.trim="editNotes" placeholder="..." /></label>
          <div class="row" style="justify-content: flex-start;">
            <button @click="performEdit" :disabled="ml.loading || !editMealId" class="meal-action-btn edit-btn" style="margin-right:16px; margin-left:0;">{{ ml.loading ? 'Saving…' : 'Save Edit' }}</button>
            <button @click="performDelete" :disabled="ml.loading || !editMealId" class="meal-action-btn delete-btn" style="margin-left:0;">{{ ml.loading ? 'Deleting…' : 'Delete' }}</button>
          </div>
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
import { ref, computed, watch, watchEffect, nextTick, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useMealLogStore, type MealItem, type MealSummary } from '../stores/mealLog'

const auth = useAuthStore()
const ml = useMealLogStore()

function stripOwner(id?: string | null) {
  const s = (id || '').trim()
  return s.startsWith('user:') ? s.slice(5) : s
}
const ownerLabel = computed(() => stripOwner(auth.ownerId))

// Submit form state
const dateLocal = ref(toLocalDate(new Date()))
const timeLocal = ref(toLocalTime(new Date()))
const mealType = ref<'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner'>('Lunch')
// Foods input: user enters names only; we compose item ids under the hood
const foods = ref<string[]>(['Apple'])
const notes = ref('')
const timePeriod = computed<'AM'|'PM'>(() => getPeriodFromTime(timeLocal.value))
const canSubmit = computed(() => !!auth.session && !!dateLocal.value && !!timeLocal.value && foods.value.filter(s => s.trim()).length > 0)
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
  // Avoid an extra network call; set current from local submission data
  const atMs = Date.parse(atIso)
  ml.current = { mealId: id, at: isNaN(atMs) ? atIso : atMs, items: composed, notes: notes.value || undefined } as any
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

// Keep meals synced when session changes while on this page
watch(
  () => auth.session,
  (s) => {
    if (s) ml.listForSession(undefined, false)
  }
)

// Always refresh the meal list when navigating to the Meals page
onMounted(() => {
  if (auth.session) ml.listForSession(undefined, true)
})

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
.grid { display:grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.grid-3 { grid-template-columns: repeat(3, minmax(450px, 1fr)); }
.col { min-width: 0; }
@media (max-width: 1420px) { .grid-3 { grid-template-columns: repeat(2, minmax(450px, 1fr)); } }
@media (max-width: 960px) { .grid-3 { grid-template-columns: minmax(450px, 1fr); } }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
.row { display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
.card { border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom: 16px; background: var(--surface); }
.items { margin: 8px 0; }
.err { color:#b00020; }
.ok { color:var(--brand-primary-strong); }
.hint { color:var(--text-muted); font-size: 12px; }
.ids { list-style: none; padding: 0; display: grid; gap: 6px; }
.id-btn { background: transparent; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.meal-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 12px 16px;
  margin-bottom: 8px;
  gap: 16px;
}
.meal-card-main {
  flex: 1 1 auto;
  cursor: pointer;
}
.meal-card-meta {
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 2px;
}
.meal-card-items {
  font-weight: 600;
  font-size: 16px;
  color: var(--text);
}
.meal-card-actions {
  display: flex;
  gap: 16px;
}
.meal-action-btn {
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 18px;
  border: 1px solid var(--brand-primary);
  background: var(--brand-primary);
  color: #fff;
  cursor: pointer;
  margin-left: 0;
  margin-right: 0;
  transition: background .15s, border-color .15s;
}
.meal-action-btn.edit-btn {
  margin-left: auto;
}
.meal-action-btn:hover {
  background: var(--brand-primary-strong);
  border-color: var(--brand-primary-strong);
}
.delete-btn {
  border-color: var(--brand-accent-strong);
  background: var(--brand-accent-strong);
}
.delete-btn:hover {
  background: #b00020;
  border-color: #b00020;
}
.meal-row span {
  font-size: 13px;
}
.time-with-ampm { display:flex; gap:8px; align-items:center; }
.time-field { display:flex; align-items:center; gap:8px; }
.field-label { min-width:max-content; }
.ampm { display:flex; gap:4px; }
.ampm button { border:1px solid var(--border); background: rgba(34,197,94,0.16); padding:2px 6px; border-radius:4px; cursor:pointer; }
.ampm button.active { background: var(--brand-primary); color:#fff; border-color: var(--brand-primary); }
.day-header {
  margin: 8px 0 4px;
  font-family: 'Fredoka', Nunito, Arial, sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #38A700;
}
.kv { display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin: 4px 0; }
</style>
