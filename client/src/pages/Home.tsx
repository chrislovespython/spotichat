import { Button } from "@/components/ui/button"

export default function Home() {
  const login = async () => {
    const res = await fetch("http://localhost:8000/auth/login")
    const data = await res.json()
    window.location.href = data.url
  }

  const logout = () => {
    localStorage.removeItem("spotify_token")
    window.location.href = "/"
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center gap-4">
      <h1 className="text-4xl font-bold">🎶 Spotify Connect</h1>
      <p className="text-neutral-400">See who’s listening to the same song and comment about it!</p>

      {localStorage.getItem("spotify_token") ? (
        <Button variant="destructive" onClick={logout}>Logout</Button>
      ) : (
        <Button onClick={login}>Login with Spotify</Button>
      )}
    </div>
  )
}
