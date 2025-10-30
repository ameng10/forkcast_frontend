import { PersonalQAAPI } from '../../lib/api'

export type LLMJsonResponse<T> = {
  parsed: T | null
  raw: string
}

function stripCodeFences(text: string): string {
  const s = String(text ?? '')
  return s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

function tryExtractJson(text: string): any | null {
  const t = stripCodeFences(text)
  // Try direct parse
  try { return JSON.parse(t) } catch {}
  // Try to find first { ... } block
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const mid = t.slice(start, end + 1)
    try { return JSON.parse(mid) } catch {}
  }
  return null
}

export async function askLLMJson<T = any>(requester: string, prompt: string): Promise<LLMJsonResponse<T>> {
  const { answer } = await PersonalQAAPI.ask({ requester, question: prompt })
  const raw = String(answer ?? '')
  const parsed = tryExtractJson(raw) as T | null
  return { parsed, raw }
}
