export interface ChatMessage {
  id: string;
<<<<<<< HEAD
  sender: "user" | "assistant" | "model";
=======
  sender: "user" | "assistant" | "model" | "other";
  nickname?: string;
>>>>>>> 678fcbf (separate repository to flownote-service)
  timestamp: string | Date | null;
  message: string;
}
