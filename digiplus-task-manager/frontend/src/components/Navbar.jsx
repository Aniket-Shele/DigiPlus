import { NavLink, useNavigate } from 'react-router-dom'

export default function Navbar({ role, username, onLogout }) {
  const navigate = useNavigate()
  const effectiveName = username || localStorage.getItem('user_name') || 'User'

  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur sticky top-0 z-30 shadow-xs">
      <div className="w-full max-w-full px-6 lg:px-12 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-3 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-600/20 text-white font-mono font-bold text-base">
              D+
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  DigiPlus Task Manager
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                  Enterprise
                </span>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              Active Tasks
            </NavLink>

            <NavLink
              to="/notes"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              Meeting Notes
            </NavLink>

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              My Profile
            </NavLink>

            {/* Team & Work Cycles - Manager Only */}
            {role === 'Manager' && (
              <NavLink
                to="/team"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 border border-purple-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                Team & Cycles
              </NavLink>
            )}

            <NavLink
              to="/logs"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              System Logs
            </NavLink>
          </nav>
        </div>

        {/* Right Status & Role Control */}
        <div className="flex items-center space-x-3">
          {/* User Profile Pill */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 transition-colors"
          >
            <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono">
              {effectiveName.slice(0, 1).toUpperCase()}
            </div>
            <span>{effectiveName}</span>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-bold uppercase">
              {role}
            </span>
          </button>

          {/* Switch Role / Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Switch Role</span>
          </button>
        </div>
      </div>
    </header>
  )
}

