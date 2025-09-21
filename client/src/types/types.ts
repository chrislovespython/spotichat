// Spotify User
export type SpotifyUser = {
  id: string
  display_name: string
  profile_url?: string
  avatar_url?: string
} | null

// Spotify Artist
export type Artist = {
  name: string
} | null

// Spotify Album

// Spotify Song Item
export type SongItem = {
  id: string
  name: string
  artist : string
  images: { url: string; height?: number; width?: number }[]
  duration_ms?: number
  is_playing: boolean
  progress_ms?: number
  message?: string
} | null

// Current Playback
export type CurrentSong = {
  is_playing: boolean
  progress_ms?: number
  item: SongItem
  message?: string // e.g. "Not listening"
} | null

// Comment
export type Comment = {
  id?: string
  user: string
  avatar_url?: string
  comment: string
  song_id: string
  time?: number // seconds, optional
  timestamp?: string
} | null
