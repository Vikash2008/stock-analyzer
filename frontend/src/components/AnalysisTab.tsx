import React, { useMemo, useState, useEffect } from 'react'
import type { Transaction } from '../api/types'
import { useSetNotes } from '../hooks/useSetNotes'

interface Note {
  id: string
  timestamp: string
  text: string
}

interface Props {
  portfolio: string
  symbol: string
  // When provided (real holdings, via TransactionsPage), notes persist to the CSV — keyed by
  // symbol only, shared across every broker portfolio holding it, and merged forward on
  // reimport (see backend/routers/add_txn.py's set-notes + import-merge-tags). When omitted
  // (ResearchPage's "research" pseudo-portfolio, exploring a stock that may not be held at
  // all), there's no transaction row to attach a note to, so it stays localStorage-only.
  transactions?: Transaction[]
}

function storageKey(portfolio: string, symbol: string) {
  return `notes:${portfolio}:${symbol}`
}

function nowIST(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function parseNotes(raw: string | null | undefined): Note[] {
  try {
    return JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
}

export function AnalysisTab({ portfolio, symbol, transactions }: Props) {
  const csvBacked = transactions !== undefined
  const setNotesMutation = useSetNotes()

  const csvNotes = useMemo(() => {
    if (!csvBacked) return []
    const row = transactions!.find(t => t.symbol === symbol && t.notes)
    return parseNotes(row?.notes)
  }, [csvBacked, transactions, symbol])

  const key = storageKey(portfolio, symbol)
  const [localNotes, setLocalNotes] = useState<Note[]>(() =>
    csvBacked ? [] : parseNotes(localStorage.getItem(key))
  )

  useEffect(() => {
    if (csvBacked) return
    localStorage.setItem(key, JSON.stringify(localNotes))
  }, [localNotes, key, csvBacked])

  const notes = csvBacked ? csvNotes : localNotes

  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  function persist(updated: Note[]) {
    if (csvBacked) {
      setNotesMutation.mutate({ symbol, notes: JSON.stringify(updated) })
    } else {
      setLocalNotes(updated)
    }
  }

  function addNote() {
    const text = input.trim()
    if (!text) return
    persist([{ id: `${Date.now()}`, timestamp: nowIST(), text }, ...notes])
    setInput('')
  }

  function deleteNote(id: string) {
    persist(notes.filter(n => n.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditText(note.text)
  }

  function saveEdit(id: string) {
    const text = editText.trim()
    if (!text) return
    persist(notes.map(n => n.id === id ? { ...n, text, timestamp: nowIST() } : n))
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  const busy = csvBacked && setNotesMutation.isPending

  return (
    <div>
      {/* Input area */}
      <div className="mb-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full text-[12px] text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#2563eb]"
        />
        <button
          onClick={addNote}
          disabled={!input.trim() || busy}
          className="mt-2 w-full py-1.5 text-[12px] font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
        >
          Add Note
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-center text-[11px] text-slate-400 py-6">No notes yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map(note => (
            <div
              key={note.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              {/* Header: timestamp + actions */}
              <div className="flex justify-between items-center gap-2 mb-1">
                <span className="text-[10px] text-slate-400 shrink-0">{note.timestamp}</span>
                <div className="flex gap-2 shrink-0">
                  {editingId !== note.id && (
                    <button
                      onClick={() => startEdit(note)}
                      disabled={busy}
                      className="text-[10px] text-slate-400 hover:text-[#2563eb] transition-colors disabled:opacity-40"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => deleteNote(note.id)}
                    disabled={busy}
                    className="text-[10px] text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Body: view or edit */}
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={3}
                    className="w-full text-[12px] text-slate-700 bg-slate-50 border border-[#2563eb] rounded-lg px-3 py-2 resize-none focus:outline-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={() => saveEdit(note.id)}
                      disabled={!editText.trim() || busy}
                      className="px-3 py-2 text-[11px] font-semibold rounded-lg bg-[#2563eb] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 text-[11px] font-medium rounded-lg border border-slate-200 text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{note.text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
