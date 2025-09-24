import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import type {SongItem, SpotifyUser } from "../types/types"

// Types for WebSocket
interface WebSocketMessage {
  action: string;
  data?: SongItem;
  success?: boolean;
  error?: string;
  interval?: number;
  timestamp?: number;
}

// WebSocket client class (include this in your project)
class SongWebSocketClient {
  userId: string;
  token: string;
  baseUrl: string;
  ws: WebSocket | null;
  isConnected: boolean;
  messageHandlers: Map<string, (message: WebSocketMessage) => void>;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  pollingActive: boolean;

  constructor(userId: string, token: string, baseUrl = 'ws://localhost:8000') {
    this.userId = userId;
    this.token = token;
    this.baseUrl = baseUrl;
    this.ws = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.pollingActive = false;
  }

  connect(): void {
    try {
      const wsUrl = `${this.baseUrl}/ws/songs/${this.userId}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🎵 Connected to songs WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.onConnect();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 Received:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.pollingActive = false;
        this.onDisconnect();
        
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error: Event) => {
        console.error('❌ WebSocket error:', error);
        this.onError();
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
    this.pollingActive = false;
  }

  attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);

      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }
  }

  send(message: object): boolean {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  handleMessage(message: WebSocketMessage): void {
    const action = message.action;
    
    if (this.messageHandlers.has(action)) {
      const handler = this.messageHandlers.get(action);
      if (handler) {
        handler(message);
      }
    }

    this.onMessage();
  }

  on(action: string, handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set(action, handler);
  }

  off(action: string): void {
    this.messageHandlers.delete(action);
  }

  getCurrentSong(): boolean {
    return this.send({
      action: 'get_current_song'
    });
  }

  startPolling(interval: number = 5): boolean {
    this.pollingActive = true;
    return this.send({
      action: 'start_current_song_polling',
      interval: interval
    });
  }

  stopPolling(): boolean {
    this.pollingActive = false;
    return this.send({
      action: 'stop_current_song_polling'
    });
  }

  onConnect(): void {}
  onDisconnect(): void {}
  onError(): void {}
  onMessage(): void {}
}

export default function Listening() {
  const navigate = useNavigate()
  const token = localStorage.getItem("spotify_token")
  const localUser = localStorage.getItem("spotify_user")
  const userId = localUser ? JSON.parse(localUser).id : null

  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [song, setSong] = useState<SongItem | { message: string } | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [wsClient, setWsClient] = useState<SongWebSocketClient | null>(null)
  const songItem = song as SongItem;

  async function refreshToken(ref: string): Promise<string | undefined> {
    try {
      const res = await fetch("http://localhost:8000/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: ref }),
      })
      const data = await res.json()
      localStorage.setItem("spotify_token", data.access_token)
      localStorage.setItem("refresh_token", data.refresh_token)
      localStorage.setItem("token_expires", data.expires_at)
      return data.access_token
    } catch(err) {
      console.log(err)
    }
  }

  // Handle token refresh for WebSocket
  const getValidToken = async (): Promise<string | null> => {
    const expireTime = Number(localStorage.getItem("token_expires"))
    const refresh_token = localStorage.getItem("refresh_token") as string

    if (Date.now() >= expireTime) {
      console.log("token expired, refreshing...")
      const newToken = await refreshToken(refresh_token)
      return newToken as string
    }
    return token
  }

  // Setup WebSocket connection
  useEffect(() => {
    if (!token || !userId) return

    const setupWebSocket = async () => {
      const validToken = await getValidToken()
      if (!validToken) return

      const ws = new SongWebSocketClient(userId, validToken)
      setWsClient(ws)

      // Setup event handlers
      ws.onConnect = () => {
        console.log('🎵 WebSocket connected!')
        setConnectionStatus('connected')
        // Start polling for current song every 3 seconds
        ws.startPolling(3)
      }

      ws.onDisconnect = () => {
        console.log('🔌 WebSocket disconnected')
        setConnectionStatus('disconnected')
      }


      // Handle current song updates
      ws.on('current_song_update', (message: WebSocketMessage) => {
        console.log('🎵 Song update received:', message.data)
        if (message.data) {
          // Transform WebSocket data to match your component's expected format
          const transformedSong: SongItem = {
            id: message.data.id,
            name: message.data.name,
            artist: message.data.artist,
            images: message.data.images,
            is_playing: message.data.is_playing,
            duration_ms: message.data.duration_ms,
            progress_ms: message.data.progress_ms
          }
          setSong(transformedSong)
        } else {
          // No song playing
          setSong({ message: "Not listening" })
        }
      })

      ws.on('current_song_response', (message: WebSocketMessage) => {
        console.log('🎵 Current song response:', message.data)
        if (message.data) {
          const transformedSong: SongItem = {
            id: message.data.id,
            name: message.data.name,
            artist: message.data.artist,
            images: message.data.images,
            is_playing: message.data.is_playing,
            duration_ms: message.data.duration_ms,
            progress_ms: message.data.progress_ms
          }
          setSong(transformedSong)
        } else {
          setSong({ message: "Not listening" })
        }
      })

      ws.on('polling_started', (message: WebSocketMessage) => {
        console.log('📡 Polling started with interval:', message.interval)
      })

      setConnectionStatus('connecting')
      ws.connect()
    }

    setupWebSocket()

    // Cleanup on unmount
    return () => {
      if (wsClient) {
        wsClient.disconnect()
      }
    }
  }, [token, userId])

  // Get user info (keep this as REST API call)
  useEffect(() => {
    if (!token || !localUser) return

    const fetchUser = async () => {
      const validToken = await getValidToken()
      if (!validToken) return

      try {
        const res = await fetch("http://localhost:8000/me", {
          headers: { Authorization: `Bearer ${validToken}` }
        })
        const data = await res.json()
        setUser(data)
      } catch (err) {
        console.error('Error fetching user:', err)
      }
    }

    fetchUser()
  }, [token, localUser])

  // Get initial current song
  useEffect(() => {
    if (wsClient && connectionStatus === 'connected') {
      // Get current song immediately when connected
      wsClient.getCurrentSong()
    }
  }, [wsClient, connectionStatus])

  if (!user) return <p className="text-center mt-20">Loading user...</p>
  if (song === null) return (
    <div className="text-center mt-20">
      <p>Connecting to music stream...</p>
      <p className="text-sm text-neutral-500 mt-2">
        Status: {connectionStatus}
      </p>
    </div>
  )
  if (song && 'message' in song && song.message === "Not listening") return (
    <div className="text-center mt-20">
      <p>You're not listening to music.</p>
      <p className="text-sm text-neutral-500 mt-2">
        Connection: {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
      </p>
    </div>
  )

  const logout = () => {
    if (wsClient) {
      wsClient.disconnect()
    }
    localStorage.removeItem("spotify_token")
    localStorage.removeItem("spotify_user")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("token_expires")
    navigate("/")
  }

  const handleRefreshSong = () => {
    if (wsClient && connectionStatus === 'connected') {
      wsClient.getCurrentSong()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-neutral-950 text-neutral-100">
      
      {/* User info + logout */}
      <div className="flex items-center gap-3 mb-4">
        {user.avatar_url && <Avatar><AvatarImage src={user.avatar_url} /></Avatar>}
        <span className="font-semibold">{user.display_name}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            connectionStatus === 'connected' ? 'bg-green-600' : 
            connectionStatus === 'connecting' ? 'bg-yellow-600' : 
            'bg-red-600'
          }`}>
            {connectionStatus === 'connected' ? '🟢 Live' : 
             connectionStatus === 'connecting' ? '🟡 Connecting' : 
             '🔴 Offline'}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefreshSong}>
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={logout}>Logout</Button>
        </div>
      </div>

      {/* Current song */}
      <Card className="w-96 bg-neutral-900 border-neutral-700 shadow-md">
        <CardContent className="flex flex-col items-center p-4 gap-3">
          {songItem?.images?.[0]?.url && (
            <img
              src={songItem.images[0].url}
              alt={songItem.name}
              className="w-48 h-48 object-cover rounded-lg shadow-lg"
            />
          )}
          <h2 className="text-xl font-bold text-center">{songItem?.name}</h2>
          <p className="text-neutral-400 text-center">
            {songItem?.artist}
          </p>
          <p className="text-sm text-neutral-500">
            {songItem?.is_playing ? "🎵 Playing now" : "⏸️ Paused"}
          </p>
          
          {/* Progress bar (optional) */}
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex gap-4">
        <Button 
          onClick={() => navigate(`/song/${songItem?.id}`)}
          disabled={!songItem?.id}
        >
          Go to Comments
        </Button>
      </div>
    </div>
  )
}