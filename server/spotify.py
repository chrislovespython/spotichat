from json import load
import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = "https://liscuss.vercel.app/callback"

scope = "user-read-currently-playing user-read-playback-state"

sp_oauth = SpotifyOAuth(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET,
    redirect_uri=SPOTIFY_REDIRECT_URI,
    scope=scope
)

def get_auth_url():
    return sp_oauth.get_authorize_url()

def exchange_code(code: str):
    token_info = sp_oauth.get_access_token(code)
    return token_info

def get_current_song(token: str):
    sp = spotipy.Spotify(auth=token)
    current = sp.current_user_playing_track()
    if not current or not current.get("item"):
        return None
    #print(current)
    return {
        "id": current["item"]["id"],
        "name": current["item"]["name"],
        "images": current["item"]["album"]["images"],
        "artist": ", ".join([a["name"] for a in current["item"]["artists"]]),
        "is_playing": current["is_playing"]
    }
    
def get_user_by_id(token: str, user_id: str):
    sp = spotipy.Spotify(auth=token)
    return sp.user(user_id)

    
def get_current_user(token: str):
    sp = spotipy.Spotify(auth=token)
    user = sp.me()
    print(user)
    return user
