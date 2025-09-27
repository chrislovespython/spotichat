const CLIENT_ID = "de5cd5d6c9c64a1fa0ffc35d4ca798b0"
const REDIRECT_URI = "https://liscuss.vercel.app/callback"
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-private"
]

export function getSpotifyLoginUrl() {
  const scope = encodeURIComponent(SCOPES.join(" "))
  return `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}`
}
