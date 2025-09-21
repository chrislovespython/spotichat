import { Link } from "react-router"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link to="/" className="text-xl font-bold">🎵 SongSpace</Link>
      <div className="space-x-2">
        <Link to="/listening">
          <Button variant="outline">My Listening</Button>
        </Link>
      </div>
    </nav>
  )
}
