import { db } from "../lib/firebase"
import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  arrayUnion, 
  arrayRemove,
  increment
} from "firebase/firestore"

export async function addComment(songId: string, authorId: string, content: string, timestamp: number | null) {
  const commentRef = await addDoc(collection(db, "comments"), {
    authorId,
    content,
    likedBy: [],
    createdAt: Date.now(),
    time: timestamp    
  })

  const roomRef = doc(db, "rooms", songId)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
        songId: songId,
        comments: [commentRef.id],
        createdAt: Date.now(),
        listeners: 0
    })
  } else {
    await updateDoc(roomRef, {
      comments: arrayUnion(commentRef.id)
    })
  }
}

// Increment listener count
export async function addListener(songId: string) {
  const roomRef = doc(db, "rooms", songId)
  const roomSnap = await getDoc(roomRef)
  
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
        songId: songId,
        comments: [],
        createdAt: Date.now(),
        listeners: 1
    })
  } else {
    await updateDoc(roomRef, {
      listeners: increment(1)
    })
  }
}

// Decrement listener count
export async function removeListener(songId: string) {
  const roomRef = doc(db, "rooms", songId)
  const roomSnap = await getDoc(roomRef)
  
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
        songId: songId,
        comments: [],
        createdAt: Date.now(),
        listeners: 0
    })
    await updateDoc(roomRef, {
      listeners: increment(-1)
    })
  } else {
    await updateDoc(roomRef, {
      listeners: increment(-1)
    })
  }
}

export async function toggleLike(commentId: string, userId: string, liked: boolean) {
  const ref = doc(db, "comments", commentId)
  await updateDoc(ref, {
    likedBy: liked ? arrayRemove(userId) : arrayUnion(userId)
  })
}

export async function removeComment(songId: string, commentId: string) {
  const commentRef = doc(db, "comments", commentId)
  const roomRef = doc(db, "rooms", songId)

  // Step 1: ensure comment is removed from the room first
  const roomSnap = await getDoc(roomRef)
  if (roomSnap.exists()) {
    const data = roomSnap.data()
    const updated = (data.comments || []).filter((c: string) => c !== commentId)

    if (updated.length === 0) {
      // delete entire room if empty
      await deleteDoc(roomRef)
    } else {
      await updateDoc(roomRef, { comments: updated })
    }
  }

  // Step 2: delete the comment doc (removes likedBy, content, etc.)
  await deleteDoc(commentRef)
}
