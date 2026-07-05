import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import type { Message } from "./types";

export async function listMessages(
  conversationId: string,
  db: SupabaseClient = getSupabase(),
): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  db: SupabaseClient = getSupabase(),
): Promise<Message> {
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, role, content })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Message;
}
