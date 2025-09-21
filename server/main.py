from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth import router as auth_router
from spotify import router as spotify_router
from websocket import router as ws_router

app = FastAPI(title="Spotify Listening App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(spotify_router, prefix="/spotify", tags=["spotify"])
app.include_router(ws_router, prefix="", tags=["websocket"])

@app.get("/")
async def root():
    return {"message": "Spotify Listening App Backend Running 🚀"}
