import { v4 as uuidv4 } from "uuid"
import type { SongMessage } from "@/types/message"

/**
 * Create a new song message
 */
export function createMessage(user: string, comment: string, time?: number): SongMessage {
  return {
    id: uuidv4(),                  // unique message ID
    user,
    comment,
    time,                           // optional
    createdAt: new Date().toISOString()
  }
}

// Example usage
const msg = createMessage("Alice", "This drop is 🔥", 92)
console.log(msg)
