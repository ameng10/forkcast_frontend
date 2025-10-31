import { askLLMJson } from './llm/geminiWrapper'

export type WeeklyWindow = { start: string; end: string; widenedTo30Days?: boolean }
export type WeeklyCheckInStat = { name: string; avg: number; min: number; max: number; count: number; delta: number }
export type WeeklyDataset = {
  window: WeeklyWindow
  meals: { total: number; byType: Record<string, number>; topFoods: string[] }
  checkIns: WeeklyCheckInStat[]
}

export async function mineWeeklyInsights(ownerId: string, dataset: WeeklyDataset): Promise<string[]> {
  const prompt = `You are a helpful coach producing a short weekly summary for a user.\nReturn STRICT JSON: {"insights": ["...", "..."]}\nRules:\n- 3 to 6 bullet insights, short and clear.\n- No internal IDs or technical terms. Use only metric names and meal terms.\n- Include at least one observation about meals and one about check-ins if present.\n- Mention trends (up/down) and give simple suggestions when appropriate.\n- Do not include dates; just say "this week".\nWeekly data:\n${JSON.stringify(dataset)}`
  try {
    const { parsed, raw } = await askLLMJson<{ insights: string[] }>(ownerId, prompt)
    const obj = parsed && typeof parsed === 'object' ? parsed : (() => { try { return JSON.parse(raw) } catch { return null } })()
    const arr = obj && Array.isArray((obj as any).insights) ? (obj as any).insights.filter((x: any) => typeof x === 'string' && x.trim()) : []
    if (arr.length) return arr.slice(0, 8)
  } catch {}
  // Heuristic fallback
  const heuristics: string[] = []
  const dominantType = Object.entries(dataset.meals.byType).sort((a,b) => (b[1]||0) - (a[1]||0))[0]?.[0]
  if (dominantType) heuristics.push(`Most meals were ${dominantType} this week.`)
  const up = dataset.checkIns.filter(s => s.delta > 0).map(s => s.name).slice(0,3)
  if (up.length) heuristics.push(`Trending up: ${up.join(', ')}.`)
  const down = dataset.checkIns.filter(s => s.delta < 0).map(s => s.name).slice(0,3)
  if (down.length) heuristics.push(`Trending down: ${down.join(', ')}.`)
  const foods = dataset.meals.topFoods.slice(0,3)
  if (foods.length) heuristics.push(`Often eaten: ${foods.join(', ')}.`)
  return heuristics
}
