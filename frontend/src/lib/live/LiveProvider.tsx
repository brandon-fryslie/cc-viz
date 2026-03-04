import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { LiveClientMessage, LiveContextValue, LiveServerMessage } from './types'

const LiveContext = createContext<LiveContextValue | null>(null)

const DEFAULT_TOPICS = ['overview', 'mission_control', 'sessions', 'token_economics', 'extensions_config']

function wsURL(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v3/live/ws`
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const seqRef = useRef<Record<string, number>>({})
  const topicsRef = useRef<Set<string>>(new Set(DEFAULT_TOPICS))

  const send = useCallback((message: LiveClientMessage) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(message))
  }, [])

  const invalidateTopic = useCallback((topic: string) => {
    // [LAW:single-enforcer] Query invalidation is the single reconvergence path on live updates/gaps.
    if (topic === 'overview') {
      queryClient.invalidateQueries({ queryKey: ['v3', 'overview'] })
      return
    }
    if (topic === 'mission_control') {
      queryClient.invalidateQueries({ queryKey: ['v3', 'mission-control'] })
      queryClient.invalidateQueries({ queryKey: ['v3', 'mission-activity'] })
      return
    }
    if (topic === 'sessions') {
      queryClient.invalidateQueries({ queryKey: ['v3', 'sessions'] })
      return
    }
    if (topic.startsWith('session:')) {
      const sessionId = topic.slice('session:'.length)
      queryClient.invalidateQueries({ queryKey: ['v3', 'session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['v3', 'session-messages', sessionId] })
      return
    }
    if (topic === 'token_economics') {
      queryClient.invalidateQueries({ queryKey: ['v3', 'token-summary'] })
      queryClient.invalidateQueries({ queryKey: ['v3', 'token-timeseries'] })
      queryClient.invalidateQueries({ queryKey: ['v3', 'token-projects'] })
      return
    }
    if (topic === 'extensions_config') {
      queryClient.invalidateQueries({ queryKey: ['v3', 'extensions-config'] })
      queryClient.invalidateQueries({ queryKey: ['v3', 'extension-detail'] })
    }
  }, [queryClient])

  useEffect(() => {
    let reconnectTimer: number | undefined

    const connect = () => {
      const ws = new WebSocket(wsURL())
      socketRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setLastHeartbeat(new Date().toISOString())
        send({ op: 'subscribe', topics: Array.from(topicsRef.current) })
      }

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as LiveServerMessage
        if (message.op === 'heartbeat') {
          setLastHeartbeat(message.ts || new Date().toISOString())
          return
        }

        if (message.op === 'event' && message.topic) {
          const seq = message.seq || 0
          const prev = seqRef.current[message.topic] || 0
          const hasGap = prev > 0 && seq !== prev + 1
          seqRef.current[message.topic] = seq
          if (hasGap) {
            invalidateTopic(message.topic)
            return
          }
          invalidateTopic(message.topic)
          return
        }

        if (message.op === 'error') {
          console.warn('[live] error', message.code, message.message)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectTimer = window.setTimeout(connect, 1000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [invalidateTopic, send])

  const subscribe = useCallback((topic: string) => {
    topicsRef.current.add(topic)
    send({ op: 'subscribe', topics: [topic] })
  }, [send])

  const unsubscribe = useCallback((topic: string) => {
    topicsRef.current.delete(topic)
    send({ op: 'unsubscribe', topics: [topic] })
  }, [send])

  const value = useMemo<LiveContextValue>(() => ({
    connected,
    lastHeartbeat,
    subscribe,
    unsubscribe,
  }), [connected, lastHeartbeat, subscribe, unsubscribe])

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

export function useLive(): LiveContextValue {
  const value = useContext(LiveContext)
  if (!value) {
    throw new Error('useLive must be used within LiveProvider')
  }
  return value
}

export function useLiveTopic(topic: string | null | undefined) {
  const { subscribe, unsubscribe } = useLive()

  useEffect(() => {
    if (!topic) return
    subscribe(topic)
    return () => unsubscribe(topic)
  }, [subscribe, topic, unsubscribe])
}
