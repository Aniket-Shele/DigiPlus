import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { downloadSummaryAsFile } from '../utils/fileExport'

import { API_BASE_URL } from '../config'

export default function Profile({ username }) {
  const effectiveUser = username || localStorage.getItem('user_name') || 'David'
  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all')

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(effectiveUser)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch profile`)
      const data = await res.json()
      setProfileData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [effectiveUser])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(effectiveUser)}`)
        if (res.ok && isMounted) {
          const data = await res.json()
          setProfileData(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [effectiveUser])

  // Handle Status Update on Assigned Task
  const handleStatusChange = async (task, newStatus) => {
    if (!task.doc_id || task.task_index === undefined) return
    const taskKey = `${task.doc_id}-${task.task_index}`
    setUpdatingTaskId(taskKey)

    try {
      const res = await fetch(`${API_BASE_URL}/tasks/${task.doc_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_index: task.task_index,
          status: newStatus,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Failed to update task status')
      }

      // Automatically refresh profile
      await fetchProfile()
    } catch (err) {
      alert(`Status update failed: ${err.message}`)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const assignedTasks = profileData?.assigned_tasks || []
  const handoffHistory = profileData?.handoff_history || []
  const sharedSummaries = profileData?.shared_summaries || []
  const metrics = profileData?.metrics || {
    total_assigned: 0,
    open_tasks: 0,
    in_progress_tasks: 0,
    closed_tasks: 0,
    total_handoffs: 0,
    total_shared_summaries: 0,
  }

  const filteredTasks = assignedTasks.filter((t) => {
    if (taskFilter === 'all') return true
    return t.status?.toLowerCase() === taskFilter.toLowerCase()
  })

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-600/20 font-mono">
            {effectiveUser.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {effectiveUser}&apos;s Developer Profile
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Contributor
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalized task queue, ticket lifecycles, and technical handoff history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/ingest"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Submit New Handoff</span>
          </Link>

          <button
            onClick={fetchProfile}
            title="Refresh profile data"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-colors"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Assigned Tasks</span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{metrics.total_assigned}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Open</span>
          <div className="mt-1 text-2xl font-bold text-amber-600">{metrics.open_tasks}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">In Progress</span>
          <div className="mt-1 text-2xl font-bold text-blue-600">{metrics.in_progress_tasks}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Closed</span>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{metrics.closed_tasks}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Passed to Me</span>
          <div className="mt-1 text-2xl font-bold text-purple-600">{sharedSummaries.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Handoffs</span>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{metrics.total_handoffs}</div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* SECTION: SUMMARIES & MEETING NOTES PASSED TO ME */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              Summaries & Meeting Notes Passed to Me ({sharedSummaries.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Meeting briefs, action items, and technical updates forwarded to you by your manager.
            </p>
          </div>
          {sharedSummaries.length > 0 && (
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
              {sharedSummaries.length} active brief{sharedSummaries.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {sharedSummaries.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-600">No forwarded summaries yet</p>
            <p className="text-[11px] text-slate-400">
              When a manager passes a meeting summary to {effectiveUser}, it will appear here with full decisions and action items.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedSummaries.map((summaryItem) => (
              <div
                key={summaryItem.id}
                className="bg-purple-50/30 border border-purple-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-purple-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      Passed by {summaryItem.sender || 'Manager'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {summaryItem.created_at ? new Date(summaryItem.created_at).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  {/* Manager Note if any */}
                  {summaryItem.latest_message && (
                    <div className="bg-white/90 p-2.5 rounded-xl border border-purple-200 text-xs text-purple-950 font-medium flex items-start gap-1.5">
                      <span className="text-purple-600 font-bold">💬 Note:</span>
                      <span>{summaryItem.latest_message}</span>
                    </div>
                  )}

                  {/* Summary Content */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 mb-1">
                      {summaryItem.filename || 'Meeting Executive Summary'}
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed font-sans bg-white p-3 rounded-xl border border-slate-200">
                      {summaryItem.summary}
                    </p>
                  </div>

                  {/* Key Decisions */}
                  {summaryItem.decisions && summaryItem.decisions.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 mb-1">Decisions Made:</h4>
                      <ul className="text-xs text-slate-600 space-y-0.5 pl-3 list-disc">
                        {summaryItem.decisions.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action items assigned to this user */}
                  {summaryItem.action_items && summaryItem.action_items.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 mb-1">
                        Tasks in this Meeting ({summaryItem.action_items.length}):
                      </h4>
                      <div className="space-y-1.5">
                        {summaryItem.action_items.map((ai, i) => {
                          const isAssignedToUser = ai.owner?.toLowerCase() === effectiveUser.toLowerCase()
                          return (
                            <div
                              key={i}
                              className={`p-2 rounded-lg text-xs flex items-center justify-between gap-2 border ${
                                isAssignedToUser
                                  ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span>{ai.description}</span>
                              <span className="text-[10px] shrink-0 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/90 border border-slate-200">
                                {ai.owner} • {ai.status || 'Open'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Download / Save File Button */}
                <div className="pt-3 border-t border-purple-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    File Export Available
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadSummaryAsFile(summaryItem)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Save Summary File</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Two Crisp Sections: My Assigned Tasks & My Handoff & Commit History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* SECTION 1: MY ASSIGNED TASKS */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                My Assigned Tasks ({assignedTasks.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Action items assigned directly to you across all meetings and handoffs.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {['all', 'Open', 'In Progress', 'Closed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    taskFilter === f
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <svg className="w-8 h-8 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-xs font-medium text-slate-600">No tasks matching &quot;{taskFilter}&quot; assigned to {effectiveUser}.</p>
              <p className="text-[11px] text-slate-400">Tickets assigned to your name in meetings or handoffs will populate here.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredTasks.map((task) => {
                const taskKey = `${task.doc_id}-${task.task_index}`
                const isUpdating = updatingTaskId === taskKey

                return (
                  <div
                    key={taskKey}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-indigo-300 hover:bg-white transition-all space-y-3 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                        {task.description}
                      </p>

                      {/* Status Dropdown */}
                      <div className="relative shrink-0">
                        <select
                          aria-label="Update task status"
                          value={task.status || 'Open'}
                          disabled={isUpdating}
                          onChange={(e) => handleStatusChange(task, e.target.value)}
                          className={`text-xs font-bold rounded-lg pl-2.5 pr-6 py-1 border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
                            task.status?.toLowerCase() === 'closed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : task.status?.toLowerCase() === 'in progress'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                          {isUpdating ? (
                            <svg className="animate-spin w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Due: {task.due_date && task.due_date !== 'None' ? task.due_date : 'No deadline'}</span>
                      </span>

                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white text-slate-500 border border-slate-200 ml-auto">
                        Origin: {task.source_type}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* SECTION 2: MY HANDOFF & COMMIT HISTORY */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              My Handoff & Commit History ({handoffHistory.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological timeline of submitted architectural updates, stack decisions, and GitHub commits.
            </p>
          </div>

          {handoffHistory.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <svg className="w-8 h-8 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-xs font-medium text-slate-600">No developer handoffs recorded for {effectiveUser} yet.</p>
              <Link to="/ingest" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                Submit a Developer Handoff &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
              {handoffHistory.map((handoff) => (
                <div
                  key={handoff.id}
                  className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-purple-300 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                      Technical Handoff
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {handoff.created_at ? handoff.created_at.slice(0, 10) : 'Recent'}
                    </span>
                  </div>

                  {/* Summary */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 mb-1">Summary</h3>
                    <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                      {handoff.summary}
                    </p>
                  </div>

                  {/* Decisions */}
                  {handoff.decisions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-700 mb-1">Architectural Decisions</h3>
                      <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5 bg-white p-2.5 rounded-lg border border-slate-200">
                        {handoff.decisions.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Raw Text / Commits Preview */}
                  {handoff.raw_text && (
                    <details className="text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                      <summary className="font-semibold text-slate-700 select-none">
                        Inspect Raw Commit & Stack Notes
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded">
                        {handoff.raw_text}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

