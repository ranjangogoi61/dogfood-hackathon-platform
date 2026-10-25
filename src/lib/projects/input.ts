import { z } from "zod";

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) URLs are allowed");

export const projectFields = {
  trackId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  tagline: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(20000),
  thumbnailUrl: httpUrl.nullable().optional(),
  imageUrls: z.array(httpUrl).max(10).optional(),
  videoUrl: httpUrl.nullable().optional(),
  repoUrl: httpUrl.nullable().optional(),
  liveUrl: httpUrl.nullable().optional(),
  techTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
};

export const createProjectSchema = z.object({
  teamId: z.string().uuid(),
  ...projectFields,
});

export const updateProjectSchema = z.object(projectFields).partial();
