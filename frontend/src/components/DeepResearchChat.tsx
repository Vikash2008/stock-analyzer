import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamGeminiChat } from '../api/gemini'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  question?: string
  text?: string
  error?: string
  contextLabel: string
  contextEmoji?: string
  timestamp: number
  model?: string
  grounded?: boolean
  sources?: string[]
  streaming?: boolean
}

interface SectionInfo {
  id: string
  label: string
  emoji: string
  text: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  yf_symbol: string
  stockName: string
  initialContextId: string
  sections: SectionInfo[]
  useLite: boolean
  use31: boolean
  useKey: 0 | 1 | 2
}

const CHAT_TTL = 7 * 24 * 3600 * 1000

function fmtModelName(model: string | undefined): string {
  if (model === 'gemini-2.5-flash') return '2.5 Flash'
  if (model === 'gemini-2.5-flash-lite') return '2.5 Lite'
  return '3.1 Lite'
}

export function DeepResearchChat({ isOpen, onClose, yf_symbol, stockName, initialContextId, sections, useLite, use31, useKey }: Props) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [question, setQuestion] = React.useState('')
  const [selectedContext, setSelectedContext] = React.useState(initialContextId)
  const [chatLoading, setChatLoading] = React.useState(false)
  const [expandedSources, setExpandedSources] = React.useState<Record<string, boolean>>({})
  const threadRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    const raw = localStorage.getItem(`gemini:chat:${yf_symbol}`)
    if (!raw) { setMessages([]); return }
    try {
      const p = JSON.parse(raw)
      if (p.savedAt && Date.now() - p.savedAt < CHAT_TTL) {
        setMessages(p.messages ?? [])
      } else {
        localStorage.removeItem(`gemini:chat:${yf_symbol}`)
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }, [yf_symbol])

  React.useEffect(() => {
    if (isOpen) {
      setSelectedContext(initialContextId)
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [isOpen, initialContextId])

  React.useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, chatLoading])

  const availableSections = sections.filter(s => s.text !== null)

  function buildContext(): { text: string; label: string; emoji?: string } | null {
    if (selectedContext === 'all') {
      const parts = availableSections.map(s => `## ${s.emoji} ${s.label}\n${s.text}`)
      if (!parts.length) return null
      return { text: parts.join('\n\n---\n\n'), label: `All Cards (${parts.length})` }
    }
    const sec = availableSections.find(s => s.id === selectedContext)
    if (!sec) return null
    return { text: sec.text!, label: sec.label, emoji: sec.emoji }
  }

  async function handleSend() {
    if (!question.trim() || chatLoading) return
    const q = question.trim()
    const ctx = buildContext()
    if (!ctx) return

    setQuestion('')
    const asstId = `${Date.now()}-a`
    const userMsg: ChatMessage = { id: `${Date.now()}-u`, role: 'user', question: q, contextLabel: ctx.label, contextEmoji: ctx.emoji, timestamp: Date.now() }
    const asstMsg: ChatMessage = { id: asstId, role: 'assistant', text: '', contextLabel: ctx.label, contextEmoji: ctx.emoji, timestamp: Date.now(), streaming: true }
    setMessages(prev => [...prev, userMsg, asstMsg])
    setChatLoading(true)

    const symbol = yf_symbol.replace(/\.(NS|BO)$/i, '')
    let accText = ''
    try {
      for await (const chunk of streamGeminiChat(symbol, q, ctx.text, useLite, useKey, use31)) {
        if (chunk.error) {
          setMessages(prev => prev.map(m => m.id === asstId ? { ...m, error: chunk.error, text: undefined, streaming: false } : m))
          return
        }
        if (chunk.text) {
          accText += chunk.text
          setMessages(prev => prev.map(m => m.id === asstId ? { ...m, text: accText, streaming: true } : m))
        }
        if (chunk.done) {
          const finalMsg: ChatMessage = { id: asstId, role: 'assistant', text: accText, contextLabel: ctx.label, contextEmoji: ctx.emoji, timestamp: Date.now(), model: chunk.model, grounded: chunk.grounded, sources: chunk.sources, streaming: false }
          setMessages(prev => {
            const updated = prev.map(m => m.id === asstId ? finalMsg : m)
            try { localStorage.setItem(`gemini:chat:${yf_symbol}`, JSON.stringify({ messages: updated, savedAt: Date.now() })) } catch {}
            return updated
          })
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, error: err instanceof Error ? err.message : 'Request failed', text: undefined, streaming: false } : m))
    } finally {
      setChatLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Sheet container — flex end so sheet sticks to bottom */}
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        <div
          className={`w-full max-w-xl pointer-events-auto bg-white rounded-t-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: '75dvh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-slate-100">
            <span className="text-[13px] font-semibold text-slate-800">💬 Ask about {stockName}</span>
            <button onClick={onClose} className="text-slate-400 active:text-slate-600 text-[18px] leading-none p-2 -mr-1">
              ✕
            </button>
          </div>


          {/* Thread */}
          <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && !chatLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 pb-8">
                <span className="text-3xl">🔍</span>
                <span className="text-[12px] text-slate-500 leading-snug">
                  Ask anything about {stockName}
                </span>
                <span className="text-[10px] text-slate-300">
                  Answers are grounded in the research cards above
                </span>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 pr-1">
                      {msg.contextEmoji && <span>{msg.contextEmoji}</span>}
                      <span>{msg.contextLabel}</span>
                    </span>
                    <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                      <p className="text-[12px] leading-snug">{msg.question}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-1">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[95%]">
                      {msg.error ? (
                        <p className="text-[11px] text-red-500">{msg.error}</p>
                      ) : msg.streaming && !msg.text ? (
                        <div className="flex items-center gap-1.5 py-0.5">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-700 leading-relaxed gemini-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            h1: ({children}) => <h1 className="text-[13px] font-bold text-slate-800 mt-2 mb-1">{children}</h1>,
                            h2: ({children}) => <h2 className="text-[12px] font-bold text-slate-800 mt-2 mb-1">{children}</h2>,
                            h3: ({children}) => <h3 className="text-[11px] font-semibold text-slate-600 mt-1.5 mb-0.5">{children}</h3>,
                            p:  ({children}) => <p className="mb-1.5">{children}</p>,
                            ul: ({children}) => <ul className="list-disc list-outside pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-outside pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                            li: ({children}) => <li className="text-[11px] leading-snug">{children}</li>,
                            strong: ({children}) => <strong className="font-semibold text-slate-800">{children}</strong>,
                            table: ({children}) => (
                              <div className="overflow-x-auto my-1.5">
                                <table className="border-collapse text-[10px]">{children}</table>
                              </div>
                            ),
                            thead: ({children}) => <thead className="bg-white/80">{children}</thead>,
                            th: ({children}) => <th className="px-2 py-1 text-left font-semibold text-slate-600 border border-slate-200 whitespace-nowrap">{children}</th>,
                            td: ({children}) => <td className="px-2 py-1 text-slate-700 border border-slate-200 align-top">{children}</td>,
                            hr: () => <hr className="my-2 border-slate-200" />,
                          }}>
                            {msg.text ?? ''}
                          </ReactMarkdown>
                          {msg.streaming && <span className="inline-block w-0.5 h-3 bg-slate-400 animate-pulse align-middle ml-0.5" />}
                        </div>
                      )}
                    </div>
                    {msg.model && (
                      <div className="flex items-center justify-between pl-1 pr-1 mt-1.5 gap-3">
                        <span className="flex items-center gap-1 shrink-0">
                          {msg.grounded && (
                            <span className="text-[10px] font-medium text-sky-500">🌐 Live</span>
                          )}
                          <span className="text-[10px] text-slate-300">{fmtModelName(msg.model)}</span>
                        </span>
                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            className="flex items-center gap-1 text-[10px] text-sky-500 active:text-sky-700"
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="2" y1="12" x2="22" y2="12"/>
                              <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                            </svg>
                            <span>Sources</span>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              {expandedSources[msg.id]
                                ? <polyline points="18 15 12 9 6 15"/>
                                : <polyline points="6 9 12 15 18 9"/>}
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    {expandedSources[msg.id] && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1.5 pl-1 space-y-1 border-t border-slate-100 pt-1.5">
                        {msg.sources.slice(0, 5).map((url, i) => {
                          let domain = url
                          try { domain = new URL(url).hostname.replace(/^www\./, '') } catch {}
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-1.5 text-[10px] text-sky-500 active:text-sky-700">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              <span className="truncate max-w-[200px]">{domain}</span>
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          </div>

          {/* Input */}
          <div className="shrink-0 px-4 py-3 border-t border-slate-100">
            {availableSections.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-1">
                Generate at least one card to start asking questions
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question… (Enter to send)"
                  rows={1}
                  disabled={chatLoading}
                  className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[12px] text-slate-700 placeholder-slate-300 focus:outline-none focus:border-violet-300 bg-slate-50 disabled:opacity-50"
                  style={{ maxHeight: 80 }}
                />
                <button
                  onClick={handleSend}
                  disabled={!question.trim() || chatLoading}
                  className="shrink-0 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center disabled:opacity-40 active:bg-violet-700"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
