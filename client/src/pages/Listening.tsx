import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import type {SongItem, SpotifyUser } from "../types/types"
import { HeadphoneOff } from "lucide-react"

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

  constructor(userId: string, token: string, baseUrl = 'ws://spotichat-backend-new.vercel.app/') {
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
    const res = await fetch("https://spotichat-backend-new.vercel.app/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: ref }),
    })
    const data = await res.json()
    console.log(data)
    
    // Calculate the expiration timestamp
    const expiresAt = Date.now() + (data.expires_in * 1000)
    
    localStorage.setItem("spotify_token", data.access_token)
    // Only update refresh_token if a new one is provided
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token)
    }
    localStorage.setItem("token_expires", expiresAt.toString())
    
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
        ws.startPolling(30)
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
        const res = await fetch("https://spotichat-backend-new.vercel.app/me", {
          headers: { Authorization: `Bearer ${validToken}` }
        })
        const data = await res.json()
        setUser(data)
        console.log(data)
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

  if (!user) return (
    <main className="h-screen flex flex-col items-center justify-center">
      <span className="loading loading-spinner loading-xl"></span>
    </main>
  )
  if (song === null) return (
    <main className="h-screen flex flex-col items-center justify-center">
      <span className="loading loading-spinner loading-xl"></span>
      <h1 className="text-base-content font-semibold italic text-xl">Connecting To The Music Server...</h1>
    </main>
  )
  if (song && 'message' in song && song.message === "Not listening") return (
    <main className="h-screen flex flex-col items-center justify-center">
      <HeadphoneOff size={64} className="text-base-300"/>
      <h1 className="text-base-content text-xl font-medium text-center w-[28rem] my-4">You are not listening to music. Try opening Spotify and play a song.</h1>
      <button className="btn btn-error" onClick={logout}>Logout</button>

    </main>
  )



  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 text-neutral-100">
      
      {/* User info + logout */}
      <div className="flex items-center gap-3 text-lg">
        {user.images[0].url && (
          <div className="avatar">
            <div className="w-8 rounded-full">
              <img src={user.images[0].url} />
            </div>
          </div>
        )}
        <span className="font-semibold text-base-content">{user.display_name}</span>
      </div>

      {/* Current song */}
      <div className="w-80 card bg-base-200/50 border border-base-200">
        <div className="flex flex-col items-center p-4 gap-2">
          {songItem?.images?.[0]?.url && (
            <img
              src={songItem.images[0].url}
              alt={songItem.name}
              className="w-48 h-48 object-cover rounded-lg border-2 border-base-300/50"
            />
          )}
          <h2 className="text-xl font-bold text-center text-base-content">{songItem?.name}</h2>
          <h4 className="text-base-content italic text-center">
            {songItem?.artist}
          </h4>
          <h5 className="text-sm text-info font-semibold">
            {songItem?.is_playing ? "Playing now" : "Paused"}
          </h5>
          
          {/* Progress bar (optional) */}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <button className="btn btn-neutral"
          onClick={() => navigate(`/song/${songItem?.id}`)}
          disabled={!songItem?.id}
        >
          Go to Comments
        </button>
      <button className="btn btn-error" onClick={logout}>Logout</button>
      </div>
    </main>
  )
}