import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from "firebase/firestore"
import { db } from "@/lib/firebase" // Assuming you have firebase config
import type { Comment } from "@/types/types"

export default function Song() {
  const { id } = useParams()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Get user from localStorage (consider using React Context for better state management)
  const user = JSON.parse(localStorage.getItem("spotify_user") || "{}")

  const postComment = async () => {
    if (!newComment.trim() || !id) return
    
    setLoading(true)
    try {
      await addDoc(collection(db, "comments"), {
        user: user.display_name || "Anonymous",
        avatar_url: user.avatar_url || null,
        comment: newComment.trim(),
        song_id: id,
        timestamp: serverTimestamp(),
        // Optional: add time field if you want to track playback position
        // time: currentPlaybackTime
      })
      setNewComment("")
    } catch (error) {
      console.error("Error posting comment:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return

    // Create query to get comments for this song, ordered by timestamp
    const q = query(
      collection(db, "comments"),
      where("song_id", "==", id),
      orderBy("timestamp", "desc")
    )

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const commentsData: Comment[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        commentsData.push({
          id: doc.id,
          user: data.user,
          avatar_url: data.avatar_url,
          comment: data.comment,
          song_id: data.song_id,
          time: data.time,
          timestamp: data.timestamp instanceof Timestamp 
            ? data.timestamp.toDate().toISOString()
            : data.timestamp
        })
      })
      setComments(commentsData)
    }, (error) => {
      console.error("Error fetching comments:", error)
    })

    // Cleanup listener on unmount
    return () => unsubscribe()
  }, [id])

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return ""
    try {
      return new Date(timestamp).toLocaleString()
    } catch {
      return ""
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Comments</h1>

      {/* Comment input */}
      <div className="flex gap-2 mb-6">
        <Textarea
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={loading}
        />
        <Button onClick={postComment} disabled={loading || !newComment.trim()}>
          {loading ? "Posting..." : "Post"}
        </Button>
      </div>

      {/* Comments list */}
      <div className="flex flex-col gap-4">
        {comments.length === 0 && (
          <p className="text-neutral-400">No comments yet. Be the first to comment!</p>
        )}
        {comments.map((c) => (
          <Card key={c?.id || Math.random()}>
            <CardContent className="p-4 flex gap-3 items-start">
              <Avatar>
                {c?.avatar_url && <AvatarImage src={c.avatar_url} />}
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{c?.user}</p>
                <p className="mt-1">{c?.comment}</p>
                <div className="flex gap-4 mt-2 text-xs text-neutral-500">
                  {c?.time && <span>at {c.time}s</span>}
                  {c?.timestamp && <span>{formatTimestamp(c.timestamp)}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}