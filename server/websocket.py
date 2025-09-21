from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

router = APIRouter()

# Keep track of connections per song_id
rooms: Dict[str, List[WebSocket]] = {}

@router.websocket("/ws/{song_id}")
async def websocket_endpoint(websocket: WebSocket, song_id: str):
    await websocket.accept()
    if song_id not in rooms:
        rooms[song_id] = []
    rooms[song_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast to all clients in the same room
            for connection in rooms[song_id]:
                if connection != websocket:
                    await connection.send_json(data)
    except WebSocketDisconnect:
        rooms[song_id].remove(websocket)
