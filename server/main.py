import os
import json
import asyncio
import logging
from typing import Dict, List

import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import base64

# -----------------------------
# Logging
# -----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------
# Load environment variables
# -----------------------------
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "https://your-frontend.vercel.app/callback")

# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your frontend URL in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# WebSocket connection manager
# -----------------------------
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
        for user_id in disconnected_users:
            self.disconnect(user_id)

song_manager = SongConnectionManager()

# -----------------------------
# Spotify helpers
# -----------------------------
def get_song_by_id_helper(token: str, song_id: str):
    """Get Spotify track info by ID"""
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
                "artists": [a["name"] for a in track_data["artists"]],
                "album": {
                    "name": track_data["album"]["name"],
                    "images": track_data["album"]["images"]
                },
                "duration_ms": track_data["duration_ms"],
                "explicit": track_data["explicit"],
                "external_urls": track_data["external_urls"],
                "preview_url": track_data.get("preview_url"),
            }
        return {"error": f"Spotify API error: {response.status_code}"}
    except Exception as e:
        logger.error(f"Error fetching song {song_id}: {e}")
        return {"error": "Internal server error"}

async def get_current_song_ws(token: str):
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
                    "artists": [a["name"] for a in track["artists"]],
                    "album": track["album"]["name"],
                    "duration_ms": track["duration_ms"],
                    "explicit": track["explicit"],
                    "external_urls": track["external_urls"],
                    "preview_url": track.get("preview_url"),
                    "is_playing": data.get("is_playing", False),
                }
        return None
    except Exception as e:
        logger.error(f"Error fetching current song: {e}")
        return None

# -----------------------------
# WebSocket endpoint
# -----------------------------
@app.websocket("/ws/songs/{user_id}")
async def websocket_songs_endpoint(websocket: WebSocket, user_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="No token provided")
        return

    await song_manager.connect(websocket, user_id, token)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action")

            if action == "get_current_song":
                current_song = await get_current_song_ws(token)
                await song_manager.send_personal_message({
                    "action": "current_song_response",
                    "data": current_song,
                    "success": current_song is not None
                }, user_id)

            elif action == "get_song_by_id":
                song_id = message.get("song_id")
                if song_id:
                    song = get_song_by_id_helper(token, song_id)
                    await song_manager.send_personal_message({
                        "action": "song_by_id_response",
                        "data": song,
                        "song_id": song_id,
                        "success": song and "error" not in song
                    }, user_id)

            elif action == "ping":
                await song_manager.send_personal_message({
                    "action": "pong",
                    "timestamp": message.get("timestamp"),
                    "success": True
                }, user_id)

    except WebSocketDisconnect:
        song_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        song_manager.disconnect(user_id)

# -----------------------------
# REST endpoints (example)
# -----------------------------
@app.get("/song/{song_id}")
def get_song_by_id(song_id: str, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    return get_song_by_id_helper(token, song_id)
