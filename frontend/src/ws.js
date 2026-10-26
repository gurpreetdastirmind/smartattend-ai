const WS = 'wss://smartattend-backend-azmm.onrender.com'

export function openLaptopWs(room, onBinary) {
  const ws = new WebSocket(`${WS}/ws/laptop/${room}`)
  ws.binaryType = 'blob'
  ws.onmessage = (ev) => {
    if (ev.data instanceof Blob) onBinary(ev.data)
    else console.log('msg', ev.data)
  }
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send('ping')
  }, 15000)
  ws.onclose = () => clearInterval(ping)
  return ws
}