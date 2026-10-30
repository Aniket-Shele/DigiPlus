import { useState, useEffect, useCallback } from 'react'

import { API_BASE_URL } from '../config'

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/logs`)
      if (!res.ok) throw new Error('Failed to fetch system logs')
      const data = await res.json()
      setLogs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/logs`)
        if (res.ok && isMounted) {
          const data = await res.json()
          setLogs(data || [])
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

  // Optional Auto-Refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const filteredLogs = logs.filter((log) => {
    if (levelFilter === 'ALL') return true
    return log.levelname?.toUpperCase() === levelFilter.toUpperCase()
  })

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
            System Telemetry & Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time feed of JSON logs from app_logs.json, capturing correlation IDs, Gemini processing latencies, and database lifecycle events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer shadow-xs select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Auto-Refresh (5s)</span>
          </label>

          <button
            onClick={fetchLogs}
            title="Refresh logs"
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

      {/* Terminal Container */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col font-mono text-xs">
        {/* Terminal Header */}
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            <span className="text-slate-400 text-xs ml-2 font-mono">
              backend/app_logs.json ({logs.length} entries loaded)
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            {['ALL', 'INFO', 'WARNING', 'ERROR'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-0.5 rounded-lg font-semibold transition-all ${
                  levelFilter === lvl
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 overflow-y-auto max-h-[680px] space-y-2">
          {isLoading && logs.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              Streaming logs from server...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              No matching log records found in app_logs.json.
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const isError = log.levelname === 'ERROR'
              const isWarn = log.levelname === 'WARNING'
              const latency = log.ai_latency_seconds

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-colors ${
                    isError
                      ? 'bg-red-950/30 border-red-900/60 text-red-200'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/50 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800/70 text-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[11px]">
                    <span className="text-slate-500">{log.asctime || 'N/A'}</span>

                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        isError
                          ? 'bg-red-900 text-red-100'
                          : isWarn
                          ? 'bg-amber-900 text-amber-100'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                      }`}
                    >
                      {log.levelname}
                    </span>

                    {log.correlation_id && (
                      <span className="text-indigo-400 bg-indigo-950/60 px-2 py-0.2 rounded border border-indigo-900/40 text-[10px]">
                        cid:{log.correlation_id}
                      </span>
                    )}

                    {latency !== undefined && (
                      <span className="ml-auto text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50">
                        AI Latency: {typeof latency === 'number' ? latency.toFixed(4) : latency}s
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <div className="whitespace-pre-wrap break-all text-slate-200 font-mono leading-relaxed">
                    {typeof log.message === 'string'
                      ? log.message
                      : JSON.stringify(log.message, null, 2)}
                  </div>

                  {log.error && (
                    <div className="mt-1.5 text-red-400 bg-red-950/70 p-2 rounded border border-red-900/50 text-[11px]">
                      Error Trace: {log.error}
                    </div>
                  )}

                  {log.old_owner && log.new_owner && (
                    <div className="mt-1.5 text-purple-300 bg-purple-950/70 p-2 rounded border border-purple-900/50 text-[11px]">
                      Reassignment: &quot;{log.old_owner}&quot; ➔ &quot;{log.new_owner}&quot; ({log.reassigned_tasks} task(s) updated)
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
