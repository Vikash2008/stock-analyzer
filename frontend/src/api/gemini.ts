const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

export interface GeminiResponse {
  text?: string
  sources?: string[]
  error?: string
}

export async function fetchGeminiSection(
  symbol: string,
  sectionId: string,
  prompt: string,
  forceRefresh = false
): Promise<GeminiResponse> {
  const res = await fetch(`${API_URL}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, section_id: sectionId, prompt, force_refresh: forceRefresh }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
  return data
}
