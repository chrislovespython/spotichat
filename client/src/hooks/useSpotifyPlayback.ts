import { useEffect, useState } from "react"

export function useSpotifyPlayback(token: string) {
  const [position, setPosition] = useState<number>(0) // seconds

  useEffect(() => {
    if (!token) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        setPosition(Math.floor((data.progress_ms ?? 0) / 1000))
      } catch (err) {
        console.error("Spotify playback fetch error:", err)
      }
    }, 1000) // every second

    return () => clearInterval(interval)
  }, [token])

  return position
}
