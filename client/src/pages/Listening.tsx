import { Card } from "@/components/ui/card"
import { Link } from "react-router"

export default function Listening() {
  // TODO: fetch currently playing track from Spotify API
  const currentTrack = {
    id: "12345",
    title: "Song Title",
    artist: "Artist Name",
    image: "/album-art.jpg"
  }

  return (
    <div className="flex flex-col items-center p-6 space-y-4">
      <h2 className="text-2xl font-bold">You’re listening to</h2>
      <Card className="p-4 flex items-center gap-4 max-w-md">
        <img src={currentTrack.image} alt="Album art" className="w-16 h-16 rounded-lg" />
        <div className="flex flex-col">
          <span className="font-semibold">{currentTrack.title}</span>
          <span className="text-sm text-muted-foreground">{currentTrack.artist}</span>
        </div>
      </Card>
      <Link to={`/song/${currentTrack.id}`} className="text-blue-600 underline">
        Go to Song Room →
      </Link>
    </div>
  )
}
