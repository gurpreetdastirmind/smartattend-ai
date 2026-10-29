import { useEffect, useState } from 'react'
import { listClasses } from '../api'

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  
  useEffect(() => { listClasses().then(setClasses).catch(e => alert(e.message)) }, [])

  return (
    <div>
      <div className="dash-header">
        <h1>Welcome to SmartAttend</h1>
        <p className="muted">Your complete offline AI attendance solution.</p>
      </div>

      <div className="card">
        <h2>Quick Start Guide</h2>
        <p className="muted">Follow these steps to take attendance in under 2 minutes:</p>
        <ol style={{ marginTop: '16px', lineHeight: '2' }}>
          <li>Go to <b>Classes</b> and create a new class.</li>
          <li>Go to <b>Enroll</b> and register your students' faces.</li>
          <li>Go to <b>Take Attendance</b> and upload a group photo!</li>
        </ol>
      </div>

      <div className="dash-stats">
        <div className="stat-box">
          <h4>Total Classes</h4>
          <p>{classes.length}</p>
        </div>
        <div className="stat-box" style={{ borderColor: 'var(--success)' }}>
          <h4>System Status</h4>
          <p style={{ color: 'var(--success)' }}>Online</p>
        </div>
      </div>
    </div>
  )
}