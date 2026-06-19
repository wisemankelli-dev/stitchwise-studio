import { z } from "zod";
import { UserTier } from "./workshop";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  createdAt: Date;
}

export const CreateUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required").max(200),
  tier: z.nativeEnum(UserTier).optional().default(UserTier.HOBBYIST),
});