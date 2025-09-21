import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"

export default function Callback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const code = params.get("code")
    if (!code) return

    // Exchange code for tokens (via backend)
    fetch("http://localhost:8000/auth/callback", { // backend endpoint
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    })
      .then(res => res.json())
      .then(data => {
        localStorage.setItem("spotify_token", data.access_token)
        navigate("/listening")
      })
      .catch(err => console.error("Auth failed", err))
  }, [params, navigate])

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Authenticating with Spotify…</p>
    </div>
  )
}
