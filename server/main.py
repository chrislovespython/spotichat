from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from spotify import get_auth_url, exchange_code, get_current_song, get_current_user, get_user_by_id
from pydantic import BaseModel

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


class CodeBody(BaseModel):
    code: str

@app.post("/auth/callback")
def callback(body: CodeBody):
    token_info = exchange_code(body.code)
    return token_info

# -----------------------------
# Comments (like YouTube)
# -----------------------------
