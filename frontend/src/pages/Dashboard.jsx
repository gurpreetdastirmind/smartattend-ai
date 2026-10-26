import { useEffect, useState } from 'react'
import { listClasses } from '../api'

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  useEffect(() => { listClasses().then(setClasses).catch(e => alert(e.message)) }, [])
  return (
    <div className="card">
      <h1>Welcome</h1>
      <p>Use <b>Classes</b> to add a class, <b>Enroll</b> to register faces, then <b>Take Attendance</b>.</p>
      <h3>Your classes ({classes.length})</h3>
      <ul>{classes.map(c => <li key={c.id}>{c.name} <span className="muted">#{c.id}</span></li>)}</ul>
    </div>
  )
}