import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Classes from './pages/Classes'
import Enroll from './pages/Enroll'
import Attendance from './pages/Attendance'
import MobileCapture from './pages/MobileCapture'
import History from './pages/History'

export default function App() {
  const location = useLocation();
  // Hide the top navigation if the URL contains "/mobile"
  const isMobileView = location.pathname.startsWith('/mobile');

  return (
    <div className="app">
      {!isMobileView && (
        <nav className="topnav">
          <div className="brand">🎓 SmartAttend AI</div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/classes">Classes</Link>
          <Link to="/enroll">Enroll</Link>
          <Link to="/attendance">Take Attendance</Link>
          <Link to="/history">History</Link> 
        </nav>
      )}
      
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/enroll" element={<Enroll />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/history" element={<History />} />
          <Route path="/mobile/:room" element={<MobileCapture />} />
        </Routes>
      </main>
    </div>
  )
}