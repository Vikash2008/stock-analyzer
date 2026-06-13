const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

export interface StreamChunk {
  text?: string
  done?: boolean
  sources?: string[]
  model?: string
  grounded?: boolean
  error?: string
  detail?: string
}

async function* _readSSE(response: Response): AsyncGenerator<StreamChunk> {
  if (!response.ok || !response.body) { yield { error: `HTTP ${response.status}` }; return }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, boundary).trim()
      buffer = buffer.slice(boundary + 2)
      if (raw.startsWith('data: ')) {
        try { yield JSON.parse(raw.slice(6)) } catch {}
      }
    }
  }
}

export async function* streamGeminiSection(
  symbol: string, sectionId: string, prompt: string,
  forceRefresh = false, forceLite = false, keyIndex = 0, force31 = false,
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${API_URL}/api/gemini/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, section_id: sectionId, prompt, force_refresh: forceRefresh, force_lite: forceLite, force_31: force31, key_index: keyIndex }),
  })
  yield* _readSSE(res)
}

export async function* streamGeminiChat(
  symbol: string, question: string, contextText: string,
  forceLite = false, keyIndex = 0, force31 = false,
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${API_URL}/api/gemini/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, question, context_text: contextText, force_lite: forceLite, force_31: force31, key_index: keyIndex }),
  })
  yield* _readSSE(res)
}

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
