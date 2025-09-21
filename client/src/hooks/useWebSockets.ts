import { useEffect, useRef, useState } from "react"
import { createMessage } from "./createMessage"
import type { SongMessage } from "@/types/message"

export function useWebSocket(songId: string, username: string, playbackTime?: number) {
  const [messages, setMessages] = useState<SongMessage[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    wsRef.current = new WebSocket(`ws://localhost:8000/ws/${songId}`)

    wsRef.current.onmessage = (event) => {
      const data: SongMessage = JSON.parse(event.data)
      setMessages(prev => [...prev, data])
    }

    return () => {
      wsRef.current?.close()
    }
  }, [songId])

  const sendMessage = (comment: string) => {
    if (!comment) return
    const msg = createMessage(username, comment, playbackTime)
    wsRef.current?.send(JSON.stringify(msg))
    setMessages(prev => [...prev, msg])
  }

  return { messages, sendMessage }
}
