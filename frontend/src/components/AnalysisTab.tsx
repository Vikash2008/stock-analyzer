import React, { useState, useEffect } from 'react'

interface Note {
  id: string
  timestamp: string
  text: string
}

interface Props {
  portfolio: string
  symbol: string
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

export function AnalysisTab({ portfolio, symbol }: Props) {
  const key = storageKey(portfolio, symbol)
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]')
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(notes))
  }, [notes, key])

  function addNote() {
    const text = input.trim()
    if (!text) return
    setNotes(prev => [{ id: `${Date.now()}`, timestamp: nowIST(), text }, ...prev])
    setInput('')
  }

  function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditText(note.text)
  }

  function saveEdit(id: string) {
    const text = editText.trim()
    if (!text) return
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text, timestamp: nowIST() } : n))
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

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
          disabled={!input.trim()}
          className="mt-2 w-full py-3 text-[12px] font-semibold rounded-lg bg-[#2563eb] text-white disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className="text-[10px] text-slate-400 hover:text-[#2563eb] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-[10px] text-slate-300 hover:text-red-400 transition-colors"
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
                      disabled={!editText.trim()}
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
