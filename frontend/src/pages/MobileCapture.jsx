import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

const WS = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`

export default function MobileCapture() {
  const { room } = useParams()
  const [stream, setStream] = useState(null)
  const [status, setStatus] = useState('Starting camera…')
  const [connected, setConnected] = useState(false)
  const videoRef = useRef(null)
  const wsRef = useRef(null)

  // Open WS
  useEffect(() => {
    const ws = new WebSocket(`${WS}/ws/phone/${room}`)
    ws.onopen = () => { setConnected(true); setStatus('Connected — ready to send') }
    ws.onclose = () => { setConnected(false); setStatus('Disconnected') }
    wsRef.current = ws
    return () => ws.close()
  }, [room])

  // Camera
  useEffect(() => {
    let s
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false
        })
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          await videoRef.current.play()
        }
      } catch (e) {
        setStatus('Camera error: ' + e.message)
      }
    })()
    return () => s?.getTracks().forEach(t => t.stop())
  }, [])

  const send = async () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) {
      return setStatus('Not connected to laptop')
    }
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      return setStatus('Camera not ready')
    }
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      wsRef.current.send(blob)          // binary jpeg → laptop
      wsRef.current.send(`PHOTO_SENT`)  // optional text marker
      setStatus('📤 Photo sent to laptop')
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="mobile">
      <header>🎓 SmartAttend — Remote Camera</header>
      <p className="muted small">Room: <code>{room}</code> — {connected ? '🟢 connected' : '⚪ connecting…'}</p>
      <video ref={videoRef} playsInline muted className="cam" />
      <button className="big" onClick={send} disabled={!connected}>
        📸 Send Photo to Laptop
      </button>
      <p className="status">{status}</p>
    </div>
  )
}