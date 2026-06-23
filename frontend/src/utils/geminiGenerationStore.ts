// Module-level (not React-state) store for in-flight Deep Research generations. Lives outside
// any component's lifecycle so a generation keeps running when ReportTab unmounts — navigating
// to another page or briefly backgrounding the app no longer loses progress, since the fetch
// was never tied to the component in the first place; this just makes that explicit and adds
// resumable progress instead of a blank state on remount.
import { idbSet } from './idbStore'
import { streamGeminiSection } from '../api/gemini'

export interface SectionResult {
  text:           string
  sources:        string[]
  savedAt?:       number
  grounded?:      boolean
  model?:         string
  requestedLite?: boolean
  streaming?:     boolean
}
export interface SectionErrorState { error: string; detail?: string }
export type SectionState = 'idle' | 'loading' | SectionErrorState | SectionResult

interface Entry {
  state:             SectionState
  startedAt?:        number
  progressNote?:     string
  listeners:         Set<(s: SectionState) => void>
  progressListeners: Set<(note: string) => void>
}

const store = new Map<string, Entry>()
const key = (yfSymbol: string, sectionId: string) => `${yfSymbol}::${sectionId}`

function getEntry(k: string): Entry {
  let e = store.get(k)
  if (!e) { e = { state: 'idle', listeners: new Set(), progressListeners: new Set() }; store.set(k, e) }
  return e
}

function emit(k: string, state: SectionState) {
  const e = getEntry(k)
  e.state = state
  e.listeners.forEach(l => l(state))
}

function emitProgress(k: string, note: string) {
  const e = getEntry(k)
  e.progressNote = note
  e.progressListeners.forEach(l => l(note))
}

export function subscribeGeneration(yfSymbol: string, sectionId: string, cb: (s: SectionState) => void): () => void {
  const e = getEntry(key(yfSymbol, sectionId))
  e.listeners.add(cb)
  return () => { e.listeners.delete(cb) }
}

/** Subscribes to real fallback-progress notes (e.g. "2.5 Flash overloaded — retrying with
 * 2.5 Flash Lite…") emitted while a section is still 'loading' — shown in place of the
 * generic time-based status text once the backend actually starts a fallback attempt. */
export function subscribeProgress(yfSymbol: string, sectionId: string, cb: (note: string) => void): () => void {
  const e = getEntry(key(yfSymbol, sectionId))
  e.progressListeners.add(cb)
  return () => { e.progressListeners.delete(cb) }
}

export function getProgressNote(yfSymbol: string, sectionId: string): string | undefined {
  return store.get(key(yfSymbol, sectionId))?.progressNote
}

export function getGenerationState(yfSymbol: string, sectionId: string): SectionState {
  return getEntry(key(yfSymbol, sectionId)).state
}

export function getGenerationStartedAt(yfSymbol: string, sectionId: string): number | undefined {
  return store.get(key(yfSymbol, sectionId))?.startedAt
}

export function isGenerating(yfSymbol: string, sectionId: string): boolean {
  const s = getGenerationState(yfSymbol, sectionId)
  return s === 'loading' || (typeof s === 'object' && 'text' in s && !!s.streaming)
}

/** Starts a generation unless one is already running for this symbol/section — a remount
 * (e.g. navigating back to the page) just subscribes to whatever's already in flight instead
 * of double-firing the request. Persists every chunk to IndexedDB, not just the final one, so
 * coming back mid-stream shows current progress instead of looking ungenerated. */
export function startGeneration(
  yfSymbol: string, sectionId: string, prompt: string,
  forceRefresh: boolean, forceLite: boolean, keyIndex: number, force31: boolean,
): void {
  if (isGenerating(yfSymbol, sectionId)) return
  const k = key(yfSymbol, sectionId)
  const apiSymbol = yfSymbol.replace(/\.(NS|BO)$/i, '')

  const entry = getEntry(k)
  entry.startedAt = Date.now()
  entry.progressNote = undefined
  emit(k, 'loading')
  let accText = ''

  ;(async () => {
    try {
      for await (const chunk of streamGeminiSection(apiSymbol, sectionId, prompt, forceRefresh, forceLite, keyIndex, force31)) {
        if (chunk.progress) {
          emitProgress(k, chunk.progress)
          continue
        }
        if (chunk.error) {
          emit(k, { error: chunk.error, detail: (chunk as { detail?: string }).detail ?? '' })
          return
        }
        if (chunk.text) {
          accText += chunk.text
          const partial: SectionResult = { text: accText, sources: [], grounded: false, requestedLite: forceLite, streaming: true }
          emit(k, partial)
          idbSet(`gemini:${yfSymbol}:${sectionId}`, JSON.stringify({ ...partial, savedAt: Date.now() }))
        }
        if (chunk.done) {
          const final: SectionResult = {
            text: accText, sources: chunk.sources ?? [], grounded: chunk.grounded ?? false,
            model: chunk.model, requestedLite: forceLite, savedAt: Date.now(),
          }
          emit(k, final)
          idbSet(`gemini:${yfSymbol}:${sectionId}`, JSON.stringify(final))
        }
      }
    } catch (err) {
      emit(k, { error: err instanceof Error ? err.message : 'Request failed' })
    }
  })()
}
