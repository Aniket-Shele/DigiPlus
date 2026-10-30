import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

import { API_BASE_URL } from '../config'

export default function Dashboard({ role }) {
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [taskFilter, setTaskFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingTaskId, setUpdatingTaskId] = useState(null)
  const [activeCycle, setActiveCycle] = useState(null)

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/tasks`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch tasks`)
      const data = await res.json()
      setTasks(data || [])
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const [tasksRes, cyclesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/tasks`),
          fetch(`${API_BASE_URL}/cycles`),
        ])
        if (tasksRes.ok && isMounted) {
          const data = await tasksRes.json()
          setTasks(data || [])
        }
        if (cyclesRes.ok && isMounted) {
          const cyclesData = await cyclesRes.json()
          const current = (cyclesData || []).find((c) => c.status?.toLowerCase() === 'active') || cyclesData[0]
          setActiveCycle(current)
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  // Handle Task Status Change (PUT /api/tasks/{doc_id})
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
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to update task status')
      }

      // Refresh tasks immediately
      await fetchTasks()
    } catch (err) {
      alert(`Status update error: ${err.message}`)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesFilter =
      taskFilter === 'all' || t.status?.toLowerCase() === taskFilter.toLowerCase()
    const matchesSearch =
      !searchQuery.trim() ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.owner?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Summary Metrics
  const openCount = tasks.filter((t) => t.status?.toLowerCase() === 'open').length
  const inProgressCount = tasks.filter((t) => t.status?.toLowerCase() === 'in progress').length
  const closedCount = tasks.filter((t) => t.status?.toLowerCase() === 'closed').length
  const totalCount = tasks.length
  const completionPercent = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Active Tasks & Lifecycle Board
            </h1>
            {role && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {role} View
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise overview of AI-extracted action items across meetings, handoffs, and specifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/notes"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Meeting Notes</span>
          </Link>

          <button
            onClick={fetchTasks}
            title="Refresh task list"
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

      {/* Active Work Cycle Banner */}
      {activeCycle && (
        <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              🎯
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-950">
                  Active Work Cycle: {activeCycle.name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  {activeCycle.status}
                </span>
              </div>
              <p className="text-xs text-indigo-800/80 mt-0.5">
                {activeCycle.goal || 'Platform delivery sprint'} •{' '}
                <span className="font-medium text-slate-600">
                  {activeCycle.start_date || 'Current'} &rarr; {activeCycle.end_date || 'Target'}
                </span>
              </p>
            </div>
          </div>
          {role === 'Manager' && (
            <Link
              to="/team"
              className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-white border border-purple-200 px-3 py-1.5 rounded-xl shadow-2xs transition-colors shrink-0"
            >
              Manage Cycles &rarr;
            </Link>
          )}
        </div>
      )}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{totalCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Open</span>
          <div className="mt-1 text-2xl font-bold text-amber-600">{openCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">In Progress</span>
          <div className="mt-1 text-2xl font-bold text-blue-600">{inProgressCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Closed</span>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{closedCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-4 lg:col-span-1">
          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Completion</span>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{completionPercent}%</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {['all', 'Open', 'In Progress', 'Closed'].map((filter) => (
            <button
              key={filter}
              onClick={() => setTaskFilter(filter)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                taskFilter === filter
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter === 'all' ? `All (${totalCount})` : filter}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, descriptions, or owners..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Task Cards Grid */}
      {isLoading && tasks.length === 0 ? (
        <div className="py-24 text-center text-slate-400 space-y-3">
          <svg className="animate-spin w-8 h-8 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-medium">Loading tasks from MongoDB Atlas...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-800">No tasks found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `No action items match "${searchQuery}". Clear your search query or reset status filter.`
              : 'Head over to Ingestion to extract tasks from meeting notes, PDFs, or developer handoffs.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const taskKey = `${task.doc_id}-${task.task_index}`
            const isUpdating = updatingTaskId === taskKey

            return (
              <div
                key={taskKey}
                className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-2xl p-5 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {task.source_type}
                    </span>

                    {/* Status Lifecycle Dropdown */}
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

                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {task.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Owner */}
                  <div className="flex items-center gap-1.5 bg-slate-100/90 px-2.5 py-1 rounded-md text-slate-700 font-medium">
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{task.owner || 'Unassigned'}</span>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{task.due_date && task.due_date !== 'None' ? task.due_date : 'No deadline'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
