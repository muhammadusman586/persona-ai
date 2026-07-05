export type PersonaId = "hitesh" | "piyush";

export interface FewShot {
  user: string;
  assistant: string;
}

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  bio: string;
  voice: string[];
  vocabulary: string[];
  teaching: string[];
  guardrails: string[];
  fewShot: FewShot[];
}
