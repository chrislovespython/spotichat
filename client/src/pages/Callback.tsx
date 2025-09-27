import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"

export default function Callback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
  const code = params.get("code")
  console.log(code)
  if (!code) return

  fetch("http://localhost:8000/auth/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  })
    .then(res => res.json())
    .then(data => {
      console.log(data)
      localStorage.setItem("spotify_token", data.access_token)
      localStorage.setItem("token_expires", data.expires_at)
      localStorage.setItem("refresh_token", data.refresh_token)
      fetch("http://localhost:8000/me", {
      headers: { Authorization: `Bearer ${data.access_token}` }
    })
      .then(res => res.json())
      .then(data => {
        localStorage.setItem("spotify_user", JSON.stringify(data))
        console.log(data)
      })
      .catch(err => console.error(err))
      navigate("/listening")
    })
    .catch(err => console.error("Auth failed", err))
}, [params, navigate])


  return (
    <main className="flex items-center justify-center h-screen">
      <h1 className="text-lg font-semibold">Authenticating with Spotify…</h1>
    </main>
  )
}
