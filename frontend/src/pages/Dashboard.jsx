import { useEffect, useState } from 'react'
import { listClasses } from '../api'
import heroImage from '../images/Gemini_Generated_Image_4k89qb4k89qb4k89.png'

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  
  useEffect(() => { listClasses().then(setClasses).catch(e => alert(e.message)) }, [])

  return (
    <div>
      <div style={{
        position: 'relative', borderRadius: '24px', overflow: 'hidden',
        marginBottom: '40px', boxShadow: 'var(--shadow-lg)', height: '350px'
      }}>
        <img src={heroImage} alt="SmartAttend AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.4))',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px'
        }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 16px 0', color: '#fff', fontWeight: 800 }}>Welcome Back!</h1>
          <p style={{ color: '#e2e8f0', fontSize: '1.2rem', maxWidth: '600px', lineHeight: 1.6 }}>
            Your complete AI-powered attendance solution. Scan a photo, detect faces, and mark attendance in seconds.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📸</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Mobile Capture</h3>
          <p className="muted small" style={{ margin: 0 }}>Use your phone as a wireless camera. Photos instantly appear on the laptop.</p>
        </div>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🧠</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Offline AI</h3>
          <p className="muted small" style={{ margin: 0 }}>Powered by OpenCV. 100% local processing means no cloud subscriptions.</p>
        </div>
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📊</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Instant Reports</h3>
          <p className="muted small" style={{ margin: 0 }}>Save attendance instantly and export clean Excel sheets for your records.</p>
        </div>
      </div>

      <div className="dash-stats">
        <div className="stat-box">
          <h4>Active Classes</h4>
          <p>{classes.length}</p>
        </div>
        <div className="stat-box">
          <h4>System Status</h4>
          <p style={{ color: 'var(--success)' }}>Online</p>
        </div>
        <div className="stat-box">
          <h4>AI Engine</h4>
          <p style={{ color: 'var(--purple)' }}>Ready</p>
        </div>
      </div>
    </div>
  )
}