import { useEffect, useState } from 'react'
import { listClasses, listStudents, enroll } from '../api'

export default function Enroll() {
  const [classes, setClasses] = useState([])
  const [sel, setSel] = useState(null)
  const [students, setStudents] = useState([])
  const [files, setFiles] = useState([])
  const [msg, setMsg] = useState('')

  useEffect(() => { listClasses().then(setClasses) }, [])
  useEffect(() => { if (sel) listStudents(sel.id).then(setStudents) }, [sel])

  const doEnroll = async (sid) => {
    if (!files.length) return alert('Choose 1-3 images')
    if (files.length > 3) return alert('Max 3 images')
    try {
      const r = await enroll(sid, files)
      setMsg(`✅ Stored ${r.samples_stored} sample(s)`)
      setFiles([])
    } catch (e) { setMsg('❌ ' + e.message) }
  }

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
            <thead><tr><th>Roll</th><th>Name</th><th>Enroll</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>{s.roll_no}</td><td>{s.full_name}</td>
                  <td><button onClick={() => doEnroll(s.id)}>Enroll</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}