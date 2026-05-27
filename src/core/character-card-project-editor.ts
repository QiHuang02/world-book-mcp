import { z } from "zod";
import { type Project, ProjectGreetingsSchema, ProjectProfileSchema, type ProjectGreetings, type ProjectProfile } from "../schemas/project.js";

export const CharacterProfileChangesSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  scenario: z.string().optional(),
  first_mes: z.string().optional(),
  alternate_greetings: z.array(z.string()).optional(),
  creator_notes: z.string().optional(),
  system_prompt: z.string().optional(),
  post_history_instructions: z.string().optional(),
  tags: z.array(z.string()).optional(),
  creator: z.string().optional(),
  character_version: z.string().optional(),
  talkativeness: z.string().optional(),
  include_worldbook: z.boolean().optional(),
  worldbook_name: z.string().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" });

export const CharacterGreetingsChangesSchema = z.object({ first_mes: z.string().optional(), alternate_greetings: z.array(z.string()).optional() }).strict().refine((value) => Object.keys(value).length > 0, { message: "changes 至少需要一个字段" });
export type CharacterProfileChanges = z.infer<typeof CharacterProfileChangesSchema>;
export type CharacterGreetingsChanges = z.infer<typeof CharacterGreetingsChangesSchema>;

export function defaultProjectProfile(projectName: string): ProjectProfile { return ProjectProfileSchema.parse({ name: projectName, description: "", personality: "", scenario: "", first_mes: "", alternate_greetings: [], creator_notes: "", system_prompt: "", post_history_instructions: "", tags: [], creator: "", character_version: "1.0", talkativeness: "0.5", include_worldbook: true, worldbook_name: `${projectName}世界书` }); }
export function defaultProjectGreetings(project: Project): ProjectGreetings { return ProjectGreetingsSchema.parse({ first_mes: project.greetings?.first_mes ?? project.profile?.first_mes ?? "", alternate_greetings: project.greetings?.alternate_greetings ?? project.profile?.alternate_greetings ?? [] }); }
export function applyCharacterProfileUpdate(project: Project, changes: CharacterProfileChanges): Project { return { ...project, profile: ProjectProfileSchema.parse({ ...(project.profile ?? defaultProjectProfile(project.name)), ...changes }) }; }
export function applyCharacterGreetingsUpdate(project: Project, changes: CharacterGreetingsChanges): Project { return { ...project, greetings: ProjectGreetingsSchema.parse({ ...defaultProjectGreetings(project), ...changes }) }; }
