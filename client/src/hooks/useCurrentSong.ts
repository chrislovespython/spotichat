import { useEffect, useState } from "react"
import { type CurrentSong } from "@/types/types"

export function useCurrentSong(token: string | null) {
  const [song, setSong] = useState<CurrentSong>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError("Missing Spotify token")
      setLoading(false)
      return
    }

    const fetchSong = async () => {
      try {
        const res = await fetch(`http://localhost:8000/spotify/current?token=${token}`)
        if (!res.ok) throw new Error("Failed to fetch current song")
        const data = await res.json()

        if (data.track === null || data.message === "No track currently playing") {
          setSong(null)
        } else {
          setSong(data)
        }
      } catch (err) {
        console.log(err)
      } finally {
        setLoading(false)
      }
    }

    fetchSong()
    const interval = setInterval(fetchSong, 3000) // refresh every 5s
    return () => clearInterval(interval)
  }, [token])

  return { song, loading, error }
}
