import { useEffect, useState } from 'react'
import { listClasses } from '../api'
// 1. Import the image using a relative path
import heroImage from '../images/Gemini_Generated_Image_4k89qb4k89qb4k89.png'

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  
  useEffect(() => { listClasses().then(setClasses).catch(e => alert(e.message)) }, [])

  return (
    <div>
      {/* 2. Hero Banner Section */}
      <div style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '32px',
        boxShadow: 'var(--shadow)',
        height: '300px'
      }}>
        <img 
          src={heroImage} 
          alt="SmartAttend AI" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        {/* Dark gradient overlay so text is readable */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.2))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '40px'
        }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 8px 0', color: '#fff' }}>Welcome Back!</h1>
          <p style={{ color: '#e5e7eb', fontSize: '1.1rem', maxWidth: '500px' }}>
            Your complete AI-powered attendance solution. Scan a photo, detect faces, and mark attendance in seconds.
          </p>
        </div>
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