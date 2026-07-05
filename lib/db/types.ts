import type { PersonaId } from "@/lib/ai/personas";

export interface Conversation {
  id: string;
  user_id: string;
  persona: PersonaId;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
