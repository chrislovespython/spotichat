// Spotify User
export type SpotifyUser = {
  id: string
  display_name: string
  images : {height: number, url: string, width: string}[]
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
  images: {height: number, width: number, url: string}[]
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
  id: string
  authorId: string
  content: string
  song_id: string
  likedBy: string[] // seconds, optional
  time?: number
} | null
