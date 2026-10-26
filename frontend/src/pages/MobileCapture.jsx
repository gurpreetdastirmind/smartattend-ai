import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

const WS = 'wss://smartattend-backend-azmm.onrender.com'

export default function MobileCapture() {
  const { room } = useParams()
  const [facingMode, setFacingMode] = useState('environment') // 'environment' (back) or 'user' (front)
  const [status, setStatus] = useState('Starting camera…')
  const [connected, setConnected] = useState(false)
  const videoRef = useRef(null)
  const wsRef = useRef(null)

  // Open WebSocket
  useEffect(() => {
    const ws = new WebSocket(`${WS}/ws/phone/${room}`)
    ws.onopen = () => { setConnected(true); setStatus('Connected — ready to send') }
    ws.onclose = () => { setConnected(false); setStatus('Disconnected') }
    wsRef.current = ws
    return () => ws.close()
  }, [room])

  // Camera setup (runs when facingMode changes)
  useEffect(() => {
    let currentStream = null

    const startCamera = async () => {
      // Stop any existing video tracks before starting a new one
      if (videoRef.current && videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject
        oldStream.getTracks().forEach(track => track.stop())
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode }, 
          audio: false
        })
        currentStream = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('Camera active')
      } catch (e) {
        setStatus('Camera error: ' + e.message)
      }
    }

    startCamera()

    // Cleanup when component unmounts or facingMode changes
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop())
      }
    }
  }, [facingMode])

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }

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
      wsRef.current.send(blob)          
      wsRef.current.send(`PHOTO_SENT`)  
      setStatus('📤 Photo sent to laptop')
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="mobile">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🎓 Remote Camera</span>
        <button onClick={toggleCamera} style={{ padding: '6px 12px', fontSize: '14px' }}>
          🔄 Flip
        </button>
      </header>
      
      <p className="muted small">Room: <code>{room}</code> — {connected ? '🟢 connected' : '⚪ connecting…'}</p>
      
      <video ref={videoRef} playsInline muted className="cam" />
      
      <button className="big" onClick={send} disabled={!connected}>
        📸 Send Photo to Laptop
      </button>
      
      <p className="status">{status}</p>
    </div>
  )
}