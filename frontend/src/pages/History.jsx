import { useEffect, useState } from 'react'
import { listClasses, getHistory } from '../api'

export default function History() {
  const [classes, setClasses] = useState([])
  const [sel, setSel] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => { listClasses().then(setClasses) }, [])
  
  useEffect(() => {
    if (sel) getHistory(sel.id).then(setHistory)
  }, [sel])

  return (
    <div className="card">
      <h2>Attendance Reports</h2>
      <p className="muted">View session history and student attendance records.</p>
      
      <div className="row" style={{ marginTop: '24px' }}>
        <label>Filter by Class:</label>
        <select value={sel?.id || ''} onChange={e => setSel(classes.find(c => c.id === +e.target.value))}>
          <option value="">— select class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {sel && history.length === 0 && <p className="muted" style={{ marginTop: '24px' }}>No sessions recorded yet for this class.</p>}

      {history.map(session => (
        <div key={session.session_id} style={{ marginTop: '24px', padding: '24px', background: '#f9fafb', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--primary)' }}>
            📅 {session.date} {session.subject ? `— ${session.subject}` : ''}
          </h3>
          <table>
            <thead>
              <tr><th>Roll No</th><th>Student Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {session.records.map(r => (
                <tr key={r.roll}>
                  <td><b>{r.roll}</b></td>
                  <td>{r.name}</td>
                  <td><span className={`badge st-${r.status}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}