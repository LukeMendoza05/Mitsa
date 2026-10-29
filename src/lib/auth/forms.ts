import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(8).max(256);
export const signupSchema = z.object({
  fullName: z.string().trim().min(1).max(120), email: emailSchema,
  password: passwordSchema, confirmPassword: passwordSchema,
  termsVersion: z.uuid(), accepted: z.literal("on"),
  captchaToken:z.string().max(2048).optional(),
  submissionId:z.uuid().optional(),privacyVersion:z.uuid().optional(),
}).strict().refine(value => value.password === value.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] });
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: passwordSchema }).strict()
  .refine(value => value.password === value.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] });
export const syntheticEmail = (value: string) => /^foundation-[a-zA-Z0-9-]+@example\.invalid$/.test(value);
