const BASE = import.meta.env.VITE_API || 'https://smartattend-backend-azmm.onrender.com'

export async function api(path, opts = {}) {
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t)
  }
  return res.headers.get('content-type')?.includes('json')
    ? res.json()
    : res.blob()
}

export const listClasses = () => api('/api/classes')
export const createClass = (name) =>
  api('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }) })
export const listStudents = (id) => api(`/api/classes/${id}/students`)
export const addStudent = (body) =>
  api('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) })
export const enroll = (studentId, files) => {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  return api(`/api/students/${studentId}/enroll`, { method: 'POST', body: fd })
}
export const createSession = (body) =>
  api('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) })
export const processPhoto = (sessionId, file, threshold, margin) => {
  const fd = new FormData()
  fd.append('session_id', sessionId)
  fd.append('file', file)
  fd.append('threshold', threshold)
  fd.append('margin', margin)
  return api('/api/process', { method: 'POST', body: fd })
}
export const saveAttendance = (body) =>
  api('/api/attendance/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) })
export const getAttendance = (sid) => api(`/api/attendance/${sid}`)
export const exportUrl = (sid) => `${BASE}/api/attendance/${sid}/export`
export const createRoom = () => api('/api/room/create', { method: 'POST' })