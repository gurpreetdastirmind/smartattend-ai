import { useEffect, useRef, useState } from 'react'
import { listClasses, listStudents, enroll, createRoom, detectGroupFaces } from '../api'
import { openEnrollLaptopWs, openGroupEnrollLaptopWs } from '../ws'

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
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [croppedFaces, setCroppedFaces] = useState([])
  const wsRef = useRef(null)

  useEffect(() => { listClasses().then(setClasses) }, [])
  useEffect(() => { if (sel) listStudents(sel.id).then(setStudents) }, [sel])

  // 1. Basic enroll for single manual file upload
  const doEnroll = async (sid, selectedFiles = files) => {
    if (!selectedFiles.length) return alert('Choose 1-3 images')
    try {
      const r = await enroll(sid, selectedFiles)
      setMsg(`✅ Stored ${r.samples_stored} sample(s)`)
      setFiles([])
    } catch (e) { setMsg('❌ ' + e.message) }
  }

  // 2. Mobile Individual Enroll
  const startMobileEnroll = async (student) => {
    setTargetStudent(student)
    setIsGroupMode(false)
    setCroppedFaces([])
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

  // 3. Mobile Group Enroll
  const startGroupEnroll = async () => {
    setIsGroupMode(true)
    setTargetStudent(null)
    setCroppedFaces([])
    const { room: rid } = await createRoom()
    setRoom(rid)
    setStatus('Waiting for phone to send group photo…')
    
    const ws = openGroupEnrollLaptopWs(rid, async (blob) => {
      setStatus('📷 Group photo received! Detecting faces…')
      const file = new File([blob], 'group_enroll.jpg', { type: 'image/jpeg' })
      await processGroupImage(file)
    })
    wsRef.current = ws
    ws.onopen = () => setStatus(`Room ready for Group Photo — scan QR`)
  }

  // 4. Laptop Upload Group Enroll (NEW)
  const onGroupFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsGroupMode(true)
    setCroppedFaces([])
    setRoom('') // Hide QR code if it was there
    setStatus('Detecting faces from uploaded image…')
    await processGroupImage(file)
  }

  // Shared logic to process the image and show cropped faces
  const processGroupImage = async (file) => {
    try {
      const res = await detectGroupFaces(file)
      if (!res.faces || res.faces.length === 0) {
        setStatus('⚠️ No faces detected in the photo.')
      } else {
        setCroppedFaces(res.faces)
        setStatus(`✅ Detected ${res.faces.length} face(s). Select a student to enroll.`)
      }
    } catch (err) {
      setStatus('❌ Error processing group photo.')
    }
  }

  const phoneUrl = room ? `${location.origin}/mobile/${room}?type=${isGroupMode ? 'group_enroll' : 'enroll'}` : ''
  const qrSrc = phoneUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(phoneUrl)}` : ''

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Enroll Faces</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ background: '#2563eb', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            📁 Upload Group Photo
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onGroupFileUpload} />
          </label>
          
          <button onClick={startGroupEnroll} style={{ background: '#8b5cf6' }}>
            📸 Capture Group Photo (Mobile)
          </button>
        </div>
      </div>
      
      <label>Class:</label>
      <select value={sel?.id || ''} onChange={e => setSel(classes.find(c => c.id === +e.target.value))}>
        <option value="">— select —</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {sel && (
        <>
          <div className="row" style={{ marginTop: 12 }}>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
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
                    <button onClick={() => startMobileEnroll(s)}>📱 Single Photo</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* QR Code Block for Mobile */}
          {room && (
            <div className="mobile-box" style={{ marginTop: '20px' }}>
              <div>
                {!isGroupMode && <p><b>Enrolling:</b> {targetStudent?.full_name}</p>}
                {isGroupMode && <p><b>Enrolling: Group Photo</b></p>}
                <p><b>Scan with your phone:</b></p>
                <img src={qrSrc} alt="QR" className="qr" />
              </div>
              <div className="muted small">
                Tap <b>Send Photo</b> on the phone.
              </div>
            </div>
          )}

          {/* Cropped Faces Result (Works for BOTH mobile and laptop uploads) */}
          {isGroupMode && croppedFaces.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
              <h3>Detected Faces</h3>
              <p className="muted">Click a face below, then choose the student to enroll it.</p>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
                {croppedFaces.map((face, idx) => (
                  <div key={idx} style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <img src={`data:image/jpeg;base64,${face.image_b64}`} alt="face" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                    <br />
                    <select 
                      onChange={async (e) => {
                        const sid = e.target.value;
                        if (!sid) return;
                        setStatus('Enrolling face...');
                        try {
                          const blob = await (await fetch(`data:image/jpeg;base64,${face.image_b64}`)).blob();
                          const file = new File([blob], "crop.jpg", { type: "image/jpeg" });
                          await enroll(sid, [file]);
                          setStatus('✅ Face enrolled successfully!');
                          e.target.value = "";
                        } catch (err) {
                          setStatus('❌ Error: ' + err.message);
                        }
                      }}
                      style={{ marginTop: '10px', width: '120px' }}
                    >
                      <option value="">Select Student</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.roll_no} - {s.full_name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status && <p className="status">{status}</p>}
        </>
      )}
    </div>
  )
}