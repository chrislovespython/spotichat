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
  const [extractedTimestamps, setExtractedTimestamps] = useState<Array<{ timestamp: string; milliseconds: number }>>([])

  interface ExtractedData {
    originalComment: string;
    timestamps: Array<{
      timestamp: string;
      milliseconds: number;
    }>;
  }

  const extractTimestampsFromComment = (comment: string): ExtractedData => {
    const timestampRegex = /\b(\d{1,2}):([0-5]\d)\b/g;
    const timestamps: Array<{ timestamp: string; milliseconds: number }> = [];
    let match;

    while ((match = timestampRegex.exec(comment)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = (minutes * 60 + seconds) * 1000;

      timestamps.push({
        timestamp: match[0],
        milliseconds
      });
    }

    return {
      originalComment: comment,
      timestamps
    };
  };

  const handleCommentChange = (value: string) => {
    setNewComment(value)
    const { timestamps } = extractTimestampsFromComment(value)
    setExtractedTimestamps(timestamps)
  }

  const user = JSON.parse(localStorage.getItem("spotify_user") || "{}")

  const handlePost = async () => {
    if (!songId || !newComment.trim() || !user.id) return
    
    const { originalComment, timestamps } = extractTimestampsFromComment(newComment)
    
    // Use the first timestamp found, or 0 if none
    const primaryTimestamp = timestamps.length > 0 ? timestamps[0].milliseconds : 0
    
    console.log('Posting comment:', originalComment)
    console.log('Timestamps found:', timestamps)
    console.log('Primary timestamp:', primaryTimestamp)
    
    await addComment(songId, user.id, originalComment, primaryTimestamp)
    setNewComment("")
    setExtractedTimestamps([])
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Comments</h1>

      {/* Input */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex gap-2">
          <Textarea
            placeholder="Write a comment... (e.g., 'I love this part at 1:24')"
            value={newComment}
            onChange={(e) => handleCommentChange(e.target.value)}
          />
          <Button onClick={handlePost} disabled={!newComment.trim()}>
            Post
          </Button>
        </div>
        
        {/* Show extracted timestamps */}
        {extractedTimestamps.length > 0 && (
          <div className="text-sm text-neutral-600 bg-neutral-50 p-2 rounded">
            <span className="font-medium">Timestamps found: </span>
            {extractedTimestamps.map((ts, index) => (
              <span key={index} className="inline-block mr-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {ts.timestamp} ({(ts.milliseconds / 1000).toFixed(1)}s)
                </span>
              </span>
            ))}
          </div>
        )}
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