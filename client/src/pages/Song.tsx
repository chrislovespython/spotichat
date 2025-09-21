import { useParams } from "react-router"
import { useWebSocket } from "../hooks/useWebSockets"
import { useSpotifyPlayback } from "../hooks/useSpotifyPlayback"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function Song() {
  const { id } = useParams()
  const username = "Me" // Replace with actual logged-in user
  const token = localStorage.getItem("spotify_token") || ""
  const playbackTime = useSpotifyPlayback(token)
  const { messages, sendMessage } = useWebSocket(id!, username, playbackTime)
  const [text, setText] = useState("")

  const handleSend = () => {
    sendMessage(text)
    setText("")
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="space-y-2 overflow-y-auto max-h-[400px]">
        {messages.map((m) => (
          <div key={m.id} className="p-2 border-b border-muted/20">
            <div className="text-xs text-muted-foreground">{m.createdAt}</div>
            <p>
              <strong>{m.user}:</strong> {m.comment}{" "}
              {m.time !== undefined ? `(${Math.floor(m.time/60)}:${(m.time%60).toString().padStart(2,'0')})` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input 
          placeholder="Type a message…" 
          value={text} 
          onChange={e => setText(e.target.value)} 
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  )
}
