import { GoogleGenerativeAI } from '@google/generative-ai'

export type LLMJsonResponse<T> = { parsed: T | null; raw: string }

const API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || ''

function stripCodeFences(text: string): string {
  const s = String(text ?? '')
  return s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

function tryExtractJson(text: string): any | null {
  const t = stripCodeFences(text)
  try { return JSON.parse(t) } catch {}
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const mid = t.slice(start, end + 1)
    try { return JSON.parse(mid) } catch {}
  }
  return null
}

function getModel(model = 'gemini-1.5-flash'): ReturnType<GoogleGenerativeAI['getGenerativeModel']> {
  const genAI = new GoogleGenerativeAI(API_KEY)
  return genAI.getGenerativeModel({ model, generationConfig: { maxOutputTokens: 1000 } })
}

export async function askLLMText(question: string, context?: { facts?: Array<{ id?: string; content?: string; source?: string; at?: string }> }): Promise<string> {
  if (!API_KEY) throw new Error('Missing VITE_GEMINI_API_KEY')
  const model = getModel()
  const facts = (context?.facts || []).filter(f => (f?.content || '').trim())
  const factsBlock = facts.length
    ? '\nUser Facts:\n' + facts.slice(-8).map((f, i) => `- ${f.content}${f.source ? ` (src:${f.source})` : ''}${f.at ? ` at:${f.at}` : ''}`).join('\n')
    : ''
  const prompt = question
//   `You are a helpful assistant. Answer clearly. If a "User Facts" section is present, prefer those facts over general knowledge.\n${factsBlock}\n\nUser question: ${question}`
  const result = await model.generateContent(prompt)
  const text = (await result.response).text()
  return text.trim()
}

export async function askLLMJson<T = any>(requester: string, prompt: string): Promise<LLMJsonResponse<T>> {
  if (!API_KEY) throw new Error('Missing VITE_GEMINI_API_KEY')
  const model = getModel()
  const res = await model.generateContent(prompt)
  const raw = (await res.response).text()
  const parsed = tryExtractJson(raw) as T | null
  return { parsed, raw }
}
