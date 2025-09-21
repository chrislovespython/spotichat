import { Button } from "@/components/ui/button"
import { getSpotifyLoginUrl } from "@/lib/auth"

export default function Home() {
  const handleLogin = () => {
    window.location.href = getSpotifyLoginUrl()
  }

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center space-y-4">
      <h1 className="text-4xl font-bold">Welcome to SongSpace</h1>
      <p className="text-lg text-muted-foreground max-w-md">
        Connect with people listening to the same song in real time.
      </p>
      <Button size="lg" onClick={handleLogin}>
        Login with Spotify
      </Button>
    </div>
  )
}
