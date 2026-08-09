import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const staffUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['OWNER', 'STAFF']),
});

export type StaffUserDto = z.infer<typeof staffUserSchema>;
