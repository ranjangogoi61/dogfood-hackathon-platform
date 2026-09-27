import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(255),

  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128),

  displayName: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(255),

  password: z
    .string()
    .min(1)
    .max(128),
});
