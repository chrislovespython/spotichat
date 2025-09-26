import { useParams, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { useRoomComments } from "@/hooks/useComments"
import { addComment, addListener, removeListener } from "@/lib/commentService"
import { CommentCard } from "@/components/CommentCard"
import { ArrowLeft, Music, ExternalLink, Clock } from "lucide-react"

// Types
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SongData {
  id: string;
  name: string;
  artist: string;
  artists: string[];
  album: {
    name: string;
    images: SpotifyImage[];
  };
  images: SpotifyImage[];
  duration_ms: number;
  explicit: boolean;
  external_urls: {
    spotify: string;
  };
  preview_url?: string;
  popularity: number;
  is_local: boolean;
  track_number?: number;
  disc_number?: number;
}

export default function Song() {
  const { id: songId } = useParams()
  const navigate = useNavigate()
  const { comments, listeners, loading: commentsLoading } = useRoomComments(songId)
  const [newComment, setNewComment] = useState("")
  const [extractedTimestamps, setExtractedTimestamps] = useState<Array<{ timestamp: string; milliseconds: number }>>([])

  // New state for song data
  const [songData, setSongData] = useState<SongData | null>(null)
  const [songLoading, setSongLoading] = useState(true)
  const [songError, setSongError] = useState<string | null>(null)

  interface ExtractedData {
    originalComment: string;
    timestamps: Array<{
      timestamp: string;
      milliseconds: number;
    }>;
  }

  // Fetch song data from API
  const fetchSongData = async (id: string) => {
    const token = localStorage.getItem("spotify_token")
    if (!token) {
      setSongError("No authentication token found")
      setSongLoading(false)
      return
    }

    try {
      setSongLoading(true)
      setSongError(null)

      const response = await fetch(`http://localhost:8000/song/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Song not found")
        } else if (response.status === 401) {
          throw new Error("Authentication failed")
        } else if (response.status === 400) {
          throw new Error("Invalid song ID")
        } else {
          throw new Error(`Failed to fetch song: ${response.status}`)
        }
      }

      const data: SongData = await response.json()
      setSongData(data)
    } catch (error) {
      console.error('Error fetching song:', error)
      setSongError(error instanceof Error ? error.message : "Failed to fetch song data")
    } finally {
      setSongLoading(false)
    }
  }

  // Format duration from milliseconds to mm:ss
  const formatDuration = (durationMs: number): string => {
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Add listeners when component mounts and remove when unmounts
  useEffect(() => {
    if (!songId) return

    // Fetch song data
    fetchSongData(songId)

    // Add listener when component mounts
    addListener(songId)
    console.log("listener added")

    // Cleanup: remove listener when component unmounts
    return () => {
      removeListener(songId)
      console.log("listener removed")
    }
  }, [songId])

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

  const handleBack = () => {
    navigate(-1) // Go back to previous page
  }

  const handleSeekToTimestamp = async (milliseconds: number) => {
    const token = localStorage.getItem("spotify_token")
    if (!token) {
      console.error("No authentication token")
      return
    }

    try {
      const response = await fetch('http://localhost:8000/seek', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp_ms: milliseconds
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to seek')
      }

      const result = await response.json()
      console.log('Seek successful:', result.message)
    } catch (error) {
      console.error('Error seeking:', error)
      // You could show a toast notification here
    }
  }

  if (!songId) {
    return <div className="max-w-2xl mx-auto py-10">Song ID not found</div>
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      {/* Back Button */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={handleBack}
          className="flex items-center gap-2 hover:bg-neutral-100"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
      </div>

      {/* Song Information Section */}
      {songLoading ? (
        <div className="mb-8 p-6 bg-neutral-50 rounded-lg">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-md bg-neutral-300 h-24 w-24"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-neutral-300 rounded w-3/4"></div>
              <div className="h-4 bg-neutral-300 rounded w-1/2"></div>
              <div className="h-4 bg-neutral-300 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      ) : songError ? (
        <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <Music size={20} />
            <span className="font-medium">Error loading song</span>
          </div>
          <p className="text-red-600 mt-1">{songError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => songId && fetchSongData(songId)}
          >
            Try Again
          </Button>
        </div>
      ) : songData ? (
        <div className="mb-8 p-6 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-lg border">
          <div className="flex gap-4">
            {/* Album Art */}
            <div className="flex-shrink-0">
              {songData.images.length > 0 ? (
                <img 
                  src={songData.images[0].url} 
                  alt={`${songData.name} cover`}
                  className="w-24 h-24 rounded-md shadow-md"
                />
              ) : (
                <div className="w-24 h-24 bg-neutral-200 rounded-md flex items-center justify-center">
                  <Music size={32} className="text-neutral-400" />
                </div>
              )}
            </div>

            {/* Song Details */}
            <div className="flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold">{songData.name}</h2>
                <p className="text-neutral-600">
                  {songData.artists.join(", ")}
                </p>
                <p className="text-sm text-neutral-500">{songData.album.name}</p>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-neutral-500 text-sm">
                  <Clock size={14} />
                  {formatDuration(songData.duration_ms)}
                </div>
                <a
                  href={songData.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-green-600 hover:underline text-sm"
                >
                  <ExternalLink size={14} />
                  Open in Spotify
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Listeners Count */}
      <div className="mb-6 text-sm text-neutral-600">
        {listeners > 0 ? `${listeners} people listening now` : "No active listeners"}
      </div>

      {/* Comment Box */}
      <div className="mb-6">
        <Textarea
          value={newComment}
          onChange={(e) => handleCommentChange(e.target.value)}
          placeholder="Add a comment... (e.g., 'This part at 1:23 is crazy!')"
          className="w-full"
        />
        {extractedTimestamps.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {extractedTimestamps.map((ts, idx) => (
              <Button
                key={idx}
                size="sm"
                variant="outline"
                onClick={() => handleSeekToTimestamp(ts.milliseconds)}
              >
                {ts.timestamp}
              </Button>
            ))}
          </div>
        )}
        <Button
          onClick={handlePost}
          className="mt-3"
          disabled={!newComment.trim()}
        >
          Post Comment
        </Button>
      </div>

      {/* Comments Section */}
      <div className="space-y-4">
        {commentsLoading ? (
          <p className="text-neutral-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-neutral-500">No comments yet. Be the first!</p>
        ) : (
          comments.map((comment) => (
            <CommentCard
              key={comment?.id}
              comment={comment}
              currentUserId={comment?.authorId as string}
              songId={songId}
            />
          ))
        )}
      </div>
    </div>
  )
}
