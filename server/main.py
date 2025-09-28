from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from spotify import get_auth_url, exchange_code, get_current_song, get_current_user, get_user_by_id
from pydantic import BaseModel
import os
import base64
from dotenv import load_dotenv
import requests
import json
import asyncio
from typing import Dict, List
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = "https://liscuss.vercel.app/callback"

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

# WebSocket Connection Manager for Songs
class SongConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_tokens: Dict[str, str] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str, token: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_tokens[user_id] = token
        logger.info(f"User {user_id} connected to songs WebSocket")
        
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_tokens:
            del self.user_tokens[user_id]
        logger.info(f"User {user_id} disconnected from songs WebSocket")
        
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
                
    async def broadcast(self, message: dict):
        disconnected_users = []
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to {user_id}: {e}")
                disconnected_users.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected_users:
            self.disconnect(user_id)

song_manager = SongConnectionManager()

# Helper function to get song by ID (shared between REST and WebSocket)
def get_song_by_id_helper(token: str, song_id: str):
    """Get song details by Spotify track ID"""
    try:
        response = requests.get(
            f"https://api.spotify.com/v1/tracks/{song_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            track_data = response.json()
            return {
                "id": track_data["id"],
                "name": track_data["name"],
                "artist": track_data["artists"][0].get("name"),
                "artists": [artist.get("name") for artist in track_data["artists"]],
                "album": {
                    "name": track_data["album"]["name"],
                    "images": track_data["album"]["images"]
                },
                "images": track_data["album"]["images"],
                "duration_ms": track_data["duration_ms"],
                "explicit": track_data["explicit"],
                "external_urls": track_data["external_urls"],
                "preview_url": track_data.get("preview_url"),
                "popularity": track_data["popularity"],
                "is_local": track_data.get("is_local", False),
                "track_number": track_data.get("track_number"),
                "disc_number": track_data.get("disc_number")
            }
        elif response.status_code == 400:
            return {"error": "Invalid track ID"}
        elif response.status_code == 404:
            return {"error": "Track not found"}
        else:
            return {"error": f"Spotify API error: {response.status_code}"}
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error fetching song {song_id}: {e}")
        return {"error": "Network error"}
    except Exception as e:
        logger.error(f"Error fetching song {song_id}: {e}")
        return {"error": "Internal server error"}

# WebSocket helper functions
async def get_song_by_id_ws(token: str, song_id: str):
    """Get song details by Spotify track ID for WebSocket"""
    return get_song_by_id_helper(token, song_id)

async def get_current_song_ws(token: str):
    """Get current playing song for WebSocket"""
    try:
        response = requests.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data and data.get("item"):
                track = data["item"]
                return {
                    "id": track["id"],
                    "name": track["name"],
                    "artist": track["artists"][0].get("name"),
                    "images": track["album"]["images"],
                    "duration_ms": track["duration_ms"],
                    "explicit": track["explicit"],
                    "external_urls": track["external_urls"],
                    "preview_url": track.get("preview_url"),
                    "popularity": track["popularity"],
                    "is_playing": data.get("is_playing", False),
                }
        return None
    except Exception as e:
        logger.error(f"Error fetching current song: {e}")
        return None

# WebSocket endpoint for song operations
@app.websocket("/ws/songs/{user_id}")
async def websocket_songs_endpoint(websocket: WebSocket, user_id: str):
    # Get token from query parameters
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="No token provided")
        return
        
    await song_manager.connect(websocket, user_id, token)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            action = message.get("action")
            logger.info(f"Received action: {action} from user {user_id}")
            
            if action == "get_current_song":
                # Get current playing song
                current_song = await get_current_song_ws(token)
                response = {
                    "action": "current_song_response",
                    "data": current_song,
                    "success": current_song is not None
                }
                await song_manager.send_personal_message(response, user_id)
                
            elif action == "get_song_by_id":
                # Get specific song by ID
                song_id = message.get("song_id")
                if song_id:
                    song = await get_song_by_id_ws(token, song_id)
                    response = {
                        "action": "song_by_id_response",
                        "data": song,
                        "song_id": song_id,
                        "success": song is not None and "error" not in song
                    }
                else:
                    response = {
                        "action": "song_by_id_response",
                        "error": "No song_id provided",
                        "success": False
                    }
                await song_manager.send_personal_message(response, user_id)
                
            elif action == "get_multiple_songs":
                # Get multiple songs by IDs
                song_ids = message.get("song_ids", [])
                if song_ids and len(song_ids) <= 50:  # Spotify API limit
                    songs = []
                    for song_id in song_ids:
                        song = await get_song_by_id_ws(token, song_id)
                        if song and "error" not in song:
                            songs.append(song)
                    
                    response = {
                        "action": "multiple_songs_response",
                        "data": {"tracks": songs},
                        "success": True
                    }
                else:
                    response = {
                        "action": "multiple_songs_response",
                        "error": "Invalid song_ids (max 50 allowed)",
                        "success": False
                    }
                await song_manager.send_personal_message(response, user_id)
                
            elif action == "start_current_song_polling":
                # Start polling current song every N seconds
                interval = message.get("interval", 5)  # Default 5 seconds
                response = {
                    "action": "polling_started",
                    "interval": interval,
                    "success": True
                }
                await song_manager.send_personal_message(response, user_id)
                
                # Start background task for polling
                asyncio.create_task(poll_current_song(user_id, token, interval))
                
            elif action == "stop_current_song_polling":
                # Stop polling (handled by disconnection or flag)
                response = {
                    "action": "polling_stopped",
                    "success": True
                }
                await song_manager.send_personal_message(response, user_id)
                
            elif action == "ping":
                # Ping-pong for connection health
                response = {
                    "action": "pong",
                    "timestamp": message.get("timestamp"),
                    "success": True
                }
                await song_manager.send_personal_message(response, user_id)
                
            else:
                # Unknown action
                response = {
                    "action": "error",
                    "error": f"Unknown action: {action}",
                    "success": False
                }
                await song_manager.send_personal_message(response, user_id)
                
    except WebSocketDisconnect:
        song_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        song_manager.disconnect(user_id)

# Background task for polling current song
async def poll_current_song(user_id: str, token: str, interval: int):
    """Poll current song and send updates"""
    try:
        while user_id in song_manager.active_connections:
            current_song = await get_current_song_ws(token)
            response = {
                "action": "current_song_update",
                "data": current_song,
                "success": current_song is not None
            }
            await song_manager.send_personal_message(response, user_id)
            await asyncio.sleep(interval)
    except Exception as e:
        logger.error(f"Error in polling task for user {user_id}: {e}")

# -----------------------------
# REST API Endpoints
# -----------------------------
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

# NEW: Get song by ID REST endpoint
@app.get("/song/{song_id}")
def get_song_by_id(song_id: str, authorization: str = Header(...)):
    """Get song details by Spotify track ID"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    
    token = authorization.split(" ")[1]
    
    # Validate song_id format (basic validation)
    if not song_id or len(song_id) != 22:
        raise HTTPException(status_code=400, detail="Invalid Spotify track ID format")
    
    song = get_song_by_id_helper(token, song_id)
    
    if "error" in song:
        if song["error"] == "Track not found":
            raise HTTPException(status_code=404, detail="Track not found")
        elif song["error"] == "Invalid track ID":
            raise HTTPException(status_code=400, detail="Invalid track ID")
        elif song["error"] == "Network error":
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        else:
            raise HTTPException(status_code=500, detail=song["error"])
    
    return song

# NEW: Get multiple songs by IDs
class MultipleSongsRequest(BaseModel):
    song_ids: List[str]

@app.post("/songs/multiple")
def get_multiple_songs(body: MultipleSongsRequest, authorization: str = Header(...)):
    """Get multiple songs by their Spotify track IDs (max 50)"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    
    token = authorization.split(" ")[1]
    
    if not body.song_ids:
        raise HTTPException(status_code=400, detail="song_ids list cannot be empty")
    
    if len(body.song_ids) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 song IDs allowed")
    
    # Validate all song IDs
    for song_id in body.song_ids:
        if not song_id or len(song_id) != 22:
            raise HTTPException(status_code=400, detail=f"Invalid Spotify track ID format: {song_id}")
    
    songs = []
    errors = []
    
    for song_id in body.song_ids:
        song = get_song_by_id_helper(token, song_id)
        if "error" in song:
            errors.append({"song_id": song_id, "error": song["error"]})
        else:
            songs.append(song)
    
    return {
        "tracks": songs,
        "total": len(songs),
        "errors": errors if errors else None
    }

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

@app.get("/monitor")
def monitor():
    return "Monitored!"

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
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app)