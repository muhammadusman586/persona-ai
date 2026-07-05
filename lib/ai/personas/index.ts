import type { Persona, PersonaId } from "./types";
import { hitesh } from "./hitesh";
import { piyush } from "./piyush";

export type { Persona, PersonaId, FewShot } from "./types";

export const PERSONAS: Record<PersonaId, Persona> = {
  hitesh,
  piyush,
};

export function isPersonaId(id: string): id is PersonaId {
  return id === "hitesh" || id === "piyush";
}

export function getPersona(id: string): Persona {
  if (!isPersonaId(id)) {
    throw new Error(`Unknown persona: ${id}`);
  }
  return PERSONAS[id];
}
