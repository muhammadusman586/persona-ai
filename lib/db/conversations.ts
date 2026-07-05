import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import type { PersonaId } from "@/lib/ai/personas";
import type { Conversation } from "./types";

export async function listConversations(
  userId: string,
  db: SupabaseClient = getSupabase(),
): Promise<Conversation[]> {
  const { data, error } = await db
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Conversation[];
}

export async function createConversation(
  userId: string,
  persona: PersonaId,
  title: string,
  db: SupabaseClient = getSupabase(),
): Promise<Conversation> {
  const { data, error } = await db
    .from("conversations")
    .insert({ user_id: userId, persona, title })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Conversation;
}

export async function getConversation(
  userId: string,
  id: string,
  db: SupabaseClient = getSupabase(),
): Promise<Conversation | null> {
  const { data, error } = await db
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Conversation;
}

export async function deleteConversation(
  userId: string,
  id: string,
  db: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function touchConversation(
  userId: string,
  id: string,
  db: SupabaseClient = getSupabase(),
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
