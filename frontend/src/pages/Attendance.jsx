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

  // Auto-create a room when user clicks "Capture on Mobile"
  const startMobileCapture = async () => {
    const { room: rid } = await createRoom()
    setRoom(rid)
    setPhoneConnected(false)
    setStatus('Waiting for phone…')
    // open WS as laptop
    const ws = openLaptopWs(rid, async (blob) => {
      // blob = jpeg from phone
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
      // Merge suggestions into roster
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
      setStatus('❌ ' + e.message)
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

  // Build QR that points to mobile route
  const phoneUrl = room
    ? `${location.origin}/mobile/${room}`
    : ''
  const qrSrc = phoneUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(phoneUrl)}`
    : ''

  return (
    <div className="card">
      <h2>Take Attendance</h2>
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
              onChange={e => setThreshold(+e.target.value)} style={{ width: 80 }} />
            <label>Margin</label>
            <input type="number" step="0.01" value={margin}
              onChange={e => setMargin(+e.target.value)} style={{ width: 80 }} />
          </div>

          <div className="row">
            <input type="file" accept="image/*" onChange={onUploadFile} />
            <button onClick={startMobileCapture}>📱 Capture on Mobile</button>
          </div>

          {room && (
            <div className="mobile-box">
              <div>
                <p><b>Scan with your phone camera:</b></p>
                <img src={qrSrc} alt="QR" className="qr" />
                <p className="muted small">Or open on phone: <code>{phoneUrl}</code></p>
                <p>Phone: {phoneConnected ? '🟢 connected' : '⚪ waiting…'} — open the page on phone to auto-connect.</p>
              </div>
              <div className="muted small">
                Tap <b>Send Photo</b> on the phone — the laptop will update <b>without refreshing</b>.
              </div>
            </div>
          )}

          {status && <p className="status">{status}</p>}

          {annotated && (
            <div className="preview">
              <h3>Annotated Preview</h3>
              <img src={annotated} alt="preview" />
            </div>
          )}

          <h3>Roster</h3>
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
                  <td>{r.roll_no}</td>
                  <td>{r.full_name}</td>
                  <td className={`st-${r.status}`}>{r.status}</td>
                  <td>{r.match_score?.toFixed?.(3) ?? '—'}</td>
                  <td>
                    <button onClick={() => setStatusRow(r.student_id, 'PRESENT')}>P</button>
                    <button onClick={() => setStatusRow(r.student_id, 'ABSENT')}>A</button>
                    <button onClick={() => setStatusRow(r.student_id, 'UNMARKED')}>U</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row">
            <button onClick={doSave}>✅ Save & Approve</button>
            <a href={exportUrl(session.id)} target="_blank" rel="noreferrer">
              <button>⬇️ Export Excel</button>
            </a>
          </div>
        </>
      )}
    </div>
  )
}