import { useState, useEffect, useCallback, useId } from 'react'

const API_BASE_URL = 'http://localhost:8000/api'

export default function Offboarding({ role }) {
  const departingEmployeeInputId = useId()
  const targetEmployeeInputId = useId()

  const [departingEmployee, setDepartingEmployee] = useState('')
  const [targetEmployee, setTargetEmployee] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const [tasks, setTasks] = useState([])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tasks`)
      if (!res.ok) throw new Error('Failed to load tasks')
      const data = await res.json()
      setTasks(data || [])
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/tasks`)
        if (res.ok && isMounted) {
          const data = await res.json()
          setTasks(data || [])
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  const handleReassign = async (e) => {
    e.preventDefault()
    if (!departingEmployee.trim() || !targetEmployee.trim() || isSubmitting) return

    setIsSubmitting(true)
    setResultMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch(`${API_BASE_URL}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_owner: departingEmployee.trim(),
          new_owner: targetEmployee.trim(),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Reassignment failed.')
      }

      const result = await res.json()
      setResultMessage(
        `Successfully transferred ${result.reassigned_tasks} active task(s) across ${result.documents_updated} document(s) from "${result.old_owner}" to "${result.new_owner}".`
      )
      setDepartingEmployee('')
      setTargetEmployee('')
      await fetchTasks()
    } catch (err) {
      setErrorMessage(err.message || 'Error executing reassignment')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Current active owners
  const activeOwners = Array.from(
    new Set(
      tasks
        .filter((t) => t.status?.toLowerCase() !== 'closed')
        .map((t) => t.owner)
        .filter(Boolean)
    )
  )

  // Tasks of departing employee if typed
  const previewTasks = tasks.filter(
    (t) =>
      departingEmployee.trim() &&
      t.owner?.toLowerCase() === departingEmployee.trim().toLowerCase() &&
      t.status?.toLowerCase() !== 'closed'
  )

  if (role !== 'Manager') {
    return (
      <div className="w-full max-w-full px-6 lg:px-12 py-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-800">Manager Access Required</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Team offboarding and bulk reassignment capabilities are restricted to the Manager role. Please switch your role in the top navigation bar.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-600"></span>
          Team Offboarding & Work Transfer
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Seamlessly reassign all active, in-progress, and open tasks when an employee transitions off the project.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Reassignment Form */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Execute Work Transfer</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Updates all non-closed tasks matching the departing employee across MongoDB knowledge base records.
            </p>
          </div>

          <form onSubmit={handleReassign} className="space-y-4">
            <div>
              <label htmlFor={departingEmployeeInputId} className="block text-xs font-bold text-slate-700 mb-1">
                Departing Employee (Current Owner)
              </label>
              <input
                id={departingEmployeeInputId}
                type="text"
                required
                value={departingEmployee}
                onChange={(e) => setDepartingEmployee(e.target.value)}
                placeholder="e.g. Alice"
                list="active-owners-list"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600"
              />
              <datalist id="active-owners-list">
                {activeOwners.map((owner, idx) => (
                  <option key={idx} value={owner} />
                ))}
              </datalist>
              <p className="text-[11px] text-slate-400 mt-1">
                Current active owners with tasks: {activeOwners.join(', ') || 'None found'}
              </p>
            </div>

            <div>
              <label htmlFor={targetEmployeeInputId} className="block text-xs font-bold text-slate-700 mb-1">
                Transfer Work To (Target Colleague)
              </label>
              <input
                id={targetEmployeeInputId}
                type="text"
                required
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                placeholder="e.g. Elena Rostova"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600"
              />
            </div>

            {resultMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{resultMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !departingEmployee.trim() || !targetEmployee.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Reassigning Action Items in MongoDB...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Reassign Active Work</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Impact Preview */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Transfer Impact Preview
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {previewTasks.length} task(s) to be transferred
            </span>
          </div>

          {departingEmployee.trim() ? (
            previewTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No active (open / in progress) tasks found for owner &quot;{departingEmployee}&quot;.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {previewTasks.map((task, i) => (
                  <div key={i} className="p-3 bg-purple-50/40 border border-purple-100 rounded-xl text-xs space-y-1">
                    <p className="font-semibold text-slate-900">{task.description}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Status: <strong className="text-purple-700">{task.status}</strong></span>
                      <span>Due: {task.due_date || 'None'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Type or select a departing employee on the left to inspect their active tasks prior to reassignment.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
