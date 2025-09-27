import { useParams, useNavigate } from "react-router"
import { useState, useEffect } from "react"
import { useRoomComments } from "../hooks/useComments"
import { addComment, addListener, removeListener } from "../lib/commentService"
import { CommentCard } from "../components/CommentCard"
import { ArrowLeft, Music } from "lucide-react"

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
  const [, setExtractedTimestamps] = useState<Array<{ timestamp: string; milliseconds: number }>>([])

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

  if (!songId) {
    return <div className="max-w-2xl mx-auto py-10">Song ID not found</div>
  }

  

  return (
    <main className="h-screen w-screen p-3 overflow-hidden flex flex-col md:items-center">
      {/* Back Button */}
      <div className="mb-6 w-full">
        <button 
          onClick={handleBack}
          className="btn btn-ghost flex items-center w-16"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Song Information Section */}
      {songLoading ? (
        <div className="mb-8 p-6 flex items-center justify-center md:w-96">
          <span className="loading loading-spinner loading-xl"></span>
        </div>
      ) : songError ? (
        <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-lg md:w-96">
          <div className="flex items-center gap-2 text-red-700">
            <Music size={20} />
            <span className="font-medium">Error loading song</span>
          </div>
          <p className="text-red-600 mt-1">{songError}</p>
        </div>
      ) : songData ? (
        <div className="mb-8 p-6 card bg-base-200/70 mx-4 rounded-xl border border-base-300/50 h-36 md:w-[30rem]">
          <div className="flex gap-2">
            {/* Album Art */}
            <div className="flex-shrink-0">
              {songData.images.length > 0 ? (
                <img 
                  src={songData.images[0].url} 
                  alt={`${songData.name} cover`}
                  className="w-24 h-24 rounded-md shadow-md mr-2"
                />
              ) : (
                <div className="w-24 h-24 bg-neutral-200 rounded-md flex items-center justify-center">
                  <Music size={32} className="text-neutral-400" />
                </div>
              )}
            </div>

            {/* Song Details */}
            <div className="flex flex-col justify-between mt-1">
              <div className="gap-1 flex flex-col">
                <h2 className="text-xl font-semibold">{songData.name}</h2>
                <p className="text-neutral-600 italic">
                  {songData.artists.join(", ")}
                </p>
                <p className="text-sm text-neutral-500">{songData.album.name}</p>
              </div>

            </div>
          </div>
        </div>
      ) : null}

      {/* Listeners Count */}
      <div className="mb-6 text-sm text-neutral-600 italic flex items-center gap-2 justify-center">
        <div className="inline-grid *:[grid-area:1/1]">
          <div className="status status-info animate-ping"></div>
            <div className="status status-info"></div>
        </div>
        {listeners - 1> 0 ? `${listeners - 1} people are listening the same song as you.` : "Nobody is listening the same song as you (for the moment)."}
      </div>

      {/* Comment Box */}
      <div className="mb-6 flex flex-col md:items-center">
        <input
          value={newComment}
          onChange={(e) => handleCommentChange(e.target.value)}
          placeholder={`Say something fun or memorable about ${songData ? songData?.name : ""}...`}
          className="w-full input flex flex-col md:w-[32rem]"
        />
        <button
          onClick={handlePost}
          className="mt-3 btn btn-primary md:w-96"
          disabled={!newComment.trim()}
        >
          Post Comment
        </button>
      </div>

      {/* Comments Section with Hidden Scrollbars */}
      <div 
        className={
          comments.length === 0 
            ? "space-y-4 h-64 flex flex-col items-center justify-center" 
            : " flex flex-col items-center scrollbar-thin overflow-y-auto scrollbar-thumb-transparent h-80 scrollbar-track-transparent gap-3"
        }
      >
        {commentsLoading ? (
          <h1 className="text-base-content/30 font-semibold text-2xl">Loading Comments...</h1>
        ) : comments.length === 0 ? (
          <h1 className="text-base-content/30 font-semibold text-2xl">No comments yet. Be the first!</h1>
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
    </main>
  )
}