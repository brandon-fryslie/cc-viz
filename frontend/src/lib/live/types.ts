export type LiveClientMessage =
  | { op: 'subscribe'; topics: string[] }
  | { op: 'unsubscribe'; topics: string[] }
  | { op: 'ping'; ts: string }

export type LiveServerMessage = {
  op: 'ready' | 'event' | 'heartbeat' | 'error'
  server_time?: string
  topics?: string[]
  topic?: string
  event?: 'upsert' | 'delete' | 'replace' | string
  seq?: number
  ts?: string
  data?: unknown
  code?: string
  message?: string
}

export interface LiveContextValue {
  connected: boolean
  lastHeartbeat: string | null
  subscribe: (topic: string) => void
  unsubscribe: (topic: string) => void
}
