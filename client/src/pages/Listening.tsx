import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import type { SongItem, SpotifyUser } from "../types/types"

export default function Listening() {
  const navigate = useNavigate()
  const token = localStorage.getItem("spotify_token")
  const localUser = localStorage.getItem("spotify_user")

  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [song, setSong] = useState<SongItem | null>(null)

  // Fetch current song every 5s
  useEffect(() => {
    if (!token) return
    const fetchSong = async () => {
      const res = await fetch("http://localhost:8000/current-song", {
      headers: { Authorization: `Bearer ${token}` }
    })
      const data = await res.json()
      console.log(data)
      setSong(data)
    }

    if (localUser) {
      fetch("http://localhost:8000/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => console.error(err))
    }
    fetchSong()
    const interval = setInterval(fetchSong, 5000)
    return () => clearInterval(interval)
  }, [token, localUser])

  if (!user || !song) return <p className="text-center mt-20">Loading...</p>
  if (song.message === "Not listening") return <p className="text-center mt-20">You’re not listening to music.</p>

  const logout = () => {
    localStorage.removeItem("spotify_token")
    localStorage.removeItem("spotify_user")
    navigate("/")
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 bg-neutral-950 text-neutral-100">
      
      {/* User info + logout */}
      <div className="flex items-center gap-3 mb-4">
        {user.avatar_url && <Avatar><AvatarImage src={user.avatar_url} /></Avatar>}
        <span className="font-semibold">{user.display_name}</span>
        <Button variant="destructive" size="sm" onClick={logout}>Logout</Button>
      </div>

      {/* Current song */}
      <Card className="w-96 bg-neutral-900 border-neutral-700 shadow-md">
        <CardContent className="flex flex-col items-center p-4 gap-3">
          {song.images?.[0]?.url && (
            <img
              src={song.images[0].url}
              alt={song.name}
              className="w-48 h-48 object-cover rounded-lg shadow-lg"
            />
          )}
          <h2 className="text-xl font-bold text-center">{song.name}</h2>
        <p className="text-neutral-400 text-center">
            {song.artist}
          </p>
          <p className="text-sm text-neutral-500">
            {song.is_playing ? "Playing now" : "Paused"}
          </p>
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => navigate(`/song/${song.id}`)}>Go to Comments</Button>
        <Button variant="outline" onClick={() => setSong(null)}>Refresh</Button>
      </div>
    </div>
  )
}
