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
      <h2>Attendance History</h2>
      
      <div className="row">
        <label>Select Class:</label>
        <select value={sel?.id || ''} onChange={e => setSel(classes.find(c => c.id === +e.target.value))}>
          <option value="">— select —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {sel && history.length === 0 && <p className="muted">No sessions recorded yet for this class.</p>}

      {history.map(session => (
        <div key={session.session_id} style={{ marginTop: '20px', padding: '15px', background: '#0f172a', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, color: '#93c5fd' }}>
            📅 {session.date} {session.subject ? `— ${session.subject}` : ''}
          </h3>
          <table>
            <thead>
              <tr><th>Roll</th><th>Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {session.records.map(r => (
                <tr key={r.roll}>
                  <td>{r.roll}</td>
                  <td>{r.name}</td>
                  <td className={`st-${r.status}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}