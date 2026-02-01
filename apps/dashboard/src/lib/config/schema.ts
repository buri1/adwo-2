import { z } from "zod";

export const ProjectConfigSchema = z.object({
  name: z.string().min(1, "Project name is required"),
});

export const AdwoConfigSchema = z.object({
  version: z.string().default("1.0"),
  project: ProjectConfigSchema,
});

export type AdwoConfigInput = z.input<typeof AdwoConfigSchema>;
export type AdwoConfig = z.output<typeof AdwoConfigSchema>;
