import { useEffect, useRef, useState } from 'react'
import { listClasses, listStudents, enroll, createRoom } from '../api'
import { openEnrollLaptopWs } from '../ws'

export default function Enroll() {
  const [classes, setClasses] = useState([])
  const [sel, setSel] = useState(null)
  const [students, setStudents] = useState([])
  const [files, setFiles] = useState([])
  const [msg, setMsg] = useState('')
  
  // Mobile camera state
  const [room, setRoom] = useState('')
  const [status, setStatus] = useState('')
  const [targetStudent, setTargetStudent] = useState(null)
  const wsRef = useRef(null)

  useEffect(() => { listClasses().then(setClasses) }, [])
  useEffect(() => { if (sel) listStudents(sel.id).then(setStudents) }, [sel])

  const doEnroll = async (sid, selectedFiles = files) => {
    if (!selectedFiles.length) return alert('Choose 1-3 images')
    if (selectedFiles.length > 3) return alert('Max 3 images')
    try {
      const r = await enroll(sid, selectedFiles)
      setMsg(`✅ Stored ${r.samples_stored} sample(s)`)
      setFiles([])
    } catch (e) { setMsg('❌ ' + e.message) }
  }

  // Start Mobile Enrollment
  const startMobileEnroll = async (student) => {
    setTargetStudent(student)
    const { room: rid } = await createRoom()
    setRoom(rid)
    setStatus('Waiting for phone…')
    
    const ws = openEnrollLaptopWs(rid, async (blob) => {
      setStatus('📷 Photo received! Enrolling…')
      const file = new File([blob], 'mobile_enroll.jpg', { type: 'image/jpeg' })
      await doEnroll(student.id, [file])
      setStatus('✅ Enrollment complete!')
    })
    wsRef.current = ws
    ws.onopen = () => setStatus(`Room ready for ${student.full_name} — scan QR`)
  }

  const phoneUrl = room ? `${location.origin}/mobile/${room}?type=enroll` : ''
  const qrSrc = phoneUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(phoneUrl)}` : ''

  return (
    <div className="card">
      <h2>Enroll Faces</h2>
      <label>Class:</label>
      <select value={sel?.id || ''} onChange={e => setSel(classes.find(c => c.id === +e.target.value))}>
        <option value="">— select —</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {sel && (
        <>
          <div className="row" style={{ marginTop: 12 }}>
            <input type="file" accept="image/*" multiple
              onChange={e => setFiles(Array.from(e.target.files || []))} />
            <span className="muted">{files.length} selected</span>
          </div>
          {msg && <p>{msg}</p>}
          
          <table>
            <thead><tr><th>Roll</th><th>Name</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>{s.roll_no}</td><td>{s.full_name}</td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => doEnroll(s.id)}>Upload File</button>
                    <button onClick={() => startMobileEnroll(s)}>📱 Capture on Mobile</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {room && (
            <div className="mobile-box" style={{ marginTop: '20px' }}>
              <div>
                <p><b>Enrolling:</b> {targetStudent?.full_name}</p>
                <p><b>Scan with your phone:</b></p>
                <img src={qrSrc} alt="QR" className="qr" />
                <p className="muted small">Or open: <code>{phoneUrl}</code></p>
              </div>
              <div className="muted small">
                Tap <b>Send Photo</b> on the phone.
              </div>
            </div>
          )}
          {status && <p className="status">{status}</p>}
        </>
      )}
    </div>
  )
}