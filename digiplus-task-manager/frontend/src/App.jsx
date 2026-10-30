import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MeetingNotes from './pages/MeetingNotes'
import TeamManagement from './pages/TeamManagement'
import Logs from './pages/Logs'
import Profile from './pages/Profile'

function AppLayout({ role, username, onLogout, children }) {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  if (isLoginPage) {
    return children
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      <Navbar role={role} username={username} onLogout={onLogout} />
      <main className="flex-1 w-full max-w-full">
        {children}
      </main>
    </div>
  )
}

function ProtectedRoute({ role, children }) {
  if (!role) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  const [role, setRole] = useState(() => {
    return localStorage.getItem('user_role') || null
  })
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('user_name') || 'David'
  })

  useEffect(() => {
    const handleStorageChange = () => {
      setRole(localStorage.getItem('user_role'))
      setUsername(localStorage.getItem('user_name') || 'David')
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleLogin = (selectedRole, selectedUser) => {
    localStorage.setItem('user_role', selectedRole)
    localStorage.setItem('user_name', selectedUser)
    setRole(selectedRole)
    setUsername(selectedUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_name')
    setRole(null)
  }

  return (
    <BrowserRouter>
      <AppLayout role={role} username={username} onLogout={handleLogout}>
        <Routes>
          <Route
            path="/login"
            element={
              role ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role={role}>
                <Dashboard role={role} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute role={role}>
                <Profile role={role} username={username} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notes"
            element={
              <ProtectedRoute role={role}>
                <MeetingNotes role={role} username={username} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ingest"
            element={
              <ProtectedRoute role={role}>
                <MeetingNotes role={role} username={username} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/team"
            element={
              <ProtectedRoute role={role}>
                <TeamManagement role={role} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/offboarding"
            element={
              <ProtectedRoute role={role}>
                <TeamManagement role={role} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/logs"
            element={
              <ProtectedRoute role={role}>
                <Logs />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route
            path="*"
            element={<Navigate to={role ? '/dashboard' : '/login'} replace />}
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}
