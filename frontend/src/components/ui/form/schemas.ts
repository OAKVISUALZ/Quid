import { z } from "zod";

export const stellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, "Enter a valid Stellar public key.");

export function amountSchema(decimals = 7) {
  const pattern = new RegExp(`^\\d+(?:\\.\\d{0,${decimals}})?$`);
  return z
    .string()
    .regex(pattern, `Use at most ${decimals} decimal places.`)
    .refine((value) => Number(value) > 0, "Enter an amount greater than zero.");
}

export const bigintStringSchema = z
  .string()
  .regex(/^\d+$/, "Enter a whole number.");

export const questBasicsSchema = z.object({
  questType: z.enum(["product-testing", "community-participation"]),
  title: z.string().trim().min(3, "Enter a title with at least 3 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Describe the mission in at least 10 characters."),
  completionDuration: z.string().min(1),
  participantLimit: z.number().int().positive(),
  visibility: z.enum(["public", "private"]),
});

export const questRewardsSchema = z.object({
  rewardMethod: z.string().min(1),
  totalRewardBudget: z.number().positive(),
  numberOfWinners: z.number().int().positive(),
});
