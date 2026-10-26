import { useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Classes from './pages/Classes'
import Enroll from './pages/Enroll'
import Attendance from './pages/Attendance'

export default function App() {
  return (
    <div className="app">
      <nav className="topnav">
        <div className="brand">🎓 SmartAttend AI</div>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/classes">Classes</Link>
        <Link to="/enroll">Enroll</Link>
        <Link to="/attendance">Take Attendance</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/enroll" element={<Enroll />} />
          <Route path="/attendance" element={<Attendance />} />
        </Routes>
      </main>
    </div>
  )
}