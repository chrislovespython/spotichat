from pydantic import BaseModel
from typing import Optional

class Comment(BaseModel):
    user: str
    comment: str
    song_id: str
    time: Optional[int] = None  # in seconds, optional
