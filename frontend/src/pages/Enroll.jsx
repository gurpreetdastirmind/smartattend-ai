import { useEffect, useRef, useState } from 'react'
import { listClasses, listStudents, enroll, addStudent, createRoom, detectGroupFaces } from '../api'
import { openEnrollLaptopWs, openGroupEnrollLaptopWs } from '../ws'

export default function Enroll() {
  const [classes, setClasses] = useState([])
  const [sel, setSel] = useState(null)
  const [students, setStudents] = useState([])
  const [files, setFiles] = useState([])
  const [msg, setMsg] = useState('')
  
  // Mobile / Group state
  const [room, setRoom] = useState('')
  const [status, setStatus] = useState('')
  const [targetStudent, setTargetStudent] = useState(null)
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [croppedFaces, setCroppedFaces] = useState([])
  const wsRef = useRef(null)

  useEffect(() => { listClasses().then(setClasses) }, [])
  
  const refreshStudents = async () => {
    if (sel) setStudents(await listStudents(sel.id))
  }
  useEffect(() => { refreshStudents() }, [sel])

  // Basic enroll for single manual file upload
  const doEnroll = async (sid, selectedFiles = files) => {
    if (!selectedFiles.length) return alert('Choose 1-3 images')
    try {
      const r = await enroll(sid, selectedFiles)
      setMsg(`✅ Stored ${r.samples_stored} sample(s)`)
      setFiles([])
    } catch (e) { setMsg('❌ ' + e.message) }
  }

  // Mobile Individual Enroll
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

  // Start Group Enroll (Mobile or Laptop)
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

  // Upload Group Enroll from Laptop
  const onGroupFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsGroupMode(true)
    setCroppedFaces([])
    setRoom('') 
    setStatus('Detecting faces from uploaded image…')
    await processGroupImage(file)
  }

  // Shared logic to process the image
  const processGroupImage = async (file) => {
    try {
      const res = await detectGroupFaces(file)
      if (!res.faces || res.faces.length === 0) {
        setStatus('⚠️ No faces detected in the photo.')
      } else {
        setCroppedFaces(res.faces)
        setStatus(`✅ Detected ${res.faces.length} face(s). Fill details to enroll.`)
      }
    } catch (err) {
      setStatus('❌ Error processing group photo.')
    }
  }

  // NEW: Add Student and Enroll Face simultaneously
  const handleAddAndEnroll = async (idx, faceB64) => {
    const rollInput = document.getElementById(`roll-${idx}`).value
    const nameInput = document.getElementById(`name-${idx}`).value

    if (!rollInput || !nameInput) {
      return alert("Please enter both Roll No and Name")
    }

    setStatus(`Creating student ${nameInput} and enrolling face...`)
    try {
      // 1. Create student in database
      const newStudent = await addStudent({
        class_id: sel.id,
        roll_no: rollInput,
        full_name: nameInput
      })
      
      // 2. Prepare the cropped image as a file
      const blob = await (await fetch(`data:image/jpeg;base64,${faceB64}`)).blob()
      const file = new File([blob], "crop.jpg", { type: "image/jpeg" })
      
      // 3. Enroll face
      await enroll(newStudent.student.id, [file])
      
      setStatus(`✅ Successfully added and enrolled ${nameInput}!`)
      
      // Clear inputs and refresh table
      document.getElementById(`roll-${idx}`).value = ''
      document.getElementById(`name-${idx}`).value = ''
      refreshStudents()

    } catch (err) {
      setStatus('❌ Error: ' + err.message)
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

          {/* Cropped Faces Result */}
          {isGroupMode && croppedFaces.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
              <h3>Detected Faces</h3>
              <p className="muted">Enter Roll No and Name for each face, then click Enroll.</p>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
                {croppedFaces.map((face, idx) => (
                  <div key={idx} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center', width: '160px' }}>
                    <img src={`data:image/jpeg;base64,${face.image_b64}`} alt="face" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                    
                    <input id={`roll-${idx}`} placeholder="Roll No" style={{ width: '100%', marginTop: '10px', padding: '6px', fontSize: '12px' }} />
                    <input id={`name-${idx}`} placeholder="Full Name" style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '12px' }} />
                    
                    <button 
                      onClick={() => handleAddAndEnroll(idx, face.image_b64)}
                      style={{ width: '100%', marginTop: '8px', padding: '6px', fontSize: '12px', background: '#22c55e' }}
                    >
                      Save & Enroll
                    </button>
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