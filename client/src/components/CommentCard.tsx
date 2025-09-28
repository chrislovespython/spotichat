import { useEffect, useState } from "react"
import type { Comment } from "../types/types"
import { toggleLike, removeComment } from "../lib/commentService"

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
  const [loading, setLoading] = useState(true)
  
  // Local state for optimistic updates
  const [localLikedBy, setLocalLikedBy] = useState<string[]>(comment?.likedBy || [])
  const [isUpdatingLike, setIsUpdatingLike] = useState(false)
  
  // Alert states
  const [alert, setAlert] = useState<{
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
  } | null>(null)
  
  const hasLiked = localLikedBy.includes(currentUserId)

  const token = localStorage.getItem("spotify_token")
  const currentUser = JSON.parse(localStorage.getItem("spotify_user") as string)

  // Auto-dismiss alerts after 3 seconds
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [alert])

  // Update local state when comment prop changes
  useEffect(() => {
    setLocalLikedBy(comment?.likedBy || [])
  }, [comment?.likedBy])

  useEffect(() => {
    let active = true
    setLoading(true)
    async function fetchProfile() {
      const res = await fetch(`https://spotichat-backend.onrender.com/user/${comment?.authorId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      if (!res.ok) return
        const u = await res.json()

        if (active) {
          setProfile({
            id: u.id,
            display_name: u.display_name,
            avatar_url: u.images?.[0]?.url
          })
          setLoading(false)
        }
      }
      if (currentUser?.id === currentUserId) {
        setProfile({
          id: currentUser.id,
          display_name: currentUser.display_name,
          avatar_url: currentUser.images?.[0]?.url
        })
          setLoading(false)
      } else {
        fetchProfile()
      }
    return () => { active = false }
  }, [])

  // Seek to timestamp from comment
const seekToTimestamp = async (timestampMs: number) => {
  try {
    const token = localStorage.getItem('spotify_token');
    
    const response = await fetch('https://spotichat-backend.onrender.com/seek', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        timestamp_ms: timestampMs
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      setAlert({
        type: 'success',
        message: `Seeked to ${data.seeked_to_readable}`
      })
    } else {
      setAlert({
        type: 'warning',
        message: 'You need Spotify Premium to seek to timestamps'
      })
      console.error('Seek failed:', data.detail);
    }
  } catch (error) {
    console.error('Error seeking:', error);
    setAlert({
      type: 'error',
      message: 'Failed to seek to timestamp'
    })
  }
};

// In your comment component, when user clicks a timestamp:
const handleTimestampClick = (milliseconds: number) => {
  seekToTimestamp(milliseconds);
};

  const handleToggleLike = async () => {
    if (isUpdatingLike) return // Prevent multiple simultaneous requests
    
    setIsUpdatingLike(true)
    
    // Optimistic update - update UI immediately
    const currentlyLiked = hasLiked
    if (currentlyLiked) {
      // Remove like optimistically
      setLocalLikedBy(prev => prev.filter(id => id !== currentUserId))
    } else {
      // Add like optimistically
      setLocalLikedBy(prev => [...prev, currentUserId])
    }
    
    try {
      // Update server
      await toggleLike(comment?.id as string, currentUserId, currentlyLiked)
      setAlert({
        type: 'success',
        message: currentlyLiked ? 'Comment unliked' : 'Comment liked'
      })
    } catch (error) {
      // Revert optimistic update on error
      console.error('Failed to toggle like:', error)
      if (currentlyLiked) {
        // Restore the like if removal failed
        setLocalLikedBy(prev => [...prev, currentUserId])
      } else {
        // Remove the like if addition failed
        setLocalLikedBy(prev => prev.filter(id => id !== currentUserId))
      }
      setAlert({
        type: 'error',
        message: 'Failed to update like. Please try again.'
      })
    } finally {
      setIsUpdatingLike(false)
    }
  }

  const msToMMSS = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

  const handleRemove = async () => {
    try {
      await removeComment(songId, comment?.id as string)
      setAlert({
        type: 'success',
        message: 'Comment deleted successfully'
      })
    } catch (error) {
      console.error('Failed to remove comment:', error)
      setAlert({
        type: 'error',
        message: 'Failed to delete comment. Please try again.'
      })
    }
  }

  if (loading) return (
    <span className="loading loading-spinner"></span>
  )

  return (
    <div className="card bg-base-200/70 rounded-lg border border-base-300 w-[28rem] max-sm:w-80">
      {/* Alert display */}
      {alert && (
        <div className="p-4 pb-0">
          <div className={`alert alert-${alert.type}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              {alert.type === 'success' && (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
              {alert.type === 'error' && (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
              {alert.type === 'warning' && (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.73 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
              )}
              {alert.type === 'info' && (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span>{alert.message}</span>
            <button 
              className="btn btn-sm btn-ghost"
              onClick={() => setAlert(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="p-4 flex gap-3 items-start">
        <img src={profile?.avatar_url} className="rounded-full w-8"/>
        <div className="flex-1">
          <p className="font-semibold">{profile?.display_name || ""}</p>
          <p className="mt-1">{comment?.content}</p>
          <div className="flex gap-4 mt-2 text-xs text-neutral-500 items-center justify-end">
            <span className="italic">{localLikedBy.length} likes</span>
            <button 
              className={`btn ${isUpdatingLike ? 'btn-disabled' : ''}`} 
              onClick={handleToggleLike}
              disabled={isUpdatingLike}
            >
              {hasLiked ? "Dislike" : "Like"}
            </button>
            {comment?.time != null && comment?.time > 0 && (
              <button className="btn btn-secondary" onClick={() => handleTimestampClick(comment?.time as number)}>
                {msToMMSS(comment.time)}
              </button>
            )}
            {comment?.authorId === currentUserId && (
              <button className="btn btn-error" onClick={handleRemove}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}