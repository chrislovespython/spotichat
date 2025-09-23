import { useEffect, useState } from "react"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
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
  const [loading, setLoading] = useState(true)
  
  // Local state for optimistic updates
  const [localLikedBy, setLocalLikedBy] = useState<string[]>(comment?.likedBy || [])
  const [isUpdatingLike, setIsUpdatingLike] = useState(false)
  
  const hasLiked = localLikedBy.includes(currentUserId)

  const token = localStorage.getItem("spotify_token")
  const currentUser = JSON.parse(localStorage.getItem("spotify_user") as string)

  // Update local state when comment prop changes
  useEffect(() => {
    setLocalLikedBy(comment?.likedBy || [])
  }, [comment?.likedBy])

  useEffect(() => {
    let active = true
    setLoading(true)
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
    
    const response = await fetch('http://localhost:8000/seek', {
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
      console.log(`Seeked to ${data.seeked_to_readable}`);
    } else {
      alert("You Need Spotify Premium To Seek.")
      console.error('Seek failed:', data.detail);
    }
  } catch (error) {
    console.error('Error seeking:', error);
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
      // Optional: Show error message to user
      alert('Failed to update like. Please try again.')
    } finally {
      setIsUpdatingLike(false)
    }
  }

  const handleRemove = async () => {
    await removeComment(songId, comment?.id as string)
  }

  if (loading) return (
    <div className="loading loading-spinner">Loading bro...</div>
  )

  return (
    <div className="card bg-base-100 ">
      <div className="p-4 flex gap-3 items-start">
        <Avatar>
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold">{profile?.display_name || ""}</p>
          <p className="mt-1">{comment?.content}</p>
          <div className="flex gap-4 mt-2 text-xs text-neutral-500 items-center">
            <span>{localLikedBy.length} likes</span>
            <button 
              className={`btn ${isUpdatingLike ? 'btn-disabled' : ''}`} 
              onClick={handleToggleLike}
              disabled={isUpdatingLike}
            >
              {hasLiked ? "💔 Unlike" : "❤️ Like"}
            </button>
            {comment?.authorId === currentUserId && (
              <button className="btn" onClick={handleRemove}>
                Delete
              </button>
            )}
            {comment?.time != null && comment?.time > 0 && (
              <button onClick={() => handleTimestampClick(comment?.time as number)}>
                Go To Timestamp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}