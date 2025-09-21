from fastapi import APIRouter

router = APIRouter()

# Example: Active listeners
fake_listeners = {
    "3n3Ppam7vgaVa1iaRUc9Lp": ["user1", "user2"],  # Song ID → listeners
}

@router.get("/listening")
async def listening():
    return {"active_listeners": fake_listeners}

@router.get("/song/{song_id}")
async def song_details(song_id: str):
    listeners = fake_listeners.get(song_id, [])
    return {
        "song_id": song_id,
        "listeners": listeners,
        "comments": [
            {"user": "user1", "time": "1:23", "comment": "This drop is 🔥"},
            {"user": "user2", "time": "2:01", "comment": "Chills!"}
        ]
    }
