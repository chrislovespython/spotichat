from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spotify import get_auth_url, exchange_code, get_current_song, get_current_user, get_user_by_id
from pydantic import BaseModel
import os
import base64
from dotenv import load_dotenv
import requests

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI")

# Updated scope to include seek permissions
scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state"

app = FastAPI()

# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # frontend URL
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Backend
from fastapi import Header, HTTPException

@app.get("/me")
def me(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    user = get_current_user(token)
    return user

@app.get("/current-song")
def current(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    song = get_current_song(token)
    if not song:
        return {"message": "Not listening"}
    print(song)
    return song

# -----------------------------
# Seek Functionality
# -----------------------------
class SeekRequest(BaseModel):
    timestamp_ms: int
    device_id: str = None

@app.post("/seek")
def seek_track(body: SeekRequest, authorization: str = Header(...)):
    """Seek to a specific timestamp in the currently playing track"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    
    token = authorization.split(" ")[1]
    
    try:
        # First, get current playback to validate
        current_response = requests.get(
            "https://api.spotify.com/v1/me/player",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if current_response.status_code == 204:
            raise HTTPException(status_code=400, detail="No active playback")
        
        if current_response.status_code != 200:
            raise HTTPException(status_code=current_response.status_code, detail="Failed to get current playback")
        
        playback_data = current_response.json()
        #print(playback_data)
        
        track = playback_data.get("item")
        
        if not playback_data.get("is_playing"):
            raise HTTPException(status_code=400, detail="Playback is paused")
        
        # Validate timestamp is within track duration
        
        if body.timestamp_ms < 0:
            raise HTTPException(status_code=400, detail="Timestamp cannot be negative")
        
        # Perform the seek
        seek_url = "https://api.spotify.com/v1/me/player/seek"
        params = {"position_ms": body.timestamp_ms}
        
        if body.device_id:
            params["device_id"] = body.device_id
        
        seek_response = requests.put(
            seek_url,
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=10
        )
        
        if seek_response.status_code == 204:
            # Success - Spotify returns 204 No Content for successful seeks
            readable_time = f"{body.timestamp_ms // 60000}:{(body.timestamp_ms % 60000) // 1000:02d}"
            return {
                "success": True,
                "seeked_to_ms": body.timestamp_ms,
                "seeked_to_readable": readable_time,
                "track_name": track.get("name", "Unknown"),
                "message": f"Seeked to {readable_time}"
            }
        elif seek_response.status_code == 403:
            raise HTTPException(status_code=403, detail="User doesn't have Spotify Premium (required for seeking)")
        elif seek_response.status_code == 404:
            raise HTTPException(status_code=404, detail="Device not found")
        else:
            raise HTTPException(
                status_code=seek_response.status_code, 
                detail=f"Failed to seek: {seek_response.text}"
            )
    
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# Alternative endpoint with timestamp in URL
@app.put("/seek/{timestamp_ms}")
def seek_track_url(timestamp_ms: int, authorization: str = Header(...)):
    """Seek to a specific timestamp via URL parameter"""
    seek_request = SeekRequest(timestamp_ms=timestamp_ms)
    return seek_track(seek_request, authorization)

# Get available devices
@app.get("/devices")
def get_devices(authorization: str = Header(...)):
    """Get user's available devices"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    
    token = authorization.split(" ")[1]
    
    try:
        response = requests.get(
            "https://api.spotify.com/v1/me/player/devices",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to get devices")
    
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")

# -----------------------------
# Spotify Auth
# -----------------------------
@app.get("/auth/login")
def login():
    return {"url": get_auth_url()}

@app.get("/user/{user_id}")
def spotify_user(user_id: str, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    return get_user_by_id(token, user_id)

class RefreshBody(BaseModel):
    refresh_token: str

@app.post("/auth/refresh")
def refresh(body: RefreshBody):
    auth_header = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "refresh_token", "refresh_token": body.refresh_token},
        headers={"Authorization": f"Basic {auth_header}"}
    , timeout=60)
    return response.json()

class CodeBody(BaseModel):
    code: str

@app.post("/auth/callback")
def callback(body: CodeBody):
    token_info = exchange_code(body.code)
    return token_info

# -----------------------------
# Comments (like YouTube)
# -----------------------------