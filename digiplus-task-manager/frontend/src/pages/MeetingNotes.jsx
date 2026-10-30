import { useState, useEffect, useCallback, useId } from 'react'
import { downloadSummaryAsFile } from '../utils/fileExport'

import { API_BASE_URL } from '../config'

export default function MeetingNotes({ role, username }) {
  const effectiveUser = username || localStorage.getItem('user_name') || 'Team Member'
  const meetingTextInputId = useId()
  const pdfInputId = useId()
  const noteAuthorInputId = useId()

  // Tab State: 'add' or 'history'
  const [activeTab, setActiveTab] = useState('history') // start on all meetings so user sees them right away
  const [inputMode, setInputMode] = useState('text') // 'text' | 'pdf'

  // Input states
  const [rawText, setRawText] = useState('')
  const [authorName, setAuthorName] = useState(effectiveUser)
  const [pdfFile, setPdfFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [newlyCreatedSummary, setNewlyCreatedSummary] = useState(null)

  // Meeting notes list
  const [notes, setNotes] = useState([])
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Selected note for modal details
  const [selectedNote, setSelectedNote] = useState(null)

  // Pass summary to employee modal state
  const [passTargetNote, setPassTargetNote] = useState(null)
  const [employees, setEmployees] = useState([])
  const [targetEmployee, setTargetEmployee] = useState('')
  const [passMessage, setPassMessage] = useState('')
  const [isPassing, setIsPassing] = useState(false)
  const [passFeedback, setPassFeedback] = useState(null)

  // Fetch all notes
  const fetchNotes = useCallback(async () => {
    setIsLoadingNotes(true)
    try {
      const res = await fetch(`${API_BASE_URL}/notes`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch meeting notes:', err)
    } finally {
      setIsLoadingNotes(false)
    }
  }, [])

  // Fetch employees for passing summary
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`)
      if (res.ok) {
        const data = await res.json()
        // Only active employees
        const active = (data || []).filter((e) => e.status?.toLowerCase() === 'active')
        setEmployees(active)
        if (active.length > 0 && !targetEmployee) {
          setTargetEmployee(active[0].name)
        }
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }, [targetEmployee])

  useEffect(() => {
    fetchNotes()
    fetchEmployees()
  }, [fetchNotes, fetchEmployees])

  // Handle Note Submission (Text)
  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (!rawText.trim() || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setNewlyCreatedSummary(null)

    try {
      const res = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: rawText.trim(),
          source_type: 'meeting',
          author: authorName || effectiveUser,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to process meeting notes.')
      }

      const data = await res.json()
      setNewlyCreatedSummary(data)
      setRawText('')
      await fetchNotes()
      setActiveTab('history') // Switch to see the new note in the list
    } catch (err) {
      setErrorMessage(err.message || 'Error processing notes')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle PDF Upload
  const handlePdfSubmit = async (e) => {
    e.preventDefault()
    if (!pdfFile || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setNewlyCreatedSummary(null)

    const formData = new FormData()
    formData.append('file', pdfFile)
    formData.append('source_type', 'meeting_pdf')

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to process PDF.')
      }

      const data = await res.json()
      setNewlyCreatedSummary(data)
      setPdfFile(null)
      await fetchNotes()
      setActiveTab('history')
    } catch (err) {
      setErrorMessage(err.message || 'Error processing PDF')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Passing Summary to Employee
  const handlePassSummarySubmit = async (e) => {
    e.preventDefault()
    if (!passTargetNote || !targetEmployee || isPassing) return

    setIsPassing(true)
    setPassFeedback(null)

    try {
      const res = await fetch(`${API_BASE_URL}/notes/pass-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: passTargetNote.id,
          target_employee: targetEmployee,
          sender_name: effectiveUser,
          message: passMessage,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Failed to pass summary.')
      }

      setPassFeedback(`Summary successfully sent to ${targetEmployee}!`)
      setPassMessage('')
      await fetchNotes()
      setTimeout(() => {
        setPassTargetNote(null)
        setPassFeedback(null)
      }, 1800)
    } catch (err) {
      setPassFeedback(`Error: ${err.message}`)
    } finally {
      setIsPassing(false)
    }
  }

  // Filter notes
  const filteredNotes = notes.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.decisions || []).some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'meeting' && (item.source_type === 'meeting' || item.source_type === 'meeting_pdf')) ||
      (typeFilter === 'developer' && item.source_type === 'developer_handoff')

    return matchesSearch && matchesType
  })

  // Format readable date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recently'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Meeting Notes & Summaries
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Turn meeting transcripts and PDF documents into actionable summaries and assign tasks.
          </p>
        </div>

        {/* Tab Switcher & Quick Add Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Meeting Notes ({notes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100'
            }`}
          >
            <span>+ Add Meeting Note</span>
          </button>
        </div>
      </div>

      {/* Success banner if note was just created */}
      {newlyCreatedSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Meeting Summary Generated Successfully!</p>
              <p className="text-[11px] text-emerald-700">
                Created {newlyCreatedSummary.action_items?.length || 0} action items and captured {newlyCreatedSummary.decisions?.length || 0} decisions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadSummaryAsFile(newlyCreatedSummary)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Summary File</span>
            </button>
            <button
              type="button"
              onClick={() => setNewlyCreatedSummary(null)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: ADD MEETING NOTE */}
      {activeTab === 'add' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Add New Meeting Note</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste meeting notes or upload a PDF to extract decisions and action items automatically.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  inputMode === 'text' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Text Notes
              </button>
              <button
                type="button"
                onClick={() => setInputMode('pdf')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  inputMode === 'pdf' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Upload PDF
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}

          {/* Form: Text Notes */}
          {inputMode === 'text' ? (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={noteAuthorInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Submitted By (Author)
                  </label>
                  <input
                    id={noteAuthorInputId}
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="e.g. Alex Morgan, David"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRawText(
                        `Weekly Product & Engineering Sync:\n` +
                        `- Approved Q4 migration to Tailwind CSS design system.\n` +
                        `- Alice to finalize authentication token rotation by 2026-11-05.\n` +
                        `- Bob will deliver the responsive React dashboard by 2026-11-08.\n` +
                        `- Charlie to configure MongoDB Atlas read replicas.`
                      )
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl transition-colors"
                  >
                    Load Example Notes
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor={meetingTextInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Meeting Content / Notes
                </label>
                <textarea
                  id={meetingTextInputId}
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste meeting discussion, decisions made, and assigned tasks here..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600 font-sans leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rawText.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Analyzing & Summarizing...</span>
                    </>
                  ) : (
                    <span>Generate Meeting Summary</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Form: PDF Upload */
            <form onSubmit={handlePdfSubmit} className="space-y-4">
              <div>
                <label htmlFor={pdfInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Select Meeting PDF Document
                </label>
                <input
                  id={pdfInputId}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files[0] || null)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !pdfFile}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {isSubmitting ? 'Extracting & Summarizing...' : 'Upload & Process PDF'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: ALL MEETING NOTES & SUMMARIES */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters & Search Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80 relative">
              <input
                type="text"
                placeholder="Search meeting summaries, decisions, authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    typeFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('meeting')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    typeFilter === 'meeting' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Meetings & PDFs
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('developer')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    typeFilter === 'developer' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Developer Updates
                </button>
              </div>

              <button
                type="button"
                onClick={fetchNotes}
                disabled={isLoadingNotes}
                className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                title="Refresh Meeting Notes"
              >
                <svg className={`w-4 h-4 ${isLoadingNotes ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Meeting Notes Cards */}
          {isLoadingNotes && notes.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-slate-500 mt-3 font-medium">Loading meeting notes...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
                📄
              </div>
              <h3 className="text-sm font-bold text-slate-800">No meeting notes found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No meeting notes or developer updates match your filter. Click "+ Add Meeting Note" to create one.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                + Add First Meeting Note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNotes.map((note) => {
                const actionCount = note.action_items?.length || 0
                const decisionsCount = note.decisions?.length || 0
                const sharedCount = note.shared_with?.length || 0

                return (
                  <div
                    key={note.id}
                    className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              note.source_type === 'developer_handoff'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : note.filename
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {note.source_type === 'developer_handoff'
                              ? 'Developer Update'
                              : note.filename
                              ? 'PDF Document'
                              : 'Meeting Notes'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDate(note.created_at)}
                          </span>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                          By: {note.author || 'Team'}
                        </span>
                      </div>

                      {/* Summary Snippet */}
                      <div className="py-3">
                        <p className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">
                          {note.filename || 'Executive Summary'}
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {note.summary || 'Summary unavailable.'}
                        </p>
                      </div>

                      {/* Badges / Metrics */}
                      <div className="flex flex-wrap items-center gap-2 pb-3 text-[11px]">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          {actionCount} action item{actionCount === 1 ? '' : 's'}
                        </span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          {decisionsCount} decision{decisionsCount === 1 ? '' : 's'}
                        </span>
                        {sharedCount > 0 && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold">
                            Shared with: {note.shared_with.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Open Details Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedNote(note)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition-colors"
                        >
                          Open Details
                        </button>

                        {/* Save as File Button */}
                        <button
                          type="button"
                          onClick={() => downloadSummaryAsFile(note)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Save Summary File (.md)"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Save File</span>
                        </button>
                      </div>

                      {/* Pass Summary to Employee (Manager) */}
                      {role === 'Manager' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPassTargetNote(note)
                            setPassFeedback(null)
                          }}
                          className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <span>Pass to Employee &rarr;</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: OPEN FULL MEETING DETAILS */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedNote.source_type?.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {formatDate(selectedNote.created_at)}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">
                  {selectedNote.filename || 'Meeting Summary & Details'}
                </h2>
                <p className="text-xs text-slate-500">
                  Recorded by <span className="font-semibold text-slate-700">{selectedNote.author || 'Team'}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Executive Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <h3 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                  <span>📌</span> Executive Summary
                </h3>
                <p className="text-slate-700 leading-relaxed font-sans">
                  {selectedNote.summary || 'Summary unavailable.'}
                </p>
              </div>

              {/* Key Decisions */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <span>💡</span> Key Decisions ({selectedNote.decisions?.length || 0})
                </h3>
                {selectedNote.decisions && selectedNote.decisions.length > 0 ? (
                  <ul className="space-y-1.5 pl-2">
                    {selectedNote.decisions.map((decision, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{decision}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic">No specific decisions recorded.</p>
                )}
              </div>

              {/* Action Items */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <span>✅</span> Action Items & Tasks ({selectedNote.action_items?.length || 0})
                </h3>
                {selectedNote.action_items && selectedNote.action_items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNote.action_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span>Owner: <strong className="text-slate-700">{item.owner}</strong></span>
                            <span>•</span>
                            <span>Due: <strong>{item.due_date}</strong></span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status?.toLowerCase() === 'closed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status?.toLowerCase() === 'in progress'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {item.status || 'Open'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No action items recorded.</p>
                )}
              </div>

              {/* Shared with Info */}
              {selectedNote.shared_with && selectedNote.shared_with.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex items-center gap-2">
                  <span className="text-blue-700 font-bold">👥 Shared With:</span>
                  <span className="text-blue-900 font-semibold">
                    {selectedNote.shared_with.join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => downloadSummaryAsFile(selectedNote)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Save Summary File</span>
              </button>

              <div className="flex items-center gap-2">
                {role === 'Manager' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPassTargetNote(selectedNote)
                      setSelectedNote(null)
                    }}
                    className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Pass to Employee
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedNote(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PASS SUMMARY TO ANOTHER EMPLOYEE */}
      {passTargetNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pass Summary to Employee</h3>
                <p className="text-xs text-slate-500">Send this meeting brief directly to a team member.</p>
              </div>
              <button
                type="button"
                onClick={() => setPassTargetNote(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {passFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  passFeedback.startsWith('Error')
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {passFeedback}
              </div>
            )}

            <form onSubmit={handlePassSummarySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Target Employee
                </label>
                <select
                  value={targetEmployee}
                  onChange={(e) => setTargetEmployee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role} - {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Note / Instructions
                </label>
                <textarea
                  rows={2}
                  value={passMessage}
                  onChange={(e) => setPassMessage(e.target.value)}
                  placeholder="e.g. Please review key decisions and lead task delivery..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                />
              </div>

              <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 text-[11px] text-purple-800">
                This summary will immediately be visible on <strong>{targetEmployee || 'the employee'}</strong>'s profile and dashboard under "Summaries Passed to Me".
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPassTargetNote(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPassing || !targetEmployee}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isPassing ? 'Sending Summary...' : 'Send Summary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

