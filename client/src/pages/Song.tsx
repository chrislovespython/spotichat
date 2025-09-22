import { useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { useRoomComments } from "@/hooks/useComments"
import { addComment } from "@/lib/commentService"
import { CommentCard } from "@/components/CommentCard"

export default function Song() {
  const { id: songId } = useParams()
  const { comments, loading } = useRoomComments(songId)
  const [newComment, setNewComment] = useState("")

  const user = JSON.parse(localStorage.getItem("spotify_user") || "{}")

  const handlePost = async () => {
    if (!songId || !newComment.trim() || !user.id) return
    await addComment(songId, user.id, newComment.trim())
    setNewComment("")
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Comments</h1>

      {/* Input */}
      <div className="flex gap-2 mb-6">
        <Textarea
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <Button onClick={handlePost} disabled={!newComment.trim()}>
          Post
        </Button>
      </div>

      {/* Comments */}
      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-neutral-400">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((c) => (
            <CommentCard
              key={c?.id}
              comment={c}
              currentUserId={user.id}
              songId={songId!}
            />
          ))}
        </div>
      )}
    </div>
  )
}
