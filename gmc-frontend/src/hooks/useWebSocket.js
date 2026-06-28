import { useEffect, useRef, useCallback, useState } from 'react'
import useAuthStore from '../store/authStore'

const BASE_DELAY    = 1000   // 1s initial retry
const MAX_DELAY     = 30000  // 30s cap
const MAX_RETRY     = 10     // give up after 10 attempts (~4.5 min total)
const PING_INTERVAL = 25000  // send ping every 25s
const PONG_TIMEOUT  = 10000  // close if no pong within 10s

export function useWebSocket(conversationId, onMessage) {
  const wsRef        = useRef(null)
  const retryCount   = useRef(0)
  const retryTimer   = useRef(null)
  const pingTimer    = useRef(null)
  const pongTimer    = useRef(null)
  const manualClose  = useRef(false)
  const connectRef   = useRef(null)       // always points to latest connect fn
  const accessToken  = useAuthStore((s) => s.accessToken)
  const onMessageRef = useRef(onMessage)

  // Keep callback ref fresh without re-triggering the effect
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const [wsStatus, setWsStatus] = useState('disconnected')

  const clearHeartbeat = () => {
    clearInterval(pingTimer.current)
    clearTimeout(pongTimer.current)
    pingTimer.current = null
    pongTimer.current = null
  }

  const connect = useCallback(() => {
    if (!conversationId || !accessToken) return
    // Already open or connecting
    const ws = wsRef.current
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    setWsStatus('connecting')

    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const url  = conversationId === 'admin'
      ? `${base}/ws/admin/?token=${accessToken}`
      : `${base}/ws/chat/${conversationId}/?token=${accessToken}`

    const socket = new WebSocket(url)
    wsRef.current = socket

    socket.onopen = () => {
      retryCount.current = 0
      setWsStatus('connected')

      // Heartbeat: ping every 25s, close if no pong within 10s
      pingTimer.current = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return
        try { socket.send(JSON.stringify({ type: 'ping' })) } catch {}
        pongTimer.current = setTimeout(() => {
          socket.close(4000, 'pong timeout')
        }, PONG_TIMEOUT)
      }, PING_INTERVAL)
    }

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        // Intercept pong — clear the timeout, don't forward to handler
        if (data.type === 'pong') {
          clearTimeout(pongTimer.current)
          pongTimer.current = null
          return
        }
        onMessageRef.current(data)
      } catch {}
    }

    socket.onerror = () => {
      // onerror is always followed by onclose — let onclose handle retry
    }

    socket.onclose = (event) => {
      clearHeartbeat()

      if (manualClose.current) {
        setWsStatus('disconnected')
        return
      }
      if (retryCount.current >= MAX_RETRY) {
        setWsStatus('disconnected')
        return
      }

      setWsStatus('connecting')
      const delay = Math.min(BASE_DELAY * 2 ** retryCount.current, MAX_DELAY)
      retryCount.current += 1
      // Use connectRef so we always call the latest version
      retryTimer.current = setTimeout(() => connectRef.current?.(), delay)
    }
  }, [conversationId, accessToken])

  // Keep connectRef pointing to latest connect
  useEffect(() => { connectRef.current = connect }, [connect])

  useEffect(() => {
    manualClose.current = false
    retryCount.current  = 0
    connect()

    return () => {
      manualClose.current = true
      clearHeartbeat()
      clearTimeout(retryTimer.current)
      if (wsRef.current) {
        wsRef.current.close(1000, 'component unmount')
        wsRef.current = null
      }
      setWsStatus('disconnected')
    }
  }, [connect])

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(data))
        return true
      } catch { return false }
    }
    return false
  }, [])

  return { sendMessage, wsStatus }
}
