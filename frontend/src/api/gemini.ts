const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

export interface GeminiResponse {
  text?: string
  sources?: string[]
  grounded?: boolean
  model?: string
  error?: string
}

export async function fetchGeminiSection(
  symbol: string,
  sectionId: string,
  prompt: string,
  forceRefresh = false,
  forceLite = false,
  keyIndex = 0,
  force31 = false,
): Promise<GeminiResponse> {
  const res = await fetch(`${API_URL}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, section_id: sectionId, prompt, force_refresh: forceRefresh, force_lite: forceLite, force_31: force31, key_index: keyIndex }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? data?.detail ?? `Request failed (${res.status})`)
  return data
}

export async function fetchGeminiChat(
  symbol: string,
  question: string,
  contextText: string,
  forceLite = false,
  keyIndex = 0,
  force31 = false,
): Promise<GeminiResponse> {
  const res = await fetch(`${API_URL}/api/gemini/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, question, context_text: contextText, force_lite: forceLite, force_31: force31, key_index: keyIndex }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? data?.detail ?? `Request failed (${res.status})`)
  return data
}
