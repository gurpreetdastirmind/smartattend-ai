import { useEffect, useState } from 'react'
import { listClasses } from '../api'

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  
  useEffect(() => { listClasses().then(setClasses).catch(e => alert(e.message)) }, [])

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 8px 0', color: 'var(--primary)' }}>Welcome Back!</h1>
        <p className="muted">Your complete AI attendance solution.</p>
      </div>

      <div className="card">
        <h2>Quick Start Guide</h2>
        <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: 'var(--primary)' }}>1. Classes</h3>
            <p className="muted small">Create a new class to get started.</p>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: 'var(--purple)' }}>2. Enroll</h3>
            <p className="muted small">Register student faces (single or group photo).</p>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h3 style={{ color: 'var(--success)' }}>3. Attendance</h3>
            <p className="muted small">Upload a photo and review the AI results.</p>
          </div>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-box">
          <h4>Total Classes</h4>
          <p>{classes.length}</p>
        </div>
        <div className="stat-box">
          <h4>System Status</h4>
          <p style={{ color: 'var(--success)' }}>Online</p>
        </div>
      </div>
    </div>
  )
}