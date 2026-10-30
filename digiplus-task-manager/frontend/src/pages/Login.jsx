import { useState, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'

import { API_BASE_URL } from '../config'

export default function Login({ onLogin }) {
  const developerNameInputId = useId()
  const navigate = useNavigate()
  const [developerName, setDeveloperName] = useState('David')
  const [managerName, setManagerName] = useState('Alex Morgan')
  const [activeTab, setActiveTab] = useState('developer') // 'developer' | 'manager'
  const [teamList, setTeamList] = useState(['David', 'Sarah', 'Elena Rostova', 'Bob'])

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/employees`)
        if (res.ok) {
          const data = await res.json()
          const activeNames = (data || [])
            .filter((e) => e.status?.toLowerCase() === 'active')
            .map((e) => e.name)
          if (activeNames.length > 0) {
            setTeamList(activeNames)
          }
        }
      } catch (err) {
        console.error('Failed to load employees for login:', err)
      }
    }
    loadEmployees()
  }, [])

  const handleSelectRole = (role, username) => {
    const finalUser = username?.trim() || (role === 'Developer' ? 'David' : 'Alex Morgan')
    localStorage.setItem('user_role', role)
    localStorage.setItem('user_name', finalUser)
    if (onLogin) onLogin(role, finalUser)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-600/25 mx-auto text-white font-mono font-bold text-2xl">
            D+
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            DigiPlus Task Manager
          </h1>
          <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest font-semibold">
            Enterprise Intelligence & Telemetry
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 text-center">
            <h2 className="text-sm font-bold text-slate-800">
              Select Your Profile & Role
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose your developer persona or administrative profile.
            </p>
          </div>

          {/* Role Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('developer')}
              className={`py-2 px-3 rounded-lg transition-all ${
                activeTab === 'developer'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Developer Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manager')}
              className={`py-2 px-3 rounded-lg transition-all ${
                activeTab === 'manager'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Manager Profile
            </button>
          </div>

          {/* Developer Login Box */}
          {activeTab === 'developer' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor={developerNameInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Developer Username
                </label>
                <input
                  id={developerNameInputId}
                  type="text"
                  value={developerName}
                  onChange={(e) => setDeveloperName(e.target.value)}
                  placeholder="e.g. David, Sarah, Elena Rostova"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600 font-medium"
                />
              </div>

              {/* Preset Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Select Existing Teammate:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {teamList.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDeveloperName(preset)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                        developerName === preset
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectRole('Developer', developerName)}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <span>Login as Developer ({developerName || 'David'})</span>
                <span>&rarr;</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manager Name
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600 font-medium"
                />
              </div>

              <p className="text-xs text-slate-500 leading-relaxed bg-purple-50/60 p-3 rounded-xl border border-purple-100">
                Managers hold administrative privileges to ingest meeting transcripts, upload PDF files, reassign tickets, and manage team offboarding.
              </p>

              <button
                type="button"
                onClick={() => handleSelectRole('Manager', managerName)}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <span>Login as Manager ({managerName || 'Manager'})</span>
                <span>&rarr;</span>
              </button>
            </div>
          )}

          <div className="pt-2 text-center text-xs text-slate-400">
            Powered by Google Gemini 3.8 Flash & MongoDB Atlas
          </div>
        </div>
      </div>
    </div>
  )
}
