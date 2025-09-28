import { useEffect, useState } from "react"
import { doc, getDoc, onSnapshot, deleteDoc } from "firebase/firestore"
import { db } from "../lib/firebase"
import type { Comment } from "../types/types"

export function useRoomComments(songId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [listeners, setListeners] = useState(0)

  useEffect(() => {
    if (!songId) return

    const roomRef = doc(db, "rooms", songId)

    const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setComments([])
        setLoading(false)
        return
      }

      const data = snapshot.data()

      setListeners(data?.listeners)
      const commentIds: string[] = data?.comments || []

      if (commentIds.length === 0) {
        await deleteDoc(roomRef)
        setComments([])
        setLoading(false)
        return
      }

      const commentDocs = await Promise.all(
        commentIds.map(async (cid) => {
          const cSnap = await getDoc(doc(db, "comments", cid))
          if (!cSnap.exists()) return null
          const data = cSnap.data() as Omit<Comment, "id">

          return { id: cid, ...data }
        })
      )

      setComments(commentDocs.filter((c): c is Comment => c !== null))
      setLoading(false)
    })

    return () => unsubscribe()
  }, [songId])

  return { comments, listeners, loading }
}
