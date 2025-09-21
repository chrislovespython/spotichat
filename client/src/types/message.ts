export type SongMessage = {
  user: string         // username or display name
  time?: number         // seconds elapsed in the song
  comment: string      // message content
  id: string          // optional unique ID for message
  createdAt: string   // optional ISO timestamp
}
