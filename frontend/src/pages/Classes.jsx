import { useEffect, useState } from 'react'
import { listClasses, createClass, listStudents, addStudent } from '../api'

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [name, setName] = useState('')
  const [sel, setSel] = useState(null)
  const [students, setStudents] = useState([])
  const [roll, setRoll] = useState('')
  const [full, setFull] = useState('')

  const refresh = async () => setClasses(await listClasses())
  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (sel) listStudents(sel.id).then(setStudents)
  }, [sel])

  const addCls = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try { await createClass(name.trim()); setName(''); refresh() }
    catch (err) { alert(err.message) }
  }

  const addStu = async (e) => {
    e.preventDefault()
    if (!roll || !full) return
    try {
      await addStudent({ class_id: sel.id, roll_no: roll, full_name: full })
      setRoll(''); setFull('')
      setStudents(await listStudents(sel.id))
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="grid2">
      <div className="card">
        <h2>Classes</h2>
        <p className="muted small">Create and manage your classes here.</p>
        
        <form onSubmit={addCls} className="row">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Class name (e.g. AI Workshop A)" style={{ flex: 1 }} />
          <button>Add Class</button>
        </form>
        
        <ul className="list">
          {classes.map(c => (
            <li key={c.id} className={sel?.id === c.id ? 'selected' : ''} onClick={() => setSel(c)}>
              <b>{c.name}</b> <span className="muted" style={{ float: 'right' }}>ID: #{c.id}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Students {sel ? `— ${sel.name}` : ''}</h2>
        {!sel && <p className="muted">Select a class on the left to view students.</p>}
        
        {sel && (
          <>
            <form onSubmit={addStu} className="row">
              <input value={roll} onChange={e => setRoll(e.target.value)} placeholder="Roll No" style={{ width: '100px' }} />
              <input value={full} onChange={e => setFull(e.target.value)} placeholder="Full Name" style={{ flex: 1 }} />
              <button>Add Student</button>
            </form>
            <table>
              <thead><tr><th>Roll</th><th>Name</th></tr></thead>
              <tbody>
                {students.map(s => <tr key={s.id}><td>{s.roll_no}</td><td>{s.full_name}</td></tr>)}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}