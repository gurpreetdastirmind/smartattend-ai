import { useEffect, useRef, useState } from 'react'
import {
  listClasses, listStudents, createSession, processPhoto,
  saveAttendance, getAttendance, exportUrl, createRoom
} from '../api'
import { openLaptopWs } from '../ws'

export default function Attendance() {
  const [classes, setClasses] = useState([])
  const [cls, setCls] = useState(null)
  const [subject, setSubject] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [session, setSession] = useState(null)
  const [threshold, setThreshold] = useState(0.363)
  const [margin, setMargin] = useState(0.05)
  const [annotated, setAnnotated] = useState(null)
  const [roster, setRoster] = useState([])
  const [room, setRoom] = useState('')
  const [phoneConnected, setPhoneConnected] = useState(false)
  const [status, setStatus] = useState('')
  const wsRef = useRef(null)

  useEffect(() => { listClasses().then(setClasses) }, [])

  const startMobileCapture = async () => {
    const { room: rid } = await createRoom()
    setRoom(rid)
    setPhoneConnected(false)
    setStatus('Waiting for phone…')
    const ws = openLaptopWs(rid, async (blob) => {
      setStatus('📷 Photo received from phone, processing…')
      const file = new File([blob], 'mobile.jpg', { type: 'image/jpeg' })
      await handlePhoto(file)
    })
    wsRef.current = ws
    ws.onopen = () => setStatus('Room ready — scan the QR on your phone')
  }

  const handlePhoto = async (file) => {
    if (!session) return alert('Create session first')
    try {
      const r = await processPhoto(session.id, file, threshold, margin)
      if (!r.faces.length) {
        setAnnotated(null)
        setStatus('⚠️ ' + (r.message || 'No face detected'))
      } else {
        setAnnotated(`data:image/jpeg;base64,${r.annotated_b64}`)
        setStatus(`✅ Detected ${r.faces.length} face(s)`)
      }
      const att = await getAttendance(session.id)
      const sugMap = {}
      r.suggestions.forEach(s => {
        if (s.student_id && s.label === 'SUGGEST_PRESENT')
          sugMap[s.student_id] = { status: 'PRESENT', score: s.score }
        else if (s.student_id && s.label === 'NEEDS_REVIEW')
          sugMap[s.student_id] = { status: 'UNMARKED', score: s.score }
      })
      const merged = att.map(row => {
        const s = sugMap[row.student_id]
        return s ? { ...row, status: s.status, match_score: s.score, source: 'AI' } : row
      })
      setRoster(merged)
    } catch (e) {
      try {
        const errObj = JSON.parse(e.message);
        setStatus('❌ ' + (errObj.detail || 'Error processing photo'));
      } catch {
        setStatus('❌ ' + e.message);
      }
    }
  }

  const startSession = async () => {
    if (!cls) return alert('Pick class')
    const s = await createSession({ class_id: cls.id, session_date: date, subject })
    setSession(s)
    setRoster(await getAttendance(s.id))
  }

  const setStatusRow = (sid, st) =>
    setRoster(r => r.map(x => x.student_id === sid ? { ...x, status: st, source: 'Teacher' } : x))

  const doSave = async () => {
    if (!session) return
    await saveAttendance({ session_id: session.id, rows: roster })
    setStatus('💾 Saved & approved')
  }

  const onUploadFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) await handlePhoto(f)
  }

  const phoneUrl = room ? `${location.origin}/mobile/${room}` : ''
  const qrSrc = phoneUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(phoneUrl)}` : ''

  return (
    <div className="card">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Take Attendance</h2>
        <p className="muted small" style={{ marginTop: '4px' }}>Create a session, then upload a group photo or connect your phone.</p>
      </div>

      <div className="row">
        <select value={cls?.id || ''} onChange={e => setCls(classes.find(c => c.id === +e.target.value))}>
          <option value="">— select class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
        <button onClick={startSession} disabled={!cls}>Create Session</button>
      </div>

      {session && (
        <>
          <div className="row">
            <label>Threshold</label>
            <input type="number" step="0.01" value={threshold}
              onChange={e => setThreshold(+e.target.value)} style={{ width: 100, maxWidth: '100px' }} />
            <label>Margin</label>
            <input type="number" step="0.01" value={margin}
              onChange={e => setMargin(+e.target.value)} style={{ width: 100, maxWidth: '100px' }} />
          </div>

          <div className="row">
            <input type="file" accept="image/*" onChange={onUploadFile} style={{ maxWidth: '300px' }} />
            <button className="btn-purple" onClick={startMobileCapture}>📱 Capture on Mobile</button>
          </div>

          {room && (
            <div className="mobile-box">
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Scan with your phone:</p>
                <img src={qrSrc} alt="QR" className="qr" />
              </div>
              <div className="muted">
                <p>📱 Tap <b>Send Photo</b> on the phone.</p>
                <p>💻 The laptop will update <b>without refreshing</b>.</p>
                <p>Status: {phoneConnected ? '🟢 connected' : '⚪ waiting…'}</p>
              </div>
            </div>
          )}

          {status && <p style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '16px' }}>{status}</p>}

          {annotated && (
            <div className="preview" style={{ marginTop: '24px' }}>
              <h3>Annotated Preview</h3>
              <img src={annotated} alt="preview" />
            </div>
          )}

          <h3 style={{ marginTop: '32px' }}>Roster</h3>
          <table>
            <thead>
              <tr>
                <th>Roll</th><th>Name</th><th>Status</th><th>Score</th>
                <th>Set</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(r => (
                <tr key={r.student_id}>
                  <td><b>{r.roll_no}</b></td>
                  <td>{r.full_name}</td>
                  <td><span className={`badge st-${r.status}`}>{r.status}</span></td>
                  <td>{r.match_score?.toFixed?.(3) ?? '—'}</td>
                  <td style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setStatusRow(r.student_id, 'PRESENT')} style={{ padding: '6px 12px', background: 'var(--success)' }}>P</button>
                    <button onClick={() => setStatusRow(r.student_id, 'ABSENT')} style={{ padding: '6px 12px', background: 'var(--danger)' }}>A</button>
                    <button onClick={() => setStatusRow(r.student_id, 'UNMARKED')} style={{ padding: '6px 12px', background: 'var(--warning)' }}>U</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: '32px' }}>
            <button className="btn-success" onClick={doSave}>✅ Save & Approve</button>
            <a href={exportUrl(session.id)} target="_blank" rel="noreferrer">
              <button>⬇️ Export Excel</button>
            </a>
          </div>
        </>
      )}
    </div>
  )
}