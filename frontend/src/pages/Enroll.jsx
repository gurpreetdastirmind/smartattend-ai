import { useEffect, useRef, useState } from 'react'
import { listClasses, listStudents, enroll, addStudent, createRoom, detectGroupFaces } from '../api'
import { openEnrollLaptopWs, openGroupEnrollLaptopWs } from '../ws'

export default function Enroll() {
  const [classes, setClasses] = useState([])
  const [sel, setSel] = useState(null)
  const [students, setStudents] = useState([])
  const [files, setFiles] = useState([])
  const [msg, setMsg] = useState('')

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

  const doEnroll = async (sid, selectedFiles = files) => {
    if (!selectedFiles.length) return alert('Choose 1-3 images')
    try {
      const r = await enroll(sid, selectedFiles)
      setMsg(`✅ Stored ${r.samples_stored} sample(s)`)
      setFiles([])
    } catch (e) { setMsg('❌ ' + e.message) }
  }

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

  const onGroupFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsGroupMode(true)
    setCroppedFaces([])
    setRoom('')
    setStatus('Detecting faces from uploaded image…')
    await processGroupImage(file)
  }

  const processGroupImage = async (file) => {
    try {
      const res = await detectGroupFaces(file, sel.id)
      if (!res.faces || res.faces.length === 0) {
        setStatus('⚠️ No faces detected in the photo.')
      } else {
        setCroppedFaces(res.faces)
        setStatus(`✅ Detected ${res.faces.length} face(s).`)
      }
    } catch (err) {
      setStatus('❌ Error processing group photo.')
    }
  }

  const handleAddAndEnroll = async (idx, faceB64) => {
    const rollInput = document.getElementById(`roll-${idx}`).value
    const nameInput = document.getElementById(`name-${idx}`).value

    if (!rollInput || !nameInput) {
      return alert("Please enter both Roll No and Name")
    }

    setStatus(`Creating student ${nameInput} and enrolling face...`)
    try {
      const newStudent = await addStudent({
        class_id: sel.id,
        roll_no: rollInput,
        full_name: nameInput
      })

      const blob = await (await fetch(`data:image/jpeg;base64,${faceB64}`)).blob()
      const file = new File([blob], "crop.jpg", { type: "image/jpeg" })

      await enroll(newStudent.student.id, [file])

      setStatus(`✅ Successfully added and enrolled ${nameInput}!`)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Enroll Faces</h2>
          <p className="muted small" style={{ marginTop: '4px' }}>Register student identities for the AI to recognize.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <label className="btn-upload">
            📁 Upload Group Photo
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onGroupFileUpload} />
          </label>

          <button className="btn-purple" onClick={startGroupEnroll}>
            📸 Capture Group Photo (Mobile)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <label>Select Class:</label>
        <select value={sel?.id || ''} onChange={e => setSel(classes.find(c => c.id === +e.target.value))}>
          <option value="">— select class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {sel && (
        <>
          <div className="row" style={{ marginTop: 24 }}>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))} style={{ maxWidth: '400px' }} />
            <span className="muted">{files.length} selected</span>
          </div>
          {msg && <p style={{ color: 'var(--success)', fontWeight: 600 }}>{msg}</p>}

          <table>
            <thead><tr><th>Roll</th><th>Name</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td><b>{s.roll_no}</b></td>
                  <td>{s.full_name}</td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => doEnroll(s.id)}>Upload File</button>
                    <button className="btn-purple" onClick={() => startMobileEnroll(s)}>📱 Single Photo</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {room && (
            <div className="mobile-box">
              <div>
                {!isGroupMode && <p style={{ fontSize: '1.1rem' }}><b>Enrolling:</b> {targetStudent?.full_name}</p>}
                {isGroupMode && <p style={{ fontSize: '1.1rem' }}><b>Enrolling:</b> Group Photo</p>}
                <p className="muted small">Scan with your phone camera:</p>
                <img src={qrSrc} alt="QR" className="qr" />
              </div>
              <div className="muted" style={{ maxWidth: '200px' }}>
                <p>📱 Tap <b>Send Photo</b> on the phone.</p>
                <p>💻 The laptop will automatically process it.</p>
              </div>
            </div>
          )}

          {isGroupMode && croppedFaces.length > 0 && (
            <div style={{ marginTop: '32px', borderTop: '2px solid var(--border)', paddingTop: '32px' }}>
              <h3 style={{ marginTop: 0 }}>Detected Faces</h3>
              <p className="muted small">Enter Roll No and Name for each face, then click Enroll.</p>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '20px' }}>
                {croppedFaces.map((face, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', textAlign: 'center', width: '180px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <img src={`data:image/jpeg;base64,${face.image_b64}`} alt="face" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', marginBottom: '12px' }} />

                    {face.existing_name ? (
                      <div style={{ padding: '12px', background: 'var(--success-bg)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                        ✅ Already Enrolled:<br /><span style={{ fontSize: '1rem' }}>{face.existing_name}</span>
                      </div>
                    ) : (
                      <>
                        <input id={`roll-${idx}`} placeholder="Roll No" style={{ width: '100%', marginBottom: '8px', padding: '8px', fontSize: '0.9rem' }} />
                        <input id={`name-${idx}`} placeholder="Full Name" style={{ width: '100%', marginBottom: '12px', padding: '8px', fontSize: '0.9rem' }} />

                        <button
                          onClick={() => handleAddAndEnroll(idx, face.image_b64)}
                          style={{ width: '100%', padding: '10px', fontSize: '0.9rem', background: 'var(--success)' }}
                        >
                          Save & Enroll
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {status && <p style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '24px' }}>{status}</p>}
        </>
      )}
    </div>
  )
}