import { useState, useEffect, useCallback, useId } from 'react'

import { API_BASE_URL } from '../config'

export default function TeamManagement({ role }) {
  const newEmpNameInputId = useId()
  const newEmpRoleInputId = useId()
  const newEmpDeptInputId = useId()
  const cycleNameInputId = useId()
  const cycleGoalInputId = useId()
  const cycleStartInputId = useId()
  const cycleEndInputId = useId()

  const [activeTab, setActiveTab] = useState('employees') // 'employees' | 'cycles' | 'reassign'

  // Employee State
  const [employees, setEmployees] = useState([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false)
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeRole, setNewEmployeeRole] = useState('Developer')
  const [newEmployeeDept, setNewEmployeeDept] = useState('Engineering')
  const [newEmployeeStatus, setNewEmployeeStatus] = useState('Active')
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [employeeError, setEmployeeError] = useState(null)

  // Work Cycles State
  const [cycles, setCycles] = useState([])
  const [isLoadingCycles, setIsLoadingCycles] = useState(false)
  const [isAddCycleModalOpen, setIsAddCycleModalOpen] = useState(false)
  const [newCycleName, setNewCycleName] = useState('')
  const [newCycleGoal, setNewCycleGoal] = useState('')
  const [newCycleStart, setNewCycleStart] = useState(new Date().toISOString().slice(0, 10))
  const [newCycleEnd, setNewCycleEnd] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  )
  const [newCycleStatus, setNewCycleStatus] = useState('Active')
  const [isSavingCycle, setIsSavingCycle] = useState(false)
  const [cycleError, setCycleError] = useState(null)

  // Pass Summary State
  const [isPassModalOpen, setIsPassModalOpen] = useState(false)
  const [passTargetEmployee, setPassTargetEmployee] = useState(null)
  const [notesList, setNotesList] = useState([])
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [passCustomNote, setPassCustomNote] = useState('')
  const [isSendingSummary, setIsSendingSummary] = useState(false)
  const [passSummaryMessage, setPassSummaryMessage] = useState(null)

  // Reassign Tasks State
  const [departingEmployee, setDepartingEmployee] = useState('')
  const [targetEmployee, setTargetEmployee] = useState('')
  const [isReassigning, setIsReassigning] = useState(false)
  const [reassignResult, setReassignResult] = useState(null)
  const [reassignError, setReassignError] = useState(null)

  // Fetch Employees
  const fetchEmployees = useCallback(async () => {
    setIsLoadingEmployees(true)
    try {
      const res = await fetch(`${API_BASE_URL}/employees`)
      if (res.ok) {
        const data = await res.json()
        setEmployees(data || [])
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
    } finally {
      setIsLoadingEmployees(false)
    }
  }, [])

  // Fetch Work Cycles
  const fetchCycles = useCallback(async () => {
    setIsLoadingCycles(true)
    try {
      const res = await fetch(`${API_BASE_URL}/cycles`)
      if (res.ok) {
        const data = await res.json()
        setCycles(data || [])
      }
    } catch (err) {
      console.error('Error fetching cycles:', err)
    } finally {
      setIsLoadingCycles(false)
    }
  }, [])

  // Fetch Meeting Notes for passing summary
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notes`)
      if (res.ok) {
        const data = await res.json()
        setNotesList(data || [])
        if (data && data.length > 0 && !selectedNoteId) {
          setSelectedNoteId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching notes:', err)
    }
  }, [selectedNoteId])

  useEffect(() => {
    fetchEmployees()
    fetchCycles()
    fetchNotes()
  }, [fetchEmployees, fetchCycles, fetchNotes])

  // Handle Add Employee (Active / Inactive)
  const handleAddEmployee = async (e) => {
    e.preventDefault()
    if (!newEmployeeName.trim() || isSavingEmployee) return

    setIsSavingEmployee(true)
    setEmployeeError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEmployeeName.trim(),
          role: newEmployeeRole.trim(),
          department: newEmployeeDept.trim(),
          status: newEmployeeStatus,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Failed to add employee.')
      }

      setNewEmployeeName('')
      setNewEmployeeRole('Developer')
      setNewEmployeeDept('Engineering')
      setNewEmployeeStatus('Active')
      setIsAddEmployeeModalOpen(false)
      await fetchEmployees()
    } catch (err) {
      setEmployeeError(err.message)
    } finally {
      setIsSavingEmployee(false)
    }
  }

  // Handle Toggle Employee Status (Active <-> Inactive)
  const handleToggleStatus = async (employee) => {
    const nextStatus = employee.status?.toLowerCase() === 'active' ? 'Inactive' : 'Active'
    try {
      const res = await fetch(`${API_BASE_URL}/employees/${employee.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to change status')
      }

      await fetchEmployees()
    } catch (err) {
      alert(`Status update failed: ${err.message}`)
    }
  }

  // Handle Start New Work Cycle
  const handleStartCycle = async (e) => {
    e.preventDefault()
    if (!newCycleName.trim() || isSavingCycle) return

    setIsSavingCycle(true)
    setCycleError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/cycles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCycleName.trim(),
          goal: newCycleGoal.trim(),
          start_date: newCycleStart,
          end_date: newCycleEnd,
          status: newCycleStatus,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Failed to start cycle.')
      }

      setNewCycleName('')
      setNewCycleGoal('')
      setIsAddCycleModalOpen(false)
      await fetchCycles()
    } catch (err) {
      setCycleError(err.message)
    } finally {
      setIsSavingCycle(false)
    }
  }

  // Handle Update Cycle Status
  const handleCycleStatusChange = async (cycleId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/cycles/${cycleId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update cycle status')
      await fetchCycles()
    } catch (err) {
      alert(err.message)
    }
  }

  // Handle Pass Summary to Employee
  const handlePassSummary = async (e) => {
    e.preventDefault()
    if (!passTargetEmployee || !selectedNoteId || isSendingSummary) return

    setIsSendingSummary(true)
    setPassSummaryMessage(null)

    try {
      const res = await fetch(`${API_BASE_URL}/notes/pass-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: selectedNoteId,
          target_employee: passTargetEmployee.name,
          sender_name: 'Alex Morgan (Manager)',
          message: passCustomNote,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Failed to pass summary.')
      }

      setPassSummaryMessage(`Summary successfully passed to ${passTargetEmployee.name}!`)
      setPassCustomNote('')
      setTimeout(() => {
        setIsPassModalOpen(false)
        setPassSummaryMessage(null)
      }, 1500)
    } catch (err) {
      setPassSummaryMessage(`Error: ${err.message}`)
    } finally {
      setIsSendingSummary(false)
    }
  }

  // Handle Reassign Tasks
  const handleReassign = async (e) => {
    e.preventDefault()
    if (!departingEmployee.trim() || !targetEmployee.trim() || isReassigning) return

    setIsReassigning(true)
    setReassignResult(null)
    setReassignError(null)

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
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Reassignment failed.')
      }

      const data = await res.json()
      setReassignResult(
        `Successfully transferred ${data.reassigned_tasks} task(s) from "${data.old_owner}" to "${data.new_owner}".`
      )
      setDepartingEmployee('')
      setTargetEmployee('')
    } catch (err) {
      setReassignError(err.message)
    } finally {
      setIsReassigning(false)
    }
  }

  // Employee Counts
  const activeCount = employees.filter((e) => e.status?.toLowerCase() === 'active').length
  const inactiveCount = employees.filter((e) => e.status?.toLowerCase() === 'inactive').length

  // Active Cycle
  const currentActiveCycle = cycles.find((c) => c.status?.toLowerCase() === 'active') || cycles[0]

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Team & Work Cycles
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
              Manager Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage active & inactive employees, start development cycles, and pass summaries across the team.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('employees')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'employees' ? 'bg-white text-purple-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Employees ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cycles')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'cycles' ? 'bg-white text-purple-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Work Cycles ({cycles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reassign')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'reassign' ? 'bg-white text-purple-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Transfer Tasks
          </button>
        </div>
      </div>

      {/* Current Active Cycle Banner */}
      {currentActiveCycle && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              🔄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-950">
                  Current Work Cycle: {currentActiveCycle.name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">
                  {currentActiveCycle.status}
                </span>
              </div>
              <p className="text-xs text-purple-800 mt-0.5">
                {currentActiveCycle.goal || 'Platform development & sprint lifecycle'} •{' '}
                <span className="font-medium text-slate-600">
                  {currentActiveCycle.start_date || 'Ongoing'} to {currentActiveCycle.end_date || 'TBD'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cycles')
              setIsAddCycleModalOpen(true)
            }}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            + Start New Cycle
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: EMPLOYEES (ACTIVE & INACTIVE) */}
      {/* ======================================================== */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-800">Employee Roster:</span>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                {activeCount} Active
              </span>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                {inactiveCount} Inactive
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmployeeError(null)
                setIsAddEmployeeModalOpen(true)
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>+ Add Employee</span>
            </button>
          </div>

          {/* Employee Cards Grid */}
          {isLoadingEmployees && employees.length === 0 ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl">
              <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-slate-500 mt-3 font-medium">Loading employees...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp) => {
                const isActive = emp.status?.toLowerCase() === 'active'
                return (
                  <div
                    key={emp.id}
                    className={`bg-white border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                      isActive ? 'border-slate-200 hover:border-purple-300' : 'border-slate-200/60 bg-slate-50/60 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-white ${
                              isActive ? 'bg-purple-600' : 'bg-slate-400'
                            }`}
                          >
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900">{emp.name}</h3>
                            <p className="text-[11px] text-slate-500">{emp.role}</p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </div>

                      {/* Department */}
                      <div className="py-3 text-xs text-slate-600">
                        <span className="text-slate-400 font-medium">Department: </span>
                        <span className="font-semibold text-slate-700">{emp.department || 'Engineering'}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Active / Inactive Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(emp)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isActive
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}
                        title={isActive ? 'Mark as Inactive' : 'Mark as Active'}
                      >
                        {isActive ? 'Mark Inactive' : 'Set Active'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {/* Pass Summary Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setPassTargetEmployee(emp)
                            setPassSummaryMessage(null)
                            setIsPassModalOpen(true)
                          }}
                          className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors"
                          title="Pass a meeting summary to this employee"
                        >
                          Pass Summary &rarr;
                        </button>

                        {/* Quick Reassign if Inactive */}
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setDepartingEmployee(emp.name)
                              setActiveTab('reassign')
                            }}
                            className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold"
                            title="Transfer open tasks from this employee"
                          >
                            Reassign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: WORK CYCLES & LIFECYCLE MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'cycles' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Development Work Cycles</h2>
              <p className="text-xs text-slate-500">Track iterations, sprints, and deliverable lifecycles.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCycleError(null)
                setIsAddCycleModalOpen(true)
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
            >
              + Start New Cycle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cycles.map((c) => {
              const isActive = c.status?.toLowerCase() === 'active'
              const isCompleted = c.status?.toLowerCase() === 'completed'

              return (
                <div
                  key={c.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                    isActive ? 'border-purple-300 ring-2 ring-purple-500/10' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.start_date || 'Start'} &rarr; {c.end_date || 'End'}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isCompleted
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="py-3">
                      <p className="text-xs text-slate-600 leading-relaxed font-sans">
                        {c.goal || 'No specific objective recorded.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">Lifecycle Phase</span>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleCycleStatusChange(c.id, 'Active')}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold"
                        >
                          Set Active
                        </button>
                      )}
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleCycleStatusChange(c.id, 'Completed')}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TASK TRANSFER / REASSIGNMENT */}
      {/* ======================================================== */}
      {activeTab === 'reassign' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Transfer Employee Tasks</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reassign all open tickets from an inactive or departing employee to an active teammate with 1 click.
            </p>
          </div>

          {reassignResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
              {reassignResult}
            </div>
          )}

          {reassignError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {reassignError}
            </div>
          )}

          <form onSubmit={handleReassign} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Departing / Inactive Employee
              </label>
              <select
                value={departingEmployee}
                onChange={(e) => setDepartingEmployee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
              >
                <option value="">-- Choose Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} ({emp.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Assignee (Active Employee)
              </label>
              <select
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
              >
                <option value="">-- Choose Target Employee --</option>
                {employees
                  .filter((emp) => emp.status?.toLowerCase() === 'active')
                  .map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isReassigning || !departingEmployee || !targetEmployee}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition-colors"
              >
                {isReassigning ? 'Transferring Tasks...' : 'Transfer All Active Tasks'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD EMPLOYEE */}
      {/* ======================================================== */}
      {isAddEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Employee</h3>
              <button
                type="button"
                onClick={() => setIsAddEmployeeModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {employeeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {employeeError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label htmlFor={newEmpNameInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Employee Full Name
                </label>
                <input
                  id={newEmpNameInputId}
                  type="text"
                  required
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  placeholder="e.g. Rachel Green"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={newEmpRoleInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Role / Title
                  </label>
                  <input
                    id={newEmpRoleInputId}
                    type="text"
                    value={newEmployeeRole}
                    onChange={(e) => setNewEmployeeRole(e.target.value)}
                    placeholder="e.g. Frontend Dev"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor={newEmpDeptInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    id={newEmpDeptInputId}
                    type="text"
                    value={newEmployeeDept}
                    onChange={(e) => setNewEmployeeDept(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                  />
                </div>
              </div>

              {/* Status Selector: Active or Inactive */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">Initial Status</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewEmployeeStatus('Active')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newEmployeeStatus === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Active Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEmployeeStatus('Inactive')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newEmployeeStatus === 'Inactive'
                        ? 'bg-slate-200 text-slate-800 border-slate-400 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Inactive (On Leave / Departing)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmployee || !newEmployeeName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSavingEmployee ? 'Saving Employee...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: START NEW WORK CYCLE */}
      {/* ======================================================== */}
      {isAddCycleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Start New Work Cycle</h3>
              <button
                type="button"
                onClick={() => setIsAddCycleModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {cycleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {cycleError}
              </div>
            )}

            <form onSubmit={handleStartCycle} className="space-y-4">
              <div>
                <label htmlFor={cycleNameInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Cycle / Sprint Name
                </label>
                <input
                  id={cycleNameInputId}
                  type="text"
                  required
                  value={newCycleName}
                  onChange={(e) => setNewCycleName(e.target.value)}
                  placeholder="e.g. Cycle 2: Real-Time Sockets & Checkout"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                />
              </div>

              <div>
                <label htmlFor={cycleGoalInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Cycle Goal / Milestone Deliverable
                </label>
                <textarea
                  id={cycleGoalInputId}
                  rows={2}
                  value={newCycleGoal}
                  onChange={(e) => setNewCycleGoal(e.target.value)}
                  placeholder="Briefly summarize what the team will ship in this cycle..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={cycleStartInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    id={cycleStartInputId}
                    type="date"
                    value={newCycleStart}
                    onChange={(e) => setNewCycleStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label htmlFor={cycleEndInputId} className="block text-xs font-bold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    id={cycleEndInputId}
                    type="date"
                    value={newCycleEnd}
                    onChange={(e) => setNewCycleEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">Cycle Status</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCycleStatus('Active')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newCycleStatus === 'Active'
                        ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Active Work Cycle
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCycleStatus('Planning')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newCycleStatus === 'Planning'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Upcoming / Planning
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCycleModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCycle || !newCycleName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSavingCycle ? 'Starting Cycle...' : 'Start Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: PASS SUMMARY DIRECTLY TO AN EMPLOYEE */}
      {/* ======================================================== */}
      {isPassModalOpen && passTargetEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pass Summary to {passTargetEmployee.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Send meeting action items and decisions directly to this employee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPassModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {passSummaryMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  passSummaryMessage.startsWith('Error')
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {passSummaryMessage}
              </div>
            )}

            <form onSubmit={handlePassSummary} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Meeting Note / Summary to Pass
                </label>
                {notesList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No meeting notes recorded yet.</p>
                ) : (
                  <select
                    value={selectedNoteId}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                  >
                    {notesList.map((note) => (
                      <option key={note.id} value={note.id}>
                        {note.filename || note.summary.slice(0, 45) + '...'} ({new Date(note.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Note / Priority Instructions
                </label>
                <textarea
                  rows={2}
                  value={passCustomNote}
                  onChange={(e) => setPassCustomNote(e.target.value)}
                  placeholder="e.g. Please lead the sprint delivery for these tickets..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-medium"
                />
              </div>

              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-[11px] text-purple-800">
                This summary will immediately be visible on <strong>{passTargetEmployee.name}</strong>'s personal profile and dashboard under "Summaries Passed to Me".
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPassModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingSummary || !selectedNoteId}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSendingSummary ? 'Sending Summary...' : 'Send Summary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

