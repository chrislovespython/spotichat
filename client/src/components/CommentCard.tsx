import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Comment } from "@/types/types"
import { toggleLike, removeComment } from "@/lib/commentService"

type SpotifyProfile = {
  id: string
  display_name: string
  avatar_url?: string
}

export function CommentCard({ comment, currentUserId, songId }: {
  comment: Comment
  currentUserId: string
  songId: string
}) {
  const [profile, setProfile] = useState<SpotifyProfile | null>(null)
  const hasLiked = comment?.likedBy.includes(currentUserId)

  const token = localStorage.getItem("spotify_token")

  useEffect(() => {
    let active = true
    async function fetchProfile() {
        console.log(comment?.authorId)
        console.log(token)
      const res = await fetch(`http://localhost:8000/user/${comment?.authorId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      if (!res.ok) return
        const u = await res.json()
        console.log(u)
        if (active) {
          setProfile({
            id: u.id,
            display_name: u.display_name,
            avatar_url: u.images?.[0]?.url
          })
        }
      }
    fetchProfile()
    return () => { active = false }
  }, [comment?.authorId, token])

  const handleToggleLike = async () => {
    await toggleLike(comment?.id as string, currentUserId, hasLiked as boolean)
  }

  const handleRemove = async () => {
    await removeComment(songId, comment?.id as string)
  }

  return (
    <Card>
      <CardContent className="p-4 flex gap-3 items-start">
        <Avatar>
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold">{profile?.display_name || ""}</p>
          <p className="mt-1">{comment?.content}</p>
          <div className="flex gap-4 mt-2 text-xs text-neutral-500 items-center">
            <span>{comment?.likedBy.length} likes</span>
            <Button size="sm" onClick={handleToggleLike}>
              {hasLiked ? "💔 Unlike" : "❤️ Like"}
            </Button>
            {comment?.authorId === currentUserId && (
              <Button size="sm" variant="destructive" onClick={handleRemove}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
